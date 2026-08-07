/**
 * 资产配置/风险偏好系统 (Asset Allocation System) - v1.0
 *
 * 功能：玩家可选择风险偏好，影响 auto-buy ROI 排序、资金分配和收益波动
 * 机制：
 * 1. 三档风险偏好：保守/平衡/激进，通过 lambda 幂运算调整 ROI 排序
 * 2. 三维资金分配：建筑投资/升级研发/衍生品保证金
 * 3. 波动率缩放：影响 GPS 乘法链路中市场乘数的偏差幅度
 * 4. 衍生品杠杆上限：根据风险偏好动态限制
 * 5. 危机损失减免：保守模式减免 30% 损失
 */

const createAssetAllocationSystem = ({
  st,
  eventBus,
  pushLog,
  I18N,
  buildings,
}) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 数据存储初始化
  // ═══════════════════════════════════════════════════════════════════════════

  const initAllocationData = () => {
    if (!st.assetAllocation) {
      st.assetAllocation = {
        riskProfile: 'balanced',
        allocation: {
          buildings: 0.65,
          upgrades: 0.20,
          derivativesMargin: 0.15,
        },
        stats: {
          lastRebalanceAt: 0,
          totalRebalances: 0,
        },
      };
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 风险偏好配置表
  // ═══════════════════════════════════════════════════════════════════════════

  const RISK_PROFILES = {
    conservative: {
      id: 'conservative',
      lambda: 0.5,        // 幂运算系数，压缩高/低 ROI 差距
      volatilityScale: 0.6, // GPS 波动率缩放
      maxLeverage: 2,      // 衍生品最大杠杆
      crisisDampening: 0.30, // 危机损失减免比例
      name: { zh: '保守', en: 'Conservative' },
      icon: '🛡️',
    },
    balanced: {
      id: 'balanced',
      lambda: 1.0,        // 保持原始 ROI 排序
      volatilityScale: 1.0,
      maxLeverage: 5,
      crisisDampening: 0.0,
      name: { zh: '平衡', en: 'Balanced' },
      icon: '⚖️',
    },
    aggressive: {
      id: 'aggressive',
      lambda: 1.8,        // 放大高 ROI 建筑优势
      volatilityScale: 1.5,
      maxLeverage: 10,
      crisisDampening: 0.0,
      name: { zh: '激进', en: 'Aggressive' },
      icon: '🔥',
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 语言获取
  // ═══════════════════════════════════════════════════════════════════════════

  const getLang = () => (typeof I18N !== 'undefined' ? I18N.getCurrentLang() : 'zh');

  // ═══════════════════════════════════════════════════════════════════════════
  // 核心查询接口
  // ═══════════════════════════════════════════════════════════════════════════

  const getRiskProfile = () => st.assetAllocation?.riskProfile || 'balanced';

  const getAllocation = () => {
    const alloc = st.assetAllocation?.allocation || {};
    return {
      buildings: alloc.buildings ?? 0.65,
      upgrades: alloc.upgrades ?? 0.20,
      derivativesMargin: alloc.derivativesMargin ?? 0.15,
    };
  };

  const getConfig = () => {
    const profileId = getRiskProfile();
    return RISK_PROFILES[profileId] || RISK_PROFILES.balanced;
  };

  const getLambda = () => getConfig().lambda;
  const getVolatilityScale = () => getConfig().volatilityScale;
  const getMaxLeverage = () => getConfig().maxLeverage;
  const getCrisisDampening = () => getConfig().crisisDampening;

  // ═══════════════════════════════════════════════════════════════════════════
  // 预算分配计算
  // ═══════════════════════════════════════════════════════════════════════════

  const getBudgetSplit = (totalGears) => {
    const alloc = getAllocation();
    const MIN_MARGIN = 0.05; // 保证金刚预留最小比例

    // 计算margin，确保不小于最小值
    let marginRatio = alloc.derivativesMargin;
    if (marginRatio < MIN_MARGIN) {
      marginRatio = MIN_MARGIN;
    }

    // 剩余资金在建筑和升级之间按比例分配
    const availableRatio = 1 - marginRatio;
    const buildingRatio = availableRatio * (alloc.buildings / (alloc.buildings + alloc.upgrades || 1));
    const upgradeRatio = availableRatio * (alloc.upgrades / (alloc.buildings + alloc.upgrades || 1));

    return {
      buildingBudget: Math.floor(totalGears * buildingRatio),
      upgradeBudget: Math.floor(totalGears * upgradeRatio),
      marginReserve: Math.floor(totalGears * marginRatio),
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 风险偏好设置
  // ═══════════════════════════════════════════════════════════════════════════

  const setRiskProfile = (profileId) => {
    if (!RISK_PROFILES[profileId]) {
      console.warn(`Unknown risk profile: ${profileId}`);
      return;
    }

    const lang = getLang();
    const config = RISK_PROFILES[profileId];
    const oldProfile = getRiskProfile();

    st.assetAllocation.riskProfile = profileId;

    pushLog(`${config.icon} ${lang === 'en' ? 'Risk Profile' : '风险偏好'}：${config.name[lang]}`);

    // 触发事件
    if (eventBus) {
      eventBus.emit('risk:changed', {
        profile: profileId,
        lambda: config.lambda,
        volatilityScale: config.volatilityScale,
        oldProfile,
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 资产分配设置
  // ═══════════════════════════════════════════════════════════════════════════

  const setAllocation = ({ buildings, upgrades }) => {
    if (typeof buildings !== 'number' || typeof upgrades !== 'number') {
      console.warn('setAllocation: buildings and upgrades must be numbers');
      return;
    }

    // 归一化：确保总和不超过 1
    let total = buildings + upgrades;
    if (total > 1) {
      buildings = buildings / total;
      upgrades = upgrades / total;
    }

    // 保证金刚预留最小比例
    const MIN_MARGIN = 0.05;
    let margin = 1 - buildings - upgrades;
    if (margin < MIN_MARGIN) {
      const scale = (1 - MIN_MARGIN) / (buildings + upgrades);
      buildings *= scale;
      upgrades *= scale;
      margin = MIN_MARGIN;
    }

    st.assetAllocation.allocation = {
      buildings,
      upgrades,
      derivativesMargin: 1 - buildings - upgrades,
    };

    // 更新统计
    st.assetAllocation.stats.lastRebalanceAt = Date.now();
    st.assetAllocation.stats.totalRebalances++;

    // 触发事件
    if (eventBus) {
      eventBus.emit('allocation:changed', {
        buildings: st.assetAllocation.allocation.buildings,
        upgrades: st.assetAllocation.allocation.upgrades,
        derivativesMargin: st.assetAllocation.allocation.derivativesMargin,
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 调整后 ROI 计算（供 UI/调试用）
  // ═══════════════════════════════════════════════════════════════════════════

  const getAdjustedROI = (building) => {
    // 这是简化版本，实际 ROI 计算在 economy-system 中
    // 此处仅用于调试显示
    const lambda = getLambda();
    if (lambda === 1.0) return null; // 平衡模式下无调整
    return lambda; // 返回 lambda 值供 UI 显示
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UI 渲染：风险偏好选择器
  // ═══════════════════════════════════════════════════════════════════════════

  const renderRiskSelector = () => {
    const lang = getLang();
    const currentProfile = getRiskProfile();

    const profiles = [
      { id: 'conservative', label: lang === 'en' ? 'Conservative' : '保守', icon: '🛡️' },
      { id: 'balanced', label: lang === 'en' ? 'Balanced' : '平衡', icon: '⚖️' },
      { id: 'aggressive', label: lang === 'en' ? 'Aggressive' : '激进', icon: '🔥' },
    ];

    const chips = profiles.map(p => {
      const isActive = p.id === currentProfile;
      const config = RISK_PROFILES[p.id];
      return `
        <button class="chip ${isActive ? 'active' : ''}"
                data-risk-profile="${p.id}"
                title="${config.name[lang]}">
          ${p.icon} ${p.label}
        </button>
      `;
    }).join('');

    return `
      <div class="allocation-risk-selector">
        <div class="section-label">${lang === 'en' ? 'Risk Profile' : '风险偏好'}</div>
        <div class="chip-group">${chips}</div>
      </div>
    `;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UI 渲染：资产分配面板
  // ═══════════════════════════════════════════════════════════════════════════

  const renderAllocationPanel = () => {
    const lang = getLang();
    const alloc = getAllocation();

    const buildingPct = Math.round(alloc.buildings * 100);
    const upgradePct = Math.round(alloc.upgrades * 100);
    const marginPct = Math.round(alloc.derivativesMargin * 100);

    const total = buildingPct + upgradePct + marginPct;

    return `
      <div class="allocation-panel">
        <div class="section-label">${lang === 'en' ? 'Asset Allocation' : '资产配置'}</div>
        <div class="allocation-sliders">
          <div class="slider-row">
            <label>
              <span class="slider-icon">🏭</span>
              ${lang === 'en' ? 'Buildings' : '建筑投资'}
            </label>
            <div class="slider-container">
              <input type="range" min="10" max="90" value="${buildingPct}"
                     data-allocation="buildings" class="allocation-slider">
              <span class="slider-value">${buildingPct}%</span>
            </div>
          </div>
          <div class="slider-row">
            <label>
              <span class="slider-icon">🔬</span>
              ${lang === 'en' ? 'Upgrades' : '升级研发'}
            </label>
            <div class="slider-container">
              <input type="range" min="5" max="80" value="${upgradePct}"
                     data-allocation="upgrades" class="allocation-slider">
              <span class="slider-value">${upgradePct}%</span>
            </div>
          </div>
          <div class="slider-row">
            <label>
              <span class="slider-icon">📊</span>
              ${lang === 'en' ? 'Margin Reserve' : '保证金预留'}
            </label>
            <div class="slider-container">
              <input type="range" min="5" max="50" value="${marginPct}"
                     data-allocation="margin" class="allocation-slider" disabled>
              <span class="slider-value">${marginPct}%</span>
            </div>
          </div>
        </div>
        <div class="allocation-total ${total === 100 ? 'valid' : 'invalid'}">
          ${lang === 'en' ? 'Total' : '合计'}：${total}% ${total === 100 ? '✓' : '⚠️'}
        </div>
      </div>
    `;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UI 渲染：统计信息面板
  // ═══════════════════════════════════════════════════════════════════════════

  const renderStatsPanel = () => {
    const lang = getLang();
    const stats = st.assetAllocation?.stats || {};
    const config = getConfig();

    const lastRebalance = stats.lastRebalanceAt
      ? new Date(stats.lastRebalanceAt).toLocaleTimeString()
      : '-';

    return `
      <div class="allocation-stats">
        <div class="stat-row">
          <span class="stat-label">${lang === 'en' ? 'Lambda' : '凸性系数'}</span>
          <span class="stat-value">${config.lambda.toFixed(2)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">${lang === 'en' ? 'Volatility' : '波动率'}</span>
          <span class="stat-value">×${config.volatilityScale.toFixed(1)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">${lang === 'en' ? 'Max Leverage' : '最大杠杆'}</span>
          <span class="stat-value">${config.maxLeverage}x</span>
        </div>
        ${config.crisisDampening > 0 ? `
        <div class="stat-row">
          <span class="stat-label">${lang === 'en' ? 'Crisis Dampening' : '危机减免'}</span>
          <span class="stat-value">-${(config.crisisDampening * 100).toFixed(0)}%</span>
        </div>
        ` : ''}
        <div class="stat-row">
          <span class="stat-label">${lang === 'en' ? 'Rebalances' : '再平衡次数'}</span>
          <span class="stat-value">${stats.totalRebalances || 0}</span>
        </div>
      </div>
    `;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 完整 UI 面板
  // ═══════════════════════════════════════════════════════════════════════════

  const renderFullPanel = () => {
    return `
      <div class="asset-allocation-container">
        ${renderRiskSelector()}
        ${renderAllocationPanel()}
        ${renderStatsPanel()}
      </div>
    `;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 事件绑定（供外部调用）
  // ═══════════════════════════════════════════════════════════════════════════

  const bindEvents = () => {
    // 风险偏好选择器点击
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-risk-profile]');
      if (chip) {
        const profile = chip.dataset.riskProfile;
        setRiskProfile(profile);

        // 更新 UI
        document.querySelectorAll('[data-risk-profile]').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.riskProfile === profile);
        });

        // 刷新统计面板
        const statsContainer = document.querySelector('.allocation-stats');
        if (statsContainer) {
          const temp = document.createElement('div');
          temp.innerHTML = renderStatsPanel();
          statsContainer.replaceWith(temp.firstElementChild);
        }
      }
    });

    // 分配滑块变化
    document.addEventListener('input', (e) => {
      const slider = e.target.closest('.allocation-slider');
      if (slider && !slider.disabled) {
        const type = slider.dataset.allocation;
        const value = parseInt(slider.value, 10);

        // 更新显示值
        const valueSpan = slider.parentElement.querySelector('.slider-value');
        if (valueSpan) valueSpan.textContent = `${value}%`;

        // 计算新分配
        const alloc = getAllocation();
        if (type === 'buildings') {
          // 剩余比例在升级和保证金之间分配
          const remaining = 100 - value;
          const upgradeRatio = alloc.upgrades / (alloc.upgrades + alloc.derivativesMargin || 1);
          const newUpgrade = Math.round(remaining * upgradeRatio);
          const newMargin = remaining - newUpgrade;
          setAllocation({ buildings: value / 100, upgrades: newUpgrade / 100 });
        } else if (type === 'upgrades') {
          const remaining = 100 - value;
          const marginRatio = alloc.derivativesMargin / (alloc.buildings + alloc.derivativesMargin || 1);
          const newMargin = Math.round(remaining * marginRatio);
          const newBuildings = remaining - newMargin;
          setAllocation({ buildings: newBuildings / 100, upgrades: value / 100 });
        }

        // 更新保证金滑块显示
        const newAlloc = getAllocation();
        const marginSlider = document.querySelector('.allocation-slider[data-allocation="margin"]');
        if (marginSlider) {
          const marginValueSpan = marginSlider.parentElement.querySelector('.slider-value');
          if (marginValueSpan) marginValueSpan.textContent = `${Math.round(newAlloc.derivativesMargin * 100)}%`;
        }

        // 更新总合计
        updateTotalDisplay();
      }
    });
  };

  // 更新总合计显示
  const updateTotalDisplay = () => {
    const alloc = getAllocation();
    const total = Math.round(alloc.buildings * 100) + Math.round(alloc.upgrades * 100) + Math.round(alloc.derivativesMargin * 100);
    const totalEl = document.querySelector('.allocation-total');
    if (totalEl) {
      totalEl.textContent = `${total === 100 ? '✓' : '⚠️'} ${total}%`;
      totalEl.className = `allocation-total ${total === 100 ? 'valid' : 'invalid'}`;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════════════════

  const init = () => {
    initAllocationData();

    // 绑定 UI 事件（仅在浏览器环境）
    if (typeof document !== 'undefined') {
      bindEvents();
    }

    // 触发初始事件（但不重新计算——只在变化时触发）
    // 不发送初始事件，避免游戏开始时触发不必要的缓存失效
    const lang = getLang();
    const config = getConfig();
    pushLog(`${config.icon} ${lang === 'en' ? 'Asset Allocation ready' : '资产配置就绪'}（${config.name[lang]}）`);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 导出接口
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // 初始化
    init,

    // 风险偏好
    setRiskProfile,
    getRiskProfile,
    getConfig,
    getLambda,
    getVolatilityScale,
    getMaxLeverage,
    getCrisisDampening,

    // 资产分配
    setAllocation,
    getAllocation,
    getBudgetSplit,

    // ROI 调试
    getAdjustedROI,

    // UI 渲染
    renderRiskSelector,
    renderAllocationPanel,
    renderStatsPanel,
    renderFullPanel,
  };
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createAssetAllocationSystem };
}