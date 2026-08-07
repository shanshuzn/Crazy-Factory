/**
 * UGC 场景编辑器 (Scenario Editor System) - v1.0
 *
 * 功能：玩家创建和分享自定义经济模型场景
 * 机制：
 * 1. 场景模板：预设场景（高通胀、技术泡沫、稳定增长等）
 * 2. 自定义参数：玩家调整建筑价格/DPS/解锁条件
 * 3. 场景导入/导出：JSON格式分享
 * 4. 场景评分：基于游玩体验的自动生成评分
 */

const createScenarioEditorSystem = ({
  st,
  eventBus,
  pushLog,
  I18N,
  buildings,
}) => {
  const getLang = () => (typeof I18N !== 'undefined' ? I18N.getCurrentLang() : 'zh');
  const SCENARIO_KEY = 'ugc_scenarios';

  // ════════════════════════════════════════════════
  // 预设场景模板
  // ════════════════════════════════════════════════
  const TEMPLATES = {
    default: {
      id: 'default',
      name: { zh: '标准模式', en: 'Standard' },
      description: { zh: '原始游戏参数', en: 'Original game parameters' },
      params: { priceGrowth: 1.12, marketCycleMin: 45, marketCycleMax: 90, bullBonus: 1.15, bearPenalty: 0.85 },
    },
    hyperinflation: {
      id: 'hyperinflation',
      name: { zh: '恶性通胀', en: 'Hyperinflation' },
      description: { zh: '价格飞涨，货币贬值速度极快', en: 'Prices skyrocket, currency devalues rapidly' },
      params: { priceGrowth: 1.25, marketCycleMin: 20, marketCycleMax: 40, bullBonus: 2.0, bearPenalty: 0.5 },
    },
    tech_bubble: {
      id: 'tech_bubble',
      name: { zh: '科技泡沫', en: 'Tech Bubble' },
      description: { zh: '科技建筑产出极高但价格也极高', en: 'Tech buildings have extreme output and cost' },
      params: { priceGrowth: 1.18, marketCycleMin: 15, marketCycleMax: 30, bullBonus: 3.0, bearPenalty: 0.3 },
    },
    steady_growth: {
      id: 'steady_growth',
      name: { zh: '稳健增长', en: 'Steady Growth' },
      description: { zh: '低波动、低风险的慢节奏模式', en: 'Low volatility, slow and steady pace' },
      params: { priceGrowth: 1.08, marketCycleMin: 60, marketCycleMax: 120, bullBonus: 1.1, bearPenalty: 0.9 },
    },
    high_risk: {
      id: 'high_risk',
      name: { zh: '高风险高回报', en: 'High Risk High Reward' },
      description: { zh: '极端波动，大起大落', en: 'Extreme swings, boom and bust' },
      params: { priceGrowth: 1.12, marketCycleMin: 10, marketCycleMax: 25, bullBonus: 2.5, bearPenalty: 0.4 },
    },
    free_market: {
      id: 'free_market',
      name: { zh: '自由市场', en: 'Free Market' },
      description: { zh: '没有监管，完全自由波动', en: 'No regulation, pure market forces' },
      params: { priceGrowth: 1.15, marketCycleMin: 5, marketCycleMax: 15, bullBonus: 3.0, bearPenalty: 0.3 },
    },
  };

  // ════════════════════════════════════════════════
  // 场景市场：精选社区场景库
  // 这些场景可由玩家"应用"（立即生效）或"收藏"（加入收藏夹）
  // ════════════════════════════════════════════════
  const MARKETPLACE = {
    great_depression: {
      id: 'great_depression',
      name: { zh: '大萧条', en: 'Great Depression' },
      description: { zh: '需求崩塌，产能过剩，熊市主导', en: 'Demand collapse, overcapacity, bear market' },
      params: { priceGrowth: 1.05, marketCycleMin: 60, marketCycleMax: 180, bullBonus: 1.0, bearPenalty: 0.55 },
      difficulty: 2,
      tags: ['survival', 'bear'],
    },
    golden_age: {
      id: 'golden_age',
      name: { zh: '黄金年代', en: 'Golden Age' },
      description: { zh: '持续繁荣，牛市频繁，适合新手', en: 'Sustained boom, frequent bull runs, newbie friendly' },
      params: { priceGrowth: 1.1, marketCycleMin: 30, marketCycleMax: 70, bullBonus: 1.6, bearPenalty: 0.7 },
      difficulty: 1,
      tags: ['casual', 'bull'],
    },
    supply_crisis: {
      id: 'supply_crisis',
      name: { zh: '供应链危机', en: 'Supply Chain Crisis' },
      description: { zh: '上游涨价传导全产业链，成本压力大', en: 'Upstream price hikes cascade, cost pressure' },
      params: { priceGrowth: 1.22, marketCycleMin: 35, marketCycleMax: 80, bullBonus: 1.3, bearPenalty: 0.6 },
      difficulty: 3,
      tags: ['inflation', 'hard'],
    },
    digital_revolution: {
      id: 'digital_revolution',
      name: { zh: '数字革命', en: 'Digital Revolution' },
      description: { zh: '科技主导，泡沫与机遇并存', en: 'Tech-driven, bubbles and opportunities' },
      params: { priceGrowth: 1.2, marketCycleMin: 18, marketCycleMax: 40, bullBonus: 2.2, bearPenalty: 0.45 },
      difficulty: 3,
      tags: ['tech', 'volatile'],
    },
    slow_burn: {
      id: 'slow_burn',
      name: { zh: '慢性通胀', en: 'Slow Burn' },
      description: { zh: '温和但持续的物价上涨', en: 'Mild but persistent inflation' },
      params: { priceGrowth: 1.16, marketCycleMin: 40, marketCycleMax: 100, bullBonus: 1.4, bearPenalty: 0.65 },
      difficulty: 2,
      tags: ['inflation', 'steady'],
    },
    black_swan: {
      id: 'black_swan',
      name: { zh: '黑天鹅', en: 'Black Swan' },
      description: { zh: '极端事件频发，市场剧烈震荡', en: 'Frequent extreme events, violent swings' },
      params: { priceGrowth: 1.14, marketCycleMin: 8, marketCycleMax: 20, bullBonus: 1.8, bearPenalty: 0.35 },
      difficulty: 4,
      tags: ['extreme', 'hard'],
    },
    easy_money: {
      id: 'easy_money',
      name: { zh: '货币宽松', en: 'Easy Money' },
      description: { zh: '放水时代，资产价格普涨', en: 'QE era, assets broadly inflate' },
      params: { priceGrowth: 1.19, marketCycleMin: 25, marketCycleMax: 60, bullBonus: 2.0, bearPenalty: 0.5 },
      difficulty: 2,
      tags: ['bull', 'inflation'],
    },
    frozen_market: {
      id: 'frozen_market',
      name: { zh: '冰封市场', en: 'Frozen Market' },
      description: { zh: '交易停滞，价格几乎不变', en: 'Stagnant trading, prices barely move' },
      params: { priceGrowth: 1.02, marketCycleMin: 90, marketCycleMax: 240, bullBonus: 1.05, bearPenalty: 0.9 },
      difficulty: 1,
      tags: ['casual', 'slow'],
    },
  };

  // 收藏夹：持久化到 st.scenarios.favorites（存于存档）
  const _getFavorites = () => {
    if (!st.scenarios.favorites) st.scenarios.favorites = [];
    return st.scenarios.favorites;
  };

  const toggleFavorite = (scenarioId) => {
    const lang = getLang();
    const favs = _getFavorites();
    const idx = favs.indexOf(scenarioId);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(scenarioId);
    if (eventBus) eventBus.emit('scenario:favoritesChanged', { favorites: [...favs] });
    return { success: true, favorited: idx < 0 };
  };

  const isFavorite = (scenarioId) => _getFavorites().includes(scenarioId);

  const getMarketplace = () => Object.values(MARKETPLACE);
  const getMarketplaceScenario = (id) => MARKETPLACE[id] || null;

  // ════════════════════════════════════════════════
  // 初始化
  // ════════════════════════════════════════════════
  const init = () => {
    if (!st.scenarios) {
      st.scenarios = {
        customScenarios: [],
        activeScenario: null,
        history: [],
        favorites: [],
        stats: { created: 0, played: 0 },
      };
    }
    if (!st.scenarios.favorites) st.scenarios.favorites = [];
  };

  // ════════════════════════════════════════════════
  // 场景 CRUD
  // ════════════════════════════════════════════════
  const createScenario = (name, description, params) => {
    // 规范化名称：支持字符串或 {zh,en} 对象
    const normName = typeof name === 'object' && name !== null
      ? { zh: name.zh || '我的场景', en: name.en || name.zh || 'My Scenario' }
      : { zh: name || '我的场景', en: name || 'My Scenario' };
    const scenario = {
      id: 'custom_' + Date.now(),
      name: normName,
      description: description || '',
      params: {
        priceGrowth: params.priceGrowth || 1.12,
        marketCycleMin: params.marketCycleMin || 45,
        marketCycleMax: params.marketCycleMax || 90,
        bullBonus: params.bullBonus || 1.15,
        bearPenalty: params.bearPenalty || 0.85,
        offlineRate: params.offlineRate || 0.57,
        prestigeUnlockHours: params.prestigeUnlockHours || 22,
      },
      createdAt: Date.now(),
      author: 'player',
      rating: 0,
      plays: 0,
    };
    st.scenarios.customScenarios.push(scenario);
    st.scenarios.stats.created++;
    if (eventBus) eventBus.emit('scenario:created', { id: scenario.id });
    return { success: true, scenario };
  };

  const deleteScenario = (scenarioId) => {
    const lang = getLang();
    const idx = st.scenarios.customScenarios.findIndex(s => s.id === scenarioId);
    if (idx === -1) return { success: false, error: lang === 'en' ? 'Not found' : '未找到' };
    st.scenarios.customScenarios.splice(idx, 1);
    return { success: true };
  };

  const applyScenario = (scenarioId) => {
    const lang = getLang();
    let scenario = TEMPLATES[scenarioId] || MARKETPLACE[scenarioId];
    if (!scenario) {
      scenario = st.scenarios.customScenarios.find(s => s.id === scenarioId);
    }
    if (!scenario) return { success: false, error: lang === 'en' ? 'Scenario not found' : '场景不存在' };

    st.scenarios.activeScenario = scenarioId;
    st.scenarios.stats.played++;
    if (eventBus) eventBus.emit('scenario:applied', { id: scenarioId, params: scenario.params });
    if (pushLog) pushLog((lang === 'en' ? 'Scenario applied: ' : '场景应用: ') + (scenario.name[lang] || scenario.name.zh));
    return { success: true, scenario };
  };

  const getActiveScenario = () => {
    if (!st.scenarios || !st.scenarios.activeScenario) return null;
    return TEMPLATES[st.scenarios.activeScenario] ||
           MARKETPLACE[st.scenarios.activeScenario] ||
           st.scenarios.customScenarios.find(s => s.id === st.scenarios.activeScenario) || null;
  };

  // ════════════════════════════════════════════════
  // 导入/导出
  // ════════════════════════════════════════════════
  const exportScenario = (scenarioId) => {
    const lang = getLang();
    let scenario = st.scenarios.customScenarios.find(s => s.id === scenarioId);
    if (!scenario) return { success: false, error: lang === 'en' ? 'Not found' : '未找到' };
    const exportData = {
      version: '1.0',
      scenario: { name: scenario.name, description: scenario.description, params: scenario.params },
    };
    return { success: true, data: JSON.stringify(exportData, null, 2) };
  };

  const importScenario = (jsonString) => {
    const lang = getLang();
    try {
      const data = JSON.parse(jsonString);
      if (!data.scenario || !data.scenario.params) {
        return { success: false, error: lang === 'en' ? 'Invalid format' : '格式无效' };
      }
      return createScenario(data.scenario.name, data.scenario.description, data.scenario.params);
    } catch (e) {
      return { success: false, error: lang === 'en' ? 'Parse error: ' + e.message : '解析错误: ' + e.message };
    }
  };

  // ════════════════════════════════════════════════
  // 分享码系统：短码压缩（base64url）
  // 格式：紧凑 JSON -> UTF-8 bytes -> base64url
  // 兼容浏览器 (btoa/atob) 与 Node (Buffer)
  // ════════════════════════════════════════════════
  const CODE_PREFIX = 'CFS1:'; // Crazy Factory Scenario v1

  const _utf8ToBytes = (str) => encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const _bytesToUtf8 = (bin) => decodeURIComponent(bin.split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
  const _toBase64Url = (bin) => {
    const b64 = (typeof btoa === 'function')
      ? btoa(bin)
      : (typeof Buffer !== 'undefined' ? Buffer.from(bin, 'binary').toString('base64') : '');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  const _fromBase64Url = (code) => {
    let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return (typeof atob === 'function')
      ? atob(b64)
      : (typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64').toString('binary') : '');
  };

  const buildSharePayload = (scenario) => ({
    v: 1,
    n: scenario.name,          // {zh,en}
    d: scenario.description || '',
    p: scenario.params,
  });

  // 场景 -> 分享码
  const encodeScenarioCode = (scenario) => {
    if (!scenario) return { success: false, error: 'no scenario' };
    try {
      const json = JSON.stringify(buildSharePayload(scenario));
      const bytes = _utf8ToBytes(json);
      return { success: true, code: CODE_PREFIX + _toBase64Url(bytes) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  // 分享码 -> 场景数据（不落库，供导入）
  const decodeScenarioCode = (code) => {
    const lang = getLang();
    try {
      if (!code) return { success: false, error: lang === 'en' ? 'Empty code' : '空分享码' };
      const body = code.startsWith(CODE_PREFIX) ? code.slice(CODE_PREFIX.length) : code;
      const bin = _fromBase64Url(body);
      const json = _bytesToUtf8(bin);
      const data = JSON.parse(json);
      if (!data || !data.p) return { success: false, error: lang === 'en' ? 'Invalid code' : '无效的分享码' };
      const name = data.n && typeof data.n === 'object'
        ? { zh: data.n.zh || '分享场景', en: data.n.en || data.n.zh || 'Shared Scenario' }
        : { zh: data.n || '分享场景', en: data.n || 'Shared Scenario' };
      return { success: true, scenario: { name, description: data.d || '', params: data.p } };
    } catch (e) {
      return { success: false, error: lang === 'en' ? 'Decode error: ' + e.message : '解码错误: ' + e.message };
    }
  };

  // 分享码 -> 创建并返回新场景
  const applyScenarioCode = (code) => {
    const lang = getLang();
    const dec = decodeScenarioCode(code);
    if (!dec.success) return dec;
    return createScenario(dec.scenario.name, dec.scenario.description, dec.scenario.params);
  };

  // ════════════════════════════════════════════════
  // UI 渲染
  // ════════════════════════════════════════════════
  const renderScenarioPanel = () => {
    const lang = getLang();
    const L = (zh, en) => (lang === 'en' ? en : zh);
    let html = '<div style="padding:12px;">';
    html += '<h3 style="margin:0 0 8px;">' + L('🎛️ 场景编辑器', 'Scenario Editor') + '</h3>';

    // 创建表单
    html += '<div style="margin-bottom:12px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;">';
    html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">' + L('创建自定义场景', 'Create Scenario') + '</div>';
    html += '<input data-scenario-field="name" type="text" placeholder="' + L('场景名称', 'Name') + '" style="width:100%;margin-bottom:4px;padding:4px 8px;font-size:12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:inherit;">';
    html += '<input data-scenario-field="description" type="text" placeholder="' + L('描述（可选）', 'Description (optional)') + '" style="width:100%;margin-bottom:4px;padding:4px 8px;font-size:12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:inherit;">';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
    html += '<span style="font-size:11px;white-space:nowrap;">' + L('价格增速', 'Growth') + '</span>';
    html += '<input data-scenario-field="priceGrowth" type="range" min="0.9" max="1.5" step="0.01" value="1.12" style="flex:1;">';
    html += '<span data-scenario-field="priceGrowthVal" style="font-size:11px;min-width:36px;text-align:right;">1.12</span>';
    html += '</div>';
    html += '<button class="btn" data-scenario-action="create" style="width:100%;padding:6px;font-size:12px;">' + L('创建并应用', 'Create & Apply') + '</button>';
    html += '</div>';

    // 导入（JSON 或分享码）
    html += '<div style="margin-bottom:12px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;">';
    html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">' + L('导入场景', 'Import Scenario') + '</div>';
    html += '<input data-scenario-field="import" type="text" placeholder="' + L('粘贴 JSON 或分享码', 'Paste scenario JSON or share code') + '" style="width:100%;margin-bottom:4px;padding:4px 8px;font-size:12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:inherit;">';
    html += '<button class="btn" data-scenario-action="import" style="width:100%;padding:6px;font-size:12px;">' + L('导入', 'Import') + '</button>';
    html += '</div>';

    // 场景市场（精选社区场景）
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">' + L('🛒 场景市场', 'Scenario Market') + ' (' + Object.keys(MARKETPLACE).length + ')</div>';
    for (const [id, t] of Object.entries(MARKETPLACE)) {
      const name = t.name[lang] || t.name.zh;
      const desc = t.description[lang] || t.description.zh;
      const active = st.scenarios && st.scenarios.activeScenario === id;
      const fav = isFavorite(id);
      const diff = t.difficulty || 1;
      const diffStr = Array(diff).fill('★').join('') + Array(Math.max(0, 5 - diff)).fill('☆').join('');
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;margin-bottom:4px;' + (active ? 'background:rgba(251,191,36,0.1);border-color:rgba(251,191,36,0.3);' : '') + '">';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:13px;">' + name + ' <span style="font-size:10px;opacity:0.6;">' + diffStr + '</span></div>';
      html += '<div style="font-size:11px;opacity:0.6;">' + desc + '</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:4px;flex-shrink:0;">';
      html += '<button class="btn" data-scenario-action="favorite" data-scenario-id="' + id + '" style="padding:4px 8px;font-size:11px;">' + (fav ? '★' : '☆') + '</button>';
      html += '<button class="btn" data-scenario-action="apply" data-scenario-id="' + id + '" style="padding:4px 8px;font-size:11px;">' + (active ? L('启用中', 'Active') : L('应用', 'Apply')) + '</button>';
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';

    // 收藏夹（快捷入口）
    const favs = _getFavorites().filter((id) => MARKETPLACE[id] || st.scenarios.customScenarios.find((s) => s.id === id));
    if (favs.length > 0) {
      html += '<div style="margin-bottom:12px;">';
      html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">' + L('⭐ 收藏夹', 'Favorites') + ' (' + favs.length + ')</div>';
      for (const fid of favs) {
        const ms = MARKETPLACE[fid];
        const cs = !ms && st.scenarios.customScenarios.find((s) => s.id === fid);
        const scen = ms || cs;
        if (!scen) continue;
        const name = (scen.name[lang] || scen.name.zh);
        const active = st.scenarios.activeScenario === fid;
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border:1px solid rgba(255,255,255,0.08);border-radius:6px;margin-bottom:3px;' + (active ? 'background:rgba(251,191,36,0.1);' : '') + '">';
        html += '<div style="font-size:12px;">' + name + '</div>';
        html += '<div style="display:flex;gap:4px;">';
        html += '<button class="btn" data-scenario-action="apply" data-scenario-id="' + fid + '" style="padding:2px 8px;font-size:11px;">' + (active ? L('启用中', 'Active') : L('应用', 'Apply')) + '</button>';
        html += '<button class="btn" data-scenario-action="unfavorite" data-scenario-id="' + fid + '" style="padding:2px 8px;font-size:11px;">☆</button>';
        html += '</div></div>';
      }
      html += '</div>';
    }

    // Templates
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">' + L('预设模板', 'Templates') + '</div>';
    for (const [id, t] of Object.entries(TEMPLATES)) {
      const name = t.name[lang] || t.name.zh;
      const desc = t.description[lang] || t.description.zh;
      const active = st.scenarios && st.scenarios.activeScenario === id;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;margin-bottom:4px;' + (active ? 'background:rgba(251,191,36,0.1);border-color:rgba(251,191,36,0.3);' : '') + '">';
      html += '<div><div style="font-size:13px;">' + name + '</div>';
      html += '<div style="font-size:11px;opacity:0.6;">' + desc + '</div></div>';
      html += '<button class="btn" data-scenario-action="apply" data-scenario-id="' + id + '" style="padding:4px 10px;font-size:11px;">' + (active ? L('启用中', 'Active') : L('应用', 'Apply')) + '</button>';
      html += '</div>';
    }
    html += '</div>';

    // Custom scenarios
    const customs = st.scenarios ? st.scenarios.customScenarios : [];
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">' + L('自定义场景', 'Custom Scenarios') + ' (' + customs.length + ')</div>';
    if (customs.length === 0) {
      html += '<div style="font-size:12px;opacity:0.5;">' + L('暂无自定义场景', 'No custom scenarios yet') + '</div>';
    }
    for (const s of customs) {
      const name = typeof s.name === 'object' ? (s.name[lang] || s.name.zh) : s.name;
      const active = st.scenarios && st.scenarios.activeScenario === s.id;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;margin-bottom:4px;' + (active ? 'background:rgba(251,191,36,0.1);border-color:rgba(251,191,36,0.3);' : '') + '">';
      html += '<div style="font-size:13px;">' + name + '</div>';
      html += '<div style="display:flex;gap:4px;">';
      html += '<button class="btn" data-scenario-action="apply" data-scenario-id="' + s.id + '" style="padding:4px 8px;font-size:11px;">' + L('应用', 'Apply') + '</button>';
      html += '<button class="btn" data-scenario-action="share" data-scenario-id="' + s.id + '" style="padding:4px 8px;font-size:11px;">' + L('分享', 'Share') + '</button>';
      html += '<button class="btn" data-scenario-action="export" data-scenario-id="' + s.id + '" style="padding:4px 8px;font-size:11px;">' + L('导出', 'Export') + '</button>';
      html += '<button class="btn" data-scenario-action="delete" data-scenario-id="' + s.id + '" style="padding:4px 8px;font-size:11px;color:#f87171;">' + L('删除', 'Delete') + '</button>';
      html += '</div></div>';
    }
    html += '</div>';

    // Stats
    if (st.scenarios) {
      html += '<div style="font-size:11px;opacity:0.5;">';
      html += L('已创建: ', 'Created: ') + st.scenarios.stats.created + ' | ';
      html += L('已游玩: ', 'Played: ') + st.scenarios.stats.played;
      html += '</div>';
    }

    html += '</div>';
    return html;
  };

  // ════════════════════════════════════════════════
  // 事件绑定
  // ════════════════════════════════════════════════
  const bindEvents = (container) => {
    const lang = () => getLang();
    const L = (zh, en) => (lang() === 'en' ? en : zh);

    // 价格增速滑块数值同步
    container.querySelectorAll('[data-scenario-field="priceGrowth"]').forEach((slider) => {
      const valEl = container.querySelector('[data-scenario-field="priceGrowthVal"]');
      if (valEl) {
        slider.addEventListener('input', () => { valEl.textContent = Number(slider.value).toFixed(2); });
      }
    });

    // 创建场景
    container.querySelectorAll('[data-scenario-action="create"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nameEl = container.querySelector('[data-scenario-field="name"]');
        const descEl = container.querySelector('[data-scenario-field="description"]');
        const growthEl = container.querySelector('[data-scenario-field="priceGrowth"]');
        const name = (nameEl && nameEl.value.trim()) || L('我的场景', 'My Scenario');
        const desc = (descEl && descEl.value.trim()) || '';
        const priceGrowth = growthEl ? Number(growthEl.value) : 1.12;
        const r = createScenario({ zh: name }, desc, { priceGrowth });
        if (r.success && pushLog) pushLog(L('场景已创建: ', 'Scenario created: ') + name);
        if (r.success) applyScenario(r.scenario.id);
        if (container) container.innerHTML = renderScenarioPanel();
        if (container) bindEvents(container);
      });
    });

    // 导入场景（自动识别 JSON 或分享码）
    container.querySelectorAll('[data-scenario-action="import"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const importEl = container.querySelector('[data-scenario-field="import"]');
        const raw = importEl && importEl.value.trim();
        if (!raw) return;
        const isCode = raw.startsWith(CODE_PREFIX);
        const r = isCode ? applyScenarioCode(raw) : importScenario(raw);
        if (r.success) {
          if (pushLog) pushLog(L('场景导入成功: ', 'Scenario imported: ') + (r.scenario.name[lang()] || r.scenario.name.zh));
          applyScenario(r.scenario.id);
        } else if (pushLog) {
          pushLog(L('导入失败: ', 'Import failed: ') + (r.error || ''));
        }
        if (container) container.innerHTML = renderScenarioPanel();
        if (container) bindEvents(container);
      });
    });

    // 应用/导出/删除
    container.querySelectorAll('[data-scenario-action]').forEach((btn) => {
      const action = btn.getAttribute('data-scenario-action');
      const id = btn.getAttribute('data-scenario-id');
      if (!id || action === 'create' || action === 'import') return;
      btn.addEventListener('click', () => {
        if (action === 'apply') {
          const r = applyScenario(id);
          if (!r.success && pushLog) pushLog((r.error || ''));
        } else if (action === 'share') {
          const scen = st.scenarios.customScenarios.find((s) => s.id === id);
          const r = encodeScenarioCode(scen);
          if (r.success) {
            const copyText = r.code;
            const copyFn = () => {
              if (navigator && navigator.clipboard) {
                navigator.clipboard.writeText(copyText).then(() => {
                  if (pushLog) pushLog(L('分享码已复制: ', 'Share code copied: ') + copyText.slice(0, 24) + '...');
                }).catch(() => {
                  if (pushLog) pushLog(copyText.slice(0, 100) + '...');
                });
              } else if (pushLog) {
                pushLog(copyText.slice(0, 100) + '...');
              }
            };
            copyFn();
          } else if (pushLog) {
            pushLog((r.error || ''));
          }
        } else if (action === 'export') {
          const r = exportScenario(id);
          if (r.success && navigator && navigator.clipboard) {
            navigator.clipboard.writeText(r.data).then(() => {
              if (pushLog) pushLog(L('场景已复制到剪贴板', 'Scenario copied to clipboard'));
            }).catch(() => {
              if (pushLog) pushLog(r.data.slice(0, 200) + '...');
            });
          } else if (r.success && pushLog) {
            pushLog(r.data.slice(0, 200) + '...');
          }
        } else if (action === 'favorite' || action === 'unfavorite') {
          const r = toggleFavorite(id);
          if (pushLog) pushLog(r.favorited ? L('已收藏: ', 'Favorited: ') + id : L('已取消收藏: ', 'Unfavorited: ') + id);
        } else if (action === 'delete') {
          deleteScenario(id);
        }
        if (container) container.innerHTML = renderScenarioPanel();
        if (container) bindEvents(container);
      });
    });
  };

  // ════════════════════════════════════════════════
  // 导出
  // ════════════════════════════════════════════════
  return {
    init,
    createScenario,
    deleteScenario,
    applyScenario,
    getActiveScenario,
    exportScenario,
    importScenario,
    encodeScenarioCode,
    decodeScenarioCode,
    applyScenarioCode,
    renderScenarioPanel,
    bindEvents,
    getTemplates: () => TEMPLATES,
    getMarketplace,
    getMarketplaceScenario,
    toggleFavorite,
    isFavorite,
  };
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createScenarioEditorSystem };
}
