/**
 * 全球化市场系统 (Global Market System) - P6-T3
 *
 * 功能：多地区市场、跨地区套利、地区特定事件
 * 机制：
 * 1. 多地区市场：亚洲、欧洲、美洲，不同时区和波动率
 * 2. 跨地区套利：检测价格差异，赚取套利收益
 * 3. 地区特定事件：各地区的特殊宏观事件
 */

const createGlobalMarketSystem = ({
  st,
  market,
  eventBus,
  pushLog,
  I18N,
}) => {
  // 获取当前语言
  const getLang = () => (typeof I18N !== 'undefined' ? I18N.getCurrentLang() : 'zh');

  // ═══════════════════════════════════════════════════════════════════════════
  // 数据存储
  // ═══════════════════════════════════════════════════════════════════════════

  const initGlobalMarketData = () => {
    if (!st.globalMarket) {
      st.globalMarket = {
        // 当前激活的地区
        activeRegion: 'asia',
        // 地区数据
        regions: {},
        // 套利记录
        arbitrage: {
          enabled: false,
          cooldownEnd: 0,
          dailyLimit: 5,
          todayCount: 0,
          lastReset: Date.now(),
        },
        // 跨地区投资
        investments: {},
        // 统计
        stats: {
          totalArbitrageProfit: 0,
          totalArbitrageTrades: 0,
          regionSwitches: 0,
        },
      };
    }

    // 初始化各地区数据
    const regionIds = ['asia', 'europe', 'america'];
    regionIds.forEach(id => {
      if (!st.globalMarket.regions[id]) {
        st.globalMarket.regions[id] = createRegionData(id);
      }
    });
  };

  // 创建地区初始数据
  const createRegionData = (regionId) => {
    const basePrice = 100;
    return {
      id: regionId,
      price: basePrice,
      basePrice: basePrice,
      volatility: REGIONS[regionId].baseVolatility,
      trend: 'sideways', // bull | bear | sideways
      trendStrength: 0,
      event: null,
      eventEndTime: 0,
      lastUpdate: Date.now(),
      // 地区特定加成
      productionBonus: 1.0,
      investmentBonus: 1.0,
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 地区配置
  // ═══════════════════════════════════════════════════════════════════════════

  const REGIONS = {
    asia: {
      name: { zh: '亚洲市场', en: 'Asia Market' },
      timezone: 8,           // UTC+8
      baseVolatility: 1.2,   // 波动率 1.2x
      tradingHours: { start: 9, end: 15 }, // 交易时间 9:00-15:00
      characteristics: { zh: '高波动，科技驱动', en: 'High volatility, tech-driven' },
      primaryIndustry: 'technology',
    },
    europe: {
      name: { zh: '欧洲市场', en: 'Europe Market' },
      timezone: 0,           // UTC+0
      baseVolatility: 1.0,   // 波动率 1.0x
      tradingHours: { start: 8, end: 16 },
      characteristics: { zh: '稳定，金融主导', en: 'Stable, finance-led' },
      primaryIndustry: 'finance',
    },
    america: {
      name: { zh: '美洲市场', en: 'America Market' },
      timezone: -5,          // UTC-5 (EST)
      baseVolatility: 1.3,   // 波动率 1.3x
      tradingHours: { start: 9, end: 16 },
      characteristics: { zh: '最高波动，消费驱动', en: 'Highest volatility, consumer-led' },
      primaryIndustry: 'consumption',
    },
  };

  // 地区特定事件
  const REGIONAL_EVENTS = {
    asia: [
      { id: 'tech_boom', name: { zh: '科技繁荣', en: 'Tech Boom' }, probability: 0.1, duration: 300, effect: { productionBonus: 1.3, volatility: 1.5 } },
      { id: 'currency_crisis', name: { zh: '货币危机', en: 'Currency Crisis' }, probability: 0.05, duration: 180, effect: { productionBonus: 0.7, volatility: 2.0 } },
      { id: 'trade_agreement', name: { zh: '贸易协定', en: 'Trade Agreement' }, probability: 0.08, duration: 600, effect: { investmentBonus: 1.2, volatility: 1.1 } },
    ],
    europe: {
  "id": "ecb_policy",
  "name": {
    "zh": "欧央行政策",
    "en": "ECB Policy"
  },
  "probability": 0.12,
  "duration": 400,
  "effect": {
    "investmentBonus": 1.15,
    "volatility": 0.9
  }
};
      { id: 'brexit_aftermath', name: { zh: '脱欧影响', en: 'Brexit Aftermath' }, probability: 0.04, duration: 240, effect: { productionBonus: 0.85, volatility: 1.4 } },
      { id: 'green_deal', name: { zh: '绿色协议', en: 'Green Deal' }, probability: 0.06, duration: 500, effect: { productionBonus: 1.1, investmentBonus: 1.1, volatility: 1.0 } },
    ],
    america: [
      { id: 'fed_rate', name: { zh: '美联储加息', en: 'Fed Rate Hike' }, probability: 0.1, duration: 360, effect: { investmentBonus: 1.2, volatility: 1.3 } },
      { id: 'tech_ipo', name: { zh: '科技股IPO', en: 'Tech IPO' }, probability: 0.07, duration: 300, effect: { productionBonus: 1.25, volatility: 1.4 } },
      { id: 'recession_fear', name: { zh: '衰退恐慌', en: 'Recession Fear' }, probability: 0.05, duration: 200, effect: { productionBonus: 0.75, investmentBonus: 0.8, volatility: 1.8 } },
    ],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 核心逻辑
  // ═══════════════════════════════════════════════════════════════════════════

  // 获取当前地区
  const getCurrentRegion = () => st.globalMarket.activeRegion;

  // 切换地区
  const switchRegion = (regionId) => {
    const lang = getLang();

    if (!REGIONS[regionId]) {
      return { success: false, error: lang === 'en' ? 'Invalid region' : '无效的地区' };
    }

    if (st.globalMarket.activeRegion === regionId) {
      return { success: false, error: lang === 'en' ? 'Already in this region' : '已经在该地区' };
    }

    const prevRegion = st.globalMarket.activeRegion;
    st.globalMarket.activeRegion = regionId;
    st.globalMarket.stats.regionSwitches++;

    // 触发切换事件
    eventBus.emit('region:switched', { from: prevRegion, to: regionId });

    const regionName = REGIONS[regionId].name[lang];
    pushLog(lang === 'en'
      ? `🌍 Switched to ${regionName}`
      : `🌍 切换至${regionName}`
    );

    return { success: true, region: regionId };
  };

  // 更新地区价格
  const updateRegionPrices = () => {
    const now = Date.now();

    Object.keys(st.globalMarket.regions).forEach(regionId => {
      const region = st.globalMarket.regions[regionId];
      const config = REGIONS[regionId];

      // 检查地区事件
      if (region.event && region.eventEndTime <= now) {
        // 事件结束
        region.event = null;
        region.productionBonus = 1.0;
        region.investmentBonus = 1.0;
        region.volatility = config.baseVolatility;
        eventBus.emit('region:eventEnded', { region: regionId });
      }

      // 模拟价格波动 (随机游走)
      const timeDiff = (now - region.lastUpdate) / 1000; // 秒
      const volatility = region.volatility * 0.001; // 基础波动率
      const randomWalk = (Math.random() - 0.5) * volatility * timeDiff;

      // 趋势影响
      let trendEffect = 0;
      if (region.trend === 'bull') trendEffect = 0.0002 * timeDiff;
      else if (region.trend === 'bear') trendEffect = -0.0002 * timeDiff;

      // 更新价格
      region.price = Math.max(50, region.price * (1 + randomWalk + trendEffect));
      region.lastUpdate = now;

      // 随机更新趋势
      if (Math.random() < 0.001 * timeDiff) {
        const trends = ['bull', 'bear', 'sideways'];
        region.trend = trends[Math.floor(Math.random() * trends.length)];
        region.trendStrength = Math.random();
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 地区事件系统
  // ═══════════════════════════════════════════════════════════════════════════

  const triggerRandomEvent = () => {
    const now = Date.now();

    Object.keys(REGIONS).forEach(regionId => {
      const region = st.globalMarket.regions[regionId];
      const events = REGIONAL_EVENTS[regionId];

      // 如果已有事件，跳过
      if (region.event) return;

      // 随机触发事件
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      if (Math.random() < randomEvent.probability / 3600) { // 按秒概率
        applyEvent(regionId, randomEvent);
      }
    });
  };

  const applyEvent = (regionId, eventData) => {
    const region = st.globalMarket.regions[regionId];
    const now = Date.now();

    region.event = eventData;
    region.eventEndTime = now + eventData.duration * 1000;

    // 应用事件效果
    if (eventData.effect.productionBonus) {
      region.productionBonus = eventData.effect.productionBonus;
    }
    if (eventData.effect.investmentBonus) {
      region.investmentBonus = eventData.effect.investmentBonus;
    }
    if (eventData.effect.volatility) {
      region.volatility = eventData.effect.volatility;
    }

    // 触发事件
    eventBus.emit('region:eventStarted', { region: regionId, event: eventData });

    const lang = getLang();
    pushLog(lang === 'en'
      ? `📢 ${REGIONS[regionId].name.en}: ${eventData.name.en} started!`
      : `📢 ${REGIONS[regionId].name.zh}: ${eventData.name.zh}开始！`
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 跨地区套利系统
  // ═══════════════════════════════════════════════════════════════════════════

  const ARBITRAGE_CONFIG = {
    minPriceDiff: 0.05,      // 最小价差 5%
    maxDailyTrades: 5,       // 每日最大套利次数
    cooldown: 60,            // 冷却时间 60秒
    feeRate: 0.005,          // 手续费 0.5%
  };

  // 检测套利机会
  const detectArbitrageOpportunities = () => {
    const opportunities = [];
    const regions = st.globalMarket.regions;

    const regionIds = Object.keys(regions);
    for (let i = 0; i < regionIds.length; i++) {
      for (let j = i + 1; j < regionIds.length; j++) {
        const r1 = regionIds[i];
        const r2 = regionIds[j];
        const price1 = regions[r1].price;
        const price2 = regions[r2].price;

        const diff = Math.abs(price1 - price2) / Math.min(price1, price2);

        if (diff >= ARBITRAGE_CONFIG.minPriceDiff) {
          const buyRegion = price1 < price2 ? r1 : r2;
          const sellRegion = price1 < price2 ? r2 : r1;
          const profit = Math.abs(price1 - price2) * (1 - ARBITRAGE_CONFIG.feeRate);

          opportunities.push({
            buyRegion,
            sellRegion,
            priceDiff: diff,
            potentialProfit: profit,
            timestamp: Date.now(),
          });
        }
      }
    }

    return opportunities.sort((a, b) => b.priceDiff - a.priceDiff);
  };

  // 执行套利
  const executeArbitrage = (opportunity, amount) => {
    const lang = getLang();
    const now = Date.now();
    const arb = st.globalMarket.arbitrage;

    // 检查冷却
    if (now < arb.cooldownEnd) {
      return { success: false, error: lang === 'en' ? 'Cooldown active' : '冷却中' };
    }

    // 检查日限额
    if (now - arb.lastReset > 24 * 60 * 60 * 1000) {
      arb.todayCount = 0;
      arb.lastReset = now;
    }
    if (arb.todayCount >= arb.dailyLimit) {
      return { success: false, error: lang === 'en' ? 'Daily limit reached' : '已达日限额' };
    }

    // 检查资金
    if (st.money < amount) {
      return { success: false, error: lang === 'en' ? 'Insufficient funds' : '资金不足' };
    }

    // 扣除资金
    st.money -= amount;

    // 计算收益
    const fee = amount * ARBITRAGE_CONFIG.feeRate;
    const profit = amount * opportunity.priceDiff - fee;
    const totalReturn = amount + profit;

    // 返还资金
    st.money += totalReturn;

    // 更新统计
    arb.todayCount++;
    arb.cooldownEnd = now + ARBITRAGE_CONFIG.cooldown * 1000;
    st.globalMarket.stats.totalArbitrageTrades++;
    st.globalMarket.stats.totalArbitrageProfit += profit;

    // 触发事件
    eventBus.emit('arbitrage:executed', { opportunity, amount, profit });

    pushLog(lang === 'en'
      ? `💱 Arbitrage: Bought in ${REGIONS[opportunity.buyRegion].name.en}, sold in ${REGIONS[opportunity.sellRegion].name.en}. Profit: ${formatNumber(profit)}`
      : `💱 套利交易: 在${REGIONS[opportunity.buyRegion].name.zh}买入，在${REGIONS[opportunity.sellRegion].name.zh}卖出。收益: ${formatNumber(profit)}`
    );

    return { success: true, profit, fee };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 跨地区投资
  // ═══════════════════════════════════════════════════════════════════════════

  const investInRegion = (regionId, amount) => {
    const lang = getLang();

    if (!REGIONS[regionId]) {
      return { success: false, error: lang === 'en' ? 'Invalid region' : '无效的地区' };
    }

    if (st.money < amount) {
      return { success: false, error: lang === 'en' ? 'Insufficient funds' : '资金不足' };
    }

    // 扣除资金
    st.money -= amount;

    // 记录投资
    if (!st.globalMarket.investments[regionId]) {
      st.globalMarket.investments[regionId] = 0;
    }
    st.globalMarket.investments[regionId] += amount;

    eventBus.emit('region:invested', { region: regionId, amount });

    const regionName = REGIONS[regionId].name[lang];
    pushLog(lang === 'en'
      ? `💰 Invested ${formatNumber(amount)} in ${regionName}`
      : `💰 向${regionName}投资 ${formatNumber(amount)}`
    );

    return { success: true, region: regionId, amount };
  };

  // 计算投资收益
  const calculateInvestmentReturns = () => {
    const now = Date.now();
    let totalReturn = 0;

    Object.keys(st.globalMarket.investments).forEach(regionId => {
      const investment = st.globalMarket.investments[regionId];
      if (investment <= 0) return;

      const region = st.globalMarket.regions[regionId];
      const bonus = region.investmentBonus;

      // 每秒收益 0.1% * 地区加成
      const returnRate = 0.001 * bonus;
      const secondsElapsed = 1; // 每秒调用
      const returns = investment * returnRate * secondsElapsed;

      st.money += returns;
      totalReturn += returns;
    });

    return totalReturn;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 获取地区加成
  // ═══════════════════════════════════════════════════════════════════════════

  const getRegionBonus = () => {
    const currentRegionId = getCurrentRegion();
    const region = st.globalMarket.regions[currentRegionId];

    return {
      productionMultiplier: region.productionBonus,
      investmentMultiplier: region.investmentBonus,
      volatilityMultiplier: region.volatility / REGIONS[currentRegionId].baseVolatility,
      regionName: REGIONS[currentRegionId].name,
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 更新循环
  // ═══════════════════════════════════════════════════════════════════════════

  const update = () => {
    // 更新地区价格
    updateRegionPrices();

    // 触发随机事件
    triggerRandomEvent();

    // 计算投资收益
    calculateInvestmentReturns();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 查询接口
  // ═══════════════════════════════════════════════════════════════════════════

  const getRegionData = (regionId) => st.globalMarket.regions[regionId];

  const getAllRegions = () => Object.keys(REGIONS).map(id => ({
    id,
    ...REGIONS[id],
    data: st.globalMarket.regions[id],
  }));

  const getArbitrageStatus = () => ({
    ...st.globalMarket.arbitrage,
    opportunities: detectArbitrageOpportunities(),
  });

  const getInvestments = () => st.globalMarket.investments;

  const getStats = () => st.globalMarket.stats;

  // ═══════════════════════════════════════════════════════════════════════════
  // UI 渲染
  // ═══════════════════════════════════════════════════════════════════════════

  const renderRegionPanel = () => {
    const lang = getLang();
    const currentRegionId = getCurrentRegion();
    const currentRegion = st.globalMarket.regions[currentRegionId];
    const bonus = getRegionBonus();

    const regionsHtml = getAllRegions().map(r => {
      const isActive = r.id === currentRegionId;
      const hasEvent = r.data.event ? 'event-active' : '';
      const trendIcon = r.data.trend === 'bull' ? '📈' : r.data.trend === 'bear' ? '📉' : '➡️';

      return `
        <div class="region-item ${isActive ? 'active' : ''} ${hasEvent}" data-region="${r.id}">
          <div class="region-header">
            <span class="region-name">${trendIcon} ${r.name[lang]}</span>
            <span class="region-price">${formatNumber(r.data.price)}</span>
          </div>
          <div class="region-info">
            <span class="region-bonus">${lang === 'en' ? 'Prod' : '生产'}: ${(r.data.productionBonus * 100).toFixed(0)}%</span>
            <span class="region-bonus">${lang === 'en' ? 'Inv' : '投资'}: ${(r.data.investmentBonus * 100).toFixed(0)}%</span>
          </div>
          ${r.data.event ? `<div class="region-event">📢 ${r.data.event.name[lang]}</div>` : ''}
          ${!isActive ? `<button class="switch-region-btn" data-region="${r.id}">${lang === 'en' ? 'Switch' : '切换'}</button>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="global-market-panel region-panel">
        <h3>${lang === 'en' ? '🌍 Global Markets' : '🌍 全球市场'}</h3>
        <div class="current-region-info">
          <span>${lang === 'en' ? 'Current' : '当前'}: ${REGIONS[currentRegionId].name[lang]}</span>
          <span class="bonus-tag">${lang === 'en' ? 'Production' : '生产加成'}: ${(bonus.productionMultiplier * 100).toFixed(0)}%</span>
        </div>
        <div class="regions-list">
          ${regionsHtml}
        </div>
      </div>
    `;
  };

  const renderArbitragePanel = () => {
    const lang = getLang();
    const opportunities = detectArbitrageOpportunities();
    const arb = st.globalMarket.arbitrage;

    const opportunitiesHtml = opportunities.slice(0, 3).map((opp, idx) => `
      <div class="arbitrage-item">
        <div class="arbitrage-regions">
          <span>${REGIONS[opp.buyRegion].name[lang]} → ${REGIONS[opp.sellRegion].name[lang]}</span>
        </div>
        <div class="arbitrage-diff">+${(opp.priceDiff * 100).toFixed(1)}%</div>
        <button class="arbitrage-btn" data-idx="${idx}">${lang === 'en' ? 'Trade' : '交易'}</button>
      </div>
    `).join('');

    const remainingTrades = arb.dailyLimit - arb.todayCount;
    const cooldownSec = Math.max(0, Math.ceil((arb.cooldownEnd - Date.now()) / 1000));

    return `
      <div class="global-market-panel arbitrage-panel">
        <h3>${lang === 'en' ? '💱 Arbitrage' : '💱 套利机会'}</h3>
        <div class="arbitrage-status">
          <span>${lang === 'en' ? 'Today' : '今日剩余'}: ${remainingTrades}</span>
          ${cooldownSec > 0 ? `<span>${lang === 'en' ? 'CD' : '冷却'}: ${cooldownSec}s</span>` : ''}
        </div>
        <div class="arbitrage-list">
          ${opportunitiesHtml || (lang === 'en' ? 'No opportunities' : '暂无套利机会')}
        </div>
      </div>
    `;
  };

  const renderInvestmentPanel = () => {
    const lang = getLang();
    const investments = getInvestments();

    const investmentHtml = Object.keys(REGIONS).map(regionId => {
      const amount = investments[regionId] || 0;
      const region = st.globalMarket.regions[regionId];
      const returnRate = (0.001 * region.investmentBonus * 100).toFixed(2);

      return `
        <div class="investment-item">
          <span class="investment-region">${REGIONS[regionId].name[lang]}</span>
          <span class="investment-amount">${formatNumber(amount)}</span>
          <span class="investment-rate">${returnRate}%/s</span>
        </div>
      `;
    }).join('');

    const totalInvestment = Object.values(investments).reduce((sum, val) => sum + val, 0);

    return `
      <div class="global-market-panel investment-panel">
        <h3>${lang === 'en' ? '💰 Investments' : '💰 跨地区投资'}</h3>
        <div class="investment-total">${lang === 'en' ? 'Total' : '总投资'}: ${formatNumber(totalInvestment)}</div>
        <div class="investment-list">
          ${investmentHtml}
        </div>
      </div>
    `;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════════════════

  const init = () => {
    initGlobalMarketData();

    // 定期更新
    setInterval(update, 1000); // 每秒更新
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 导出接口
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // 初始化
    init,
    update,

    // 地区操作
    switchRegion,
    getCurrentRegion,
    getRegionData,
    getAllRegions,
    getRegionBonus,

    // 套利
    detectArbitrageOpportunities,
    executeArbitrage,
    getArbitrageStatus,

    // 投资
    investInRegion,
    getInvestments,

    // 查询
    getStats,

    // UI
    renderRegionPanel,
    renderArbitragePanel,
    renderInvestmentPanel,
  };
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createGlobalMarketSystem };
}

// 辅助函数：数字格式化
function formatNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}
