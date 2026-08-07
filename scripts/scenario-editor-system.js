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
  // 初始化
  // ════════════════════════════════════════════════
  const init = () => {
    if (!st.scenarios) {
      st.scenarios = {
        customScenarios: [],
        activeScenario: null,
        history: [],
        stats: { created: 0, played: 0 },
      };
    }
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
    let scenario = TEMPLATES[scenarioId];
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

    // 导入
    html += '<div style="margin-bottom:12px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;">';
    html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">' + L('导入场景', 'Import Scenario') + '</div>';
    html += '<input data-scenario-field="import" type="text" placeholder="' + L('粘贴 JSON 场景数据', 'Paste scenario JSON') + '" style="width:100%;margin-bottom:4px;padding:4px 8px;font-size:12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:inherit;">';
    html += '<button class="btn" data-scenario-action="import" style="width:100%;padding:6px;font-size:12px;">' + L('导入', 'Import') + '</button>';
    html += '</div>';

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

    // 导入场景
    container.querySelectorAll('[data-scenario-action="import"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const importEl = container.querySelector('[data-scenario-field="import"]');
        const json = importEl && importEl.value.trim();
        if (!json) return;
        const r = importScenario(json);
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
    renderScenarioPanel,
    bindEvents,
    getTemplates: () => TEMPLATES,
  };
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createScenarioEditorSystem };
}
