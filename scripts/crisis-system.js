/**
 * 危机事件系统 (Crisis System) - P6-T4
 *
 * 功能：周期性危机事件，增加游戏挑战性
 * 机制：
 * 1. 多种危机类型：金融危机、疫情、网络攻击
 * 2. 危机触发：基于概率的随机触发
 * 3. 危机效果：临时性负面效果
 * 4. 恢复机制：等待结束或支付代价提前结束
 */

const createCrisisSystem = ({
  st,
  eventBus,
  buildings,
  pushLog,
  I18N,
  economy,
}) => {
  // 获取当前语言
  const getLang = () => (typeof I18N !== 'undefined' ? I18N.getCurrentLang() : 'zh');

  // ═══════════════════════════════════════════════════════════════════════════
  // 数据存储
  // ═══════════════════════════════════════════════════════════════════════════

  const initCrisisData = () => {
    if (!st.crisis) {
      st.crisis = {
        // 当前激活的危机
        active: null,
        // 历史记录
        history: [],
        // 免疫时间（防止连续危机）
        immuneUntil: 0,
        // 统计数据
        stats: {
          totalCrises: 0,
          survivedCrises: 0,
          bailedOutCrises: 0,
          totalLoss: 0,
        },
      };
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 危机配置
  // ═══════════════════════════════════════════════════════════════════════════

  const CRISES = {
    financial_crisis: {
      id: 'financial_crisis',
      name: { zh: '金融危机', en: 'Financial Crisis' },
      description: {
        zh: '市场崩溃，所有产出减半',
        en: 'Market collapse, all output halved',
      },
      probability: 0.001, // 每日 0.1% 概率
      duration: 300, // 5 分钟（秒）
      minMoney: 1e6, // 触发条件：至少拥有 1M
      effects: {
        gpsMultiplier: 0.5,      // GPS 减半
        manualPower: 0.5,        // 手动收益减半
        buildingCostMult: 1.3,   // 建筑成本 +30%
      },
      recovery: {
        type: 'bailout',
        cost: (st) => Math.max(1e6, st.lifetimeGears * 0.05), // 5% 历史总收益
        description: { zh: '政府救助', en: 'Government Bailout' },
      },
      icon: '💥',
      color: '#ff4444',
    },

    pandemic: {
      id: 'pandemic',
      name: { zh: '全球疫情', en: 'Global Pandemic' },
      description: {
        zh: '劳动力短缺，离线收益和手动收益大幅降低',
        en: 'Labor shortage, offline and manual gains severely reduced',
      },
      probability: 0.0005, // 每日 0.05% 概率
      duration: 600, // 10 分钟
      minMoney: 5e6,
      effects: {
        manualPower: 0.3,        // 手动收益降至 30%
        offlineRate: 0.2,        // 离线收益降至 20%
        buildingEfficiency: 0.8, // 建筑效率 -20%
      },
      recovery: {
        type: 'bailout',
        cost: (st) => Math.max(5e6, st.lifetimeGears * 0.08),
        description: { zh: '疫苗研发', en: 'Vaccine Research' },
      },
      icon: '🦠',
      color: '#ff8800',
    },

    cyber_attack: {
      id: 'cyber_attack',
      name: { zh: '网络攻击', en: 'Cyber Attack' },
      description: {
        zh: '系统被黑，自动购买和特殊能力被禁用',
        en: 'System hacked, auto-buy and special abilities disabled',
      },
      probability: 0.0003, // 每日 0.03% 概率
      duration: 120, // 2 分钟
      minMoney: 1e7,
      effects: {
        autoBuyDisabled: true,   // 禁用自动购买
        marketFrozen: true,      // 市场冻结
        skillCooldownMult: 2,    // 技能冷却时间翻倍
      },
      recovery: {
        type: 'bailout',
        cost: (st) => Math.max(1e7, st.lifetimeGears * 0.03),
        description: { zh: '安全修复', en: 'Security Patch' },
      },
      icon: '💻',
      color: '#8800ff',
    },

    trade_war: {
      id: 'trade_war',
      name: { zh: '贸易战', en: 'Trade War' },
      description: {
        zh: '关税上升，产业链加成失效',
        en: 'Tariffs rising, supply chain bonuses disabled',
      },
      probability: 0.0004,
      duration: 240, // 4 分钟
      minMoney: 2e6,
      effects: {
        synergyDisabled: true,   // 产业链加成失效
        arbitrageDisabled: true, // 套利禁用
        globalMarketBonus: 0.5,  // 全球市场加成减半
      },
      recovery: {
        type: 'bailout',
        cost: (st) => Math.max(2e6, st.lifetimeGears * 0.04),
        description: { zh: '贸易谈判', en: 'Trade Negotiation' },
      },
      icon: '⚔️',
      color: '#ffaa00',
    },

    inflation_spike: {
      id: 'inflation_spike',
      name: { zh: '恶性通胀', en: 'Hyperinflation' },
      description: {
        zh: '货币贬值，储蓄价值快速流失',
        en: 'Currency devaluation, savings value rapidly declining',
      },
      probability: 0.0006,
      duration: 180, // 3 分钟
      minMoney: 1e8,
      effects: {
        moneyDrainRate: 0.01,    // 每秒损失 1% 资金
        priceInflation: 2.0,     // 价格翻倍
        interestRate: -0.1,      // 负利率
      },
      recovery: {
        type: 'bailout',
        cost: (st) => Math.max(1e8, st.money * 0.2), // 20% 当前资金
        description: { zh: '紧缩政策', en: 'Austerity Measures' },
      },
      icon: '📉',
      color: '#ff0000',
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 危机状态管理
  // ═══════════════════════════════════════════════════════════════════════════

  const getActiveCrisis = () => st.crisis.active;

  const isCrisisActive = () => st.crisis.active !== null;

  // ═══════════════════════════════════════════════════════════════════════════
  // 危机触发
  // ═══════════════════════════════════════════════════════════════════════════

  // 预计算静态列表：Object.values(CRISES) 每 100ms 调用一次，缓存避免重复分配
  const _crisisList = Object.values(CRISES);

  const checkCrisisTrigger = () => {
    const now = Date.now();

    // 检查是否已有危机或处于免疫期
    if (isCrisisActive()) return false;
    if (now < st.crisis.immuneUntil) return false;

    // 检查每个危机的触发概率
    const availableCrises = _crisisList.filter(crisis => {
      if (st.money < crisis.minMoney) return false;
      return true;
    });

    for (const crisis of availableCrises) {
      // 将每日概率转换为每秒概率
      const dailyProb = crisis.probability;
      const secondProb = dailyProb / (24 * 3600);

      if (Math.random() < secondProb) {
        triggerCrisis(crisis.id);
        return true;
      }
    }

    return false;
  };

  const triggerCrisis = (crisisId) => {
    const lang = getLang();
    const crisisConfig = CRISES[crisisId];
    const now = Date.now();

    const crisis = {
      id: crisisId,
      startedAt: now,
      // perk_crisp_immune: 危机持续时间减半
      endsAt: now + (st.perkCrispImmune ? Math.floor(crisisConfig.duration * 500) : crisisConfig.duration * 1000),
      effects: { ...crisisConfig.effects },
      recovered: false,
    };

    st.crisis.active = crisis;
    st.crisis.stats.totalCrises++;

    // 触发事件
    eventBus.emit('crisis:started', { crisis, config: crisisConfig });

    // 推送消息
    pushLog(`${crisisConfig.icon} ${lang === 'en' ? 'CRISIS' : '危机'}: ${crisisConfig.name[lang]}！${crisisConfig.description[lang]}`);

    return crisis;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 危机效果应用
  // ═══════════════════════════════════════════════════════════════════════════

  const getCrisisEffects = () => {
    if (!isCrisisActive()) return null;
    return st.crisis.active.effects;
  };

  const applyCrisisEffects = () => {
    if (!isCrisisActive()) return;

    const crisis = st.crisis.active;
    const effects = crisis.effects;
    // 危机损失减免：保守模式减免 30%
    const crisisDampening = (st.assetAllocation && st.assetAllocation.riskProfile === 'conservative') ? 0.30 : 0;

    // 恶性通胀的资金流失（应用减免）
    if (effects.moneyDrainRate && st.money > 0) {
      const drain = st.money * effects.moneyDrainRate * 0.1 * (1 - crisisDampening); // 每0.1秒
      st.money = Math.max(0, st.money - drain);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 危机恢复
  // ═══════════════════════════════════════════════════════════════════════════

  const recoverCrisis = (method = 'wait') => {
    const lang = getLang();
    const crisis = st.crisis.active;

    if (!crisis) return { success: false, error: lang === 'en' ? 'No active crisis' : '无活跃危机' };

    const crisisConfig = CRISES[crisis.id];
    const now = Date.now();
    // 危机损失减免：保守模式减免 30%
    const crisisDampening = (st.assetAllocation && st.assetAllocation.riskProfile === 'conservative') ? 0.30 : 0;

    if (method === 'bailout') {
      const baseCost = crisisConfig.recovery.cost(st);
      const cost = baseCost * (1 - crisisDampening); // 应用减免

      if (st.money < cost) {
        return { success: false, error: lang === 'en' ? 'Insufficient funds' : '资金不足' };
      }

      // 扣除资金
      st.money -= cost;
      st.crisis.stats.bailedOutCrises++;

      // 计算损失
      const loss = cost;
      st.crisis.stats.totalLoss += loss;

      pushLog(`${crisisConfig.icon} ${lang === 'en' ? 'Crisis resolved by' : '危机已通过'} ${crisisConfig.recovery.description[lang]} ${lang === 'en' ? 'Cost' : '花费'}: ${formatNumber(cost)}`);
    } else {
      // 等待结束
      st.crisis.stats.survivedCrises++;
      pushLog(`${crisisConfig.icon} ${lang === 'en' ? 'Crisis survived after' : '危机已度过，持续'} ${((now - crisis.startedAt) / 1000 / 60).toFixed(1)} ${lang === 'en' ? 'minutes' : '分钟'}`);
    }

    // 记录历史
    st.crisis.history.push({
      ...crisis,
      recoveredAt: now,
      recoveryMethod: method,
    });

    // 清除活跃危机
    st.crisis.active = null;

    // 设置免疫期（30分钟）
    st.crisis.immuneUntil = now + 30 * 60 * 1000;

    // 触发事件
    eventBus.emit('crisis:ended', { crisisId: crisis.id, method });

    return { success: true };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 危机检查
  // ═══════════════════════════════════════════════════════════════════════════

  const update = () => {
    const now = Date.now();

    // 检查活跃危机是否到期
    if (isCrisisActive()) {
      const crisis = st.crisis.active;

      if (now >= crisis.endsAt) {
        recoverCrisis('wait');
      } else {
        // 应用危机效果
        applyCrisisEffects();
      }
    } else {
      // 检查是否触发新危机
      checkCrisisTrigger();
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 查询接口
  // ═══════════════════════════════════════════════════════════════════════════

  const getCrisisInfo = () => {
    if (!isCrisisActive()) return null;

    const crisis = st.crisis.active;
    const config = CRISES[crisis.id];
    const now = Date.now();
    const remaining = Math.max(0, crisis.endsAt - now);
    const baseCost = config.recovery.cost(st);
    // 危机损失减免：保守模式减免 30%（用于 UI 显示）
    const crisisDampening = (st.assetAllocation && st.assetAllocation.riskProfile === 'conservative') ? 0.30 : 0;
    const bailoutCost = baseCost * (1 - crisisDampening);

    return {
      ...crisis,
      config,
      remainingSeconds: Math.ceil(remaining / 1000),
      remainingPercent: (remaining / (config.duration * 1000)) * 100,
      bailoutCost,
      canAffordBailout: st.money >= bailoutCost,
    };
  };

  const getCrisisHistory = () => st.crisis.history;

  const getStats = () => st.crisis.stats;

  const getAllCrisisTypes = () => Object.values(CRISES).map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    icon: c.icon,
    color: c.color,
    probability: c.probability,
    duration: c.duration,
  }));

  // ═══════════════════════════════════════════════════════════════════════════
  // UI 渲染
  // ═══════════════════════════════════════════════════════════════════════════

  const renderCrisisPanel = () => {
    const lang = getLang();
    const crisisInfo = getCrisisInfo();

    if (!crisisInfo) {
      // 检查免疫期
      const now = Date.now();
      const immuneTime = Math.max(0, st.crisis.immuneUntil - now);

      return `
        <div class="crisis-panel safe">
          <h3>${lang === 'en' ? '🛡️ No Active Crisis' : '🛡️ 无活跃危机'}</h3>
          ${immuneTime > 0 ? `<div class="immune-timer">${lang === 'en' ? 'Immune' : '免疫'}: ${Math.ceil(immuneTime / 1000)}s</div>` : ''}
          <div class="crisis-stats">
            <span>${lang === 'en' ? 'Survived' : '已度过'}: ${st.crisis.stats.survivedCrises}</span>
            <span>${lang === 'en' ? 'Bailed Out' : '已救助'}: ${st.crisis.stats.bailedOutCrises}</span>
          </div>
        </div>
      `;
    }

    const { config, remainingSeconds, remainingPercent, bailoutCost, canAffordBailout } = crisisInfo;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    // 生成效果描述
    const effectsList = Object.entries(crisisInfo.effects).map(([key, value]) => {
      const effectDesc = {
        gpsMultiplier: lang === 'en' ? `GPS ${(value * 100).toFixed(0)}%` : `产出 ${(value * 100).toFixed(0)}%`,
        manualPower: lang === 'en' ? `Manual ${(value * 100).toFixed(0)}%` : `手动 ${(value * 100).toFixed(0)}%`,
        offlineRate: lang === 'en' ? `Offline ${(value * 100).toFixed(0)}%` : `离线 ${(value * 100).toFixed(0)}%`,
        autoBuyDisabled: lang === 'en' ? 'Auto-buy OFF' : '自动购买 关闭',
        marketFrozen: lang === 'en' ? 'Market Frozen' : '市场冻结',
        synergyDisabled: lang === 'en' ? 'Synergy OFF' : '产业链失效',
      }[key] || key;
      return `<span class="effect-tag">${effectDesc}</span>`;
    }).join('');

    return `
      <div class="crisis-panel active" style="border-color: ${config.color}">
        <div class="crisis-header">
          <span class="crisis-icon">${config.icon}</span>
          <span class="crisis-name">${config.name[lang]}</span>
        </div>
        <div class="crisis-description">${config.description[lang]}</div>
        <div class="crisis-effects">${effectsList}</div>
        <div class="crisis-timer">
          <div class="timer-bar" style="width: ${remainingPercent}%; background: ${config.color}"></div>
          <span class="timer-text">${minutes}:${seconds.toString().padStart(2, '0')}</span>
        </div>
        <button class="bailout-btn ${canAffordBailout ? '' : 'disabled'}" onclick="window.recoverCrisis('bailout')" ${canAffordBailout ? '' : 'disabled'}>
          ${config.recovery.description[lang]} (${formatNumber(bailoutCost)})
        </button>
      </div>
    `;
  };

  const renderCrisisHistory = () => {
    const lang = getLang();
    const history = st.crisis.history.slice(-5).reverse();

    const historyHtml = history.map(h => {
      const config = CRISES[h.id];
      return `
        <div class="history-item">
          <span class="history-icon">${config.icon}</span>
          <span class="history-name">${config.name[lang]}</span>
          <span class="history-method">${h.recoveryMethod === 'bailout' ? '💰' : '⏱️'}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="crisis-history-panel">
        <h4>${lang === 'en' ? '📜 Recent Crises' : '📜 最近危机'}</h4>
        ${historyHtml || (lang === 'en' ? 'No history' : '无记录')}
      </div>
    `;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════════════════

  const init = () => {
    initCrisisData();

    // 定期更新（统一由 RAF 驱动，移除独立 setInterval）
    if (typeof window !== 'undefined' && window.__timerManager) window.__timerManager.schedule(update, 100);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 导出接口
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // 初始化
    init,
    update,

    // 危机管理
    triggerCrisis,
    recoverCrisis,
    getActiveCrisis,
    isCrisisActive,
    checkCrisisTrigger,

    // 效果
    getCrisisEffects,
    applyCrisisEffects,

    // 查询
    getCrisisInfo,
    getCrisisHistory,
    getStats,
    getAllCrisisTypes,

    // UI
    renderCrisisPanel,
    renderCrisisHistory,
  };
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createCrisisSystem };
}

// 辅助函数：数字格式化
function formatNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}
