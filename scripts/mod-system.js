// Mod 支持系统 (P1)
// 为什么拆分：Mod 是对外扩展接口，隔离在独立模块便于版本演进与安全边界管理。
//
// 用法（在浏览器控制台或外部脚本中）：
//   CFMod.register({
//     id: 'my_mod',
//     name: '我的 Mod',
//     version: '1.0.0',
//     description: '…',
//     onLoad(ctx) { ctx.log('loaded'); },
//     onUpdate(dt, ctx) { ctx.st.gears += 1; },
//     onEvent(name, payload, ctx) { if (name === 'market:switch') ctx.log('市场切换'); },
//   });
//
// 启用/禁用：
//   CFMod.setEnabled('my_mod', false);
//
// 卸载（从持久化中移除）：
//   CFMod.remove('my_mod');

const createModSystem = ({
  st,
  eventBus,
  pushLog,
  saveMods = null,      // 可选：持久化回调
  loadMods = null,      // 可选：恢复回调
  modStorageKey = 'cf_mods_v1',
}) => {
  // ── 内部状态 ──
  const mods = new Map();        // id -> mod record
  const instances = new Map();   // id -> { onLoad, onUpdate, onEvent, ctx }
  let _disabled = new Set();     // 被用户禁用的 id
  let _dirty = false;

  // ── 持久化：默认用 localStorage，可注入替代 ──
  const getStorage = () => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* 非浏览器环境 */ }
    return null;
  };

  const _persist = () => {
    const storage = getStorage();
    if (!storage) return;
    try {
      const enabledIds = [...mods.keys()].filter((id) => !_disabled.has(id));
      storage.setItem(modStorageKey, JSON.stringify(enabledIds));
    } catch (e) { /* 存储满等忽略 */ }
  };

  const _restore = () => {
    const storage = getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(modStorageKey);
      if (!raw) return;
      const enabledIds = JSON.parse(raw);
      if (Array.isArray(enabledIds)) {
        _disabled = new Set([...mods.keys()].filter((id) => !enabledIds.includes(id)));
      }
    } catch (e) { /* 损坏数据忽略 */ }
  };

  // ── 事件转发（Mod 订阅游戏事件） ──
  if (eventBus && typeof eventBus.on === 'function') {
    eventBus.on('*', (name, payload) => {
      for (const [id, inst] of instances) {
        if (inst.onEvent) {
          try { inst.onEvent(name, payload, inst.ctx); }
          catch (e) { inst.ctx.log('[Mod] ' + id + ' onEvent error: ' + (e && e.message)); }
        }
      }
    });
  }

  // ── 构造 Mod 上下文 ──
  const makeCtx = (mod) => {
    let logCb = pushLog || ((msg) => { if (typeof console !== 'undefined') console.log('[Mod:' + mod.id + ']', msg); });
    return {
      st,                 // 游戏状态（可读可写）
      eventBus,           // 事件总线
      log: (msg) => logCb((mod.name || mod.id) + ': ' + msg),
      getState: () => st,
      settings: mod.settings || {},
    };
  };

  // ── 核心：注册 Mod ──
  const register = (mod) => {
    if (!mod || !mod.id) return { success: false, error: 'mod.id required' };
    if (mods.has(mod.id)) return { success: false, error: 'duplicate id: ' + mod.id };

    const record = {
      id: mod.id,
      name: mod.name || mod.id,
      version: mod.version || '0.0.0',
      description: mod.description || '',
      settings: mod.settings || {},
      onLoad: typeof mod.onLoad === 'function' ? mod.onLoad : null,
      onUpdate: typeof mod.onUpdate === 'function' ? mod.onUpdate : null,
      onEvent: typeof mod.onEvent === 'function' ? mod.onEvent : null,
      registeredAt: Date.now(),
    };
    mods.set(record.id, record);

    // 若未被禁用，立即实例化并触发 onLoad
    if (!_disabled.has(record.id)) {
      const ctx = makeCtx(record);
      instances.set(record.id, { ...record, ctx });
      if (record.onLoad) {
        try { record.onLoad(ctx); }
        catch (e) { ctx.log('[Mod] ' + record.id + ' onLoad error: ' + (e && e.message)); }
      }
    }
    _dirty = true;
    return { success: true, id: record.id, mod: record };
  };

  // ── 启用/禁用 ──
  const setEnabled = (id, enabled) => {
    const rec = mods.get(id);
    if (!rec) return { success: false, error: 'mod not found: ' + id };
    if (enabled) {
      _disabled.delete(id);
      if (!instances.has(id)) {
        const ctx = makeCtx(rec);
        instances.set(id, { ...rec, ctx });
        if (rec.onLoad) {
          try { rec.onLoad(ctx); }
          catch (e) { ctx.log('[Mod] ' + id + ' onLoad error: ' + (e && e.message)); }
        }
      }
    } else {
      _disabled.add(id);
      const inst = instances.get(id);
      if (inst && typeof inst.onUnload === 'function') {
        try { inst.onUnload(inst.ctx); } catch (e) { /* 忽略 */ }
      }
      instances.delete(id);
    }
    _persist();
    return { success: true };
  };

  // ── 卸载（移除持久化） ──
  const remove = (id) => {
    if (!mods.has(id)) return { success: false, error: 'mod not found: ' + id };
    const inst = instances.get(id);
    if (inst && typeof inst.onUnload === 'function') {
      try { inst.onUnload(inst.ctx); } catch (e) { /* 忽略 */ }
    }
    mods.delete(id);
    instances.delete(id);
    _disabled.delete(id);
    _persist();
    return { success: true };
  };

  // ── 每帧更新 ──
  const update = (dt) => {
    if (instances.size === 0) return;
    for (const inst of instances.values()) {
      if (inst.onUpdate) {
        try { inst.onUpdate(dt, inst.ctx); }
        catch (e) { inst.ctx.log('[Mod] ' + inst.id + ' onUpdate error: ' + (e && e.message)); }
      }
    }
  };

  // ── 查询 ──
  const getMods = () => [...mods.values()].map((m) => ({
    id: m.id,
    name: m.name,
    version: m.version,
    description: m.description,
    enabled: !_disabled.has(m.id),
  }));
  const getMod = (id) => mods.get(id) || null;
  const isEnabled = (id) => !_disabled.has(id);
  const getCount = () => mods.size;

  // ── UI 面板 ──
  const renderPanel = (lang = 'zh') => {
    const L = (zh, en) => (lang === 'en' ? en : zh);
    const list = [...mods.values()];
    let html = '<div style="padding:12px;">';
    html += '<h3 style="margin:0 0 8px;">' + (lang === 'en' ? '🧩 Mod Manager' : '🧩 Mod 管理器') + '</h3>';

    // 用法提示
    html += '<div style="font-size:11px;opacity:0.6;margin-bottom:8px;">';
    html += L('在控制台使用 CFMod.register({id, name, onLoad, onUpdate, onEvent}) 注册 Mod', 'Use CFMod.register({id, name, onLoad, onUpdate, onEvent}) in console to add mods');
    html += '</div>';

    if (list.length === 0) {
      html += '<div style="font-size:12px;opacity:0.5;">' + (lang === 'en' ? 'No mods registered yet' : '暂无已注册 Mod') + '</div>';
    }
    for (const m of list) {
      const enabled = !_disabled.has(m.id);
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;margin-bottom:4px;' + (enabled ? 'background:rgba(52,211,153,0.08);' : 'opacity:0.55;') + '">';
      html += '<div>';
      html += '<div style="font-size:13px;">' + m.name + ' <span style="font-size:10px;opacity:0.5;">v' + m.version + '</span></div>';
      html += '<div style="font-size:11px;opacity:0.6;">' + (m.description || m.id) + '</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:4px;align-items:center;">';
      html += '<span class="chip" style="font-size:10px;">' + (enabled ? (lang === 'en' ? 'ON' : '启用') : (lang === 'en' ? 'OFF' : '停用')) + '</span>';
      html += '<button class="btn" data-mod-action="toggle" data-mod-id="' + m.id + '" style="padding:2px 8px;font-size:11px;">' + (enabled ? (lang === 'en' ? 'Disable' : '停用') : (lang === 'en' ? 'Enable' : '启用')) + '</button>';
      html += '<button class="btn" data-mod-action="remove" data-mod-id="' + m.id + '" style="padding:2px 8px;font-size:11px;color:#f87171;">✕</button>';
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  };

  // 面板按钮事件绑定
  const bindEvents = (container) => {
    container.querySelectorAll('[data-mod-action]').forEach((btn) => {
      const action = btn.getAttribute('data-mod-action');
      const id = btn.getAttribute('data-mod-id');
      if (!id) return;
      btn.addEventListener('click', () => {
        if (action === 'toggle') {
          setEnabled(id, !isEnabled(id));
        } else if (action === 'remove') {
          remove(id);
        }
        container.innerHTML = renderPanel();
        bindEvents(container);
      });
    });
  };

  // ── 初始化 ──
  const init = () => {
    _restore();
    // 注册时若默认启用，会调用 onLoad；恢复时按持久化状态重新设置
    for (const id of _disabled) {
      if (instances.has(id)) {
        instances.delete(id);
      }
    }
    // 确保所有未禁用的 mod 都有实例
    for (const [id, rec] of mods) {
      if (!_disabled.has(id) && !instances.has(id)) {
        const ctx = makeCtx(rec);
        instances.set(id, { ...rec, ctx });
        if (rec.onLoad) {
          try { rec.onLoad(ctx); }
          catch (e) { ctx.log('[Mod] ' + id + ' onLoad error: ' + (e && e.message)); }
        }
      }
    }
    return { success: true };
  };

  init();

  return {
    init,
    register,
    setEnabled,
    remove,
    update,
    getMods,
    getMod,
    isEnabled,
    getCount,
    renderPanel,
    bindEvents,
  };
};

// 导出模块（Node 测试环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createModSystem };
}
