/**
 * 特权订阅系统 (Subscription System) - P7-T3
 *
 * 功能：订阅会员服务，提供持续加成和特权
 * 机制：
 * 1. 三档订阅：白银/黄金/钻石
 * 2. 持续权益：GPS加成、离线加成、每日奖励等
 * 3. 特权功能：去广告、云存档、优先支持等
 * 4. 订阅管理：订阅、续费、取消
 */

const createSubscriptionSystem = ({
  st,
  eventBus,
  pushLog,
  I18N,
}) => {
  // 获取当前语言
  const getLang = () => (typeof I18N !== 'undefined' ? I18N.getCurrentLang() : 'zh');

  // ═══════════════════════════════════════════════════════════════════════════
  // 数据存储
  // ═══════════════════════════════════════════════════════════════════════════

  const initSubscriptionData = () => {
    if (!st.subscription) {
      st.subscription = {
        // 当前订阅等级
        tier: null,
        // 订阅开始时间
        startedAt: null,
        // 订阅过期时间
        expiresAt: null,
        // 自动续费
        autoRenew: false,
        // 订阅历史
        history: [],
        // 累计订阅天数
        totalDays: 0,
        // 本月已领取的奖励
        monthlyRewardsClaimed: {},
      };
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 订阅等级配置
  // ═══════════════════════════════════════════════════════════════════════════

  const TIERS = {
    silver: {
      id: 'silver',
      name: { zh: '白银会员', en: 'Silver' },
      description: { zh: '适合休闲玩家的超值选择', en: 'Great value for casual players' },
      price: {
        monthly: 4.99,
        yearly: 39.99,
        yearlyDiscount: 0.33, // 年付省33%
      },
      currency: 'USD',
      color: '#C0C0C0',
      icon: '🥈',
      benefits: [
        { id: 'no_ads', name: { zh: '移除广告', en: 'No Ads' }, icon: '🚫' },
        { id: 'daily_double', name: { zh: '每日双倍奖励', en: 'Daily Double Rewards' }, icon: '2️⃣' },
        { id: 'exclusive_skin', name: { zh: '专属皮肤', en: 'Exclusive Skin' }, icon: '🎨' },
        { id: 'cloud_save', name: { zh: '云存档', en: 'Cloud Save' }, icon: '☁️' },
      ],
      bonuses: {
        gpsBonus: 0.10,        // +10% GPS
        offlineBonus: 0.20,    // +20% 离线收益
        dailyBonus: 2,         // 双倍每日奖励
        researchBonus: 0.10,   // +10% 研究点获取
      },
      privileges: {
        maxSavedBuilds: 3,     // 最多保存3套建筑配置
        prioritySupport: false,
        betaAccess: false,
      },
    },

    gold: {
      id: 'gold',
      name: { zh: '黄金会员', en: 'Gold' },
      description: { zh: '为活跃玩家设计的进阶体验', en: 'Advanced experience for active players' },
      price: {
        monthly: 9.99,
        yearly: 79.99,
        yearlyDiscount: 0.33,
      },
      currency: 'USD',
      color: '#FFD700',
      icon: '🥇',
      popular: true,
      benefits: [
        { id: 'all_silver', name: { zh: '白银会员所有权益', en: 'All Silver benefits' }, icon: '✅' },
        { id: 'monthly_pack', name: { zh: '每月免费道具包', en: 'Monthly Free Boost Pack' }, icon: '🎁' },
        { id: 'priority_support', name: { zh: '优先客服支持', en: 'Priority Support' }, icon: '🎧' },
        { id: 'beta_access', name: { zh: 'Beta 测试资格', en: 'Beta Access' }, icon: '🔬' },
      ],
      bonuses: {
        gpsBonus: 0.25,        // +25% GPS
        offlineBonus: 0.50,    // +50% 离线收益
        dailyBonus: 3,         // 三倍每日奖励
        researchBonus: 0.25,   // +25% 研究点获取
        autoBuyer: true,       // 免费自动购买
        crisisImmunity: 0.5,   // 50% 危机伤害减免
      },
      privileges: {
        maxSavedBuilds: 5,
        prioritySupport: true,
        betaAccess: true,
      },
      monthlyReward: {
        items: ['time_warp_8h', 'double_gps_24h', 'research_pack_medium'],
        rp: 500,
      },
    },

    diamond: {
      id: 'diamond',
      name: { zh: '钻石会员', en: 'Diamond' },
      description: { zh: '为硬核玩家打造的至尊体验', en: 'Ultimate experience for hardcore players' },
      price: {
        monthly: 19.99,
        yearly: 149.99,
        yearlyDiscount: 0.37,
      },
      currency: 'USD',
      color: '#B9F2FF',
      icon: '💎',
      bestValue: true,
      benefits: [
        { id: 'all_gold', name: { zh: '黄金会员所有权益', en: 'All Gold benefits' }, icon: '✅' },
        { id: 'weekly_events', name: { zh: '每周专属活动', en: 'Weekly Exclusive Events' }, icon: '🎯' },
        { id: 'custom_skin', name: { zh: '定制皮肤', en: 'Custom Skin Design' }, icon: '🎨' },
        { id: 'dev_contact', name: { zh: '开发者直接联系', en: 'Direct Developer Contact' }, icon: '👨‍💻' },
      ],
      bonuses: {
        gpsBonus: 0.50,        // +50% GPS
        offlineBonus: 1.00,    // +100% 离线收益
        dailyBonus: 5,         // 五倍每日奖励
        researchBonus: 0.50,   // +50% 研究点获取
        autoBuyer: true,
        crisisImmunity: 1.0,   // 100% 免疫危机
        buildingDiscount: 0.10, // 建筑成本-10%
      },
      privileges: {
        maxSavedBuilds: 10,
        prioritySupport: true,
        betaAccess: true,
        customSkin: true,
        devContact: true,
      },
      monthlyReward: {
        items: ['time_warp_24h', 'double_gps_24h', 'auto_buyer_7d', 'research_pack_large'],
        rp: 2000,
      },
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 订阅状态查询
  // ═══════════════════════════════════════════════════════════════════════════

  const getSubscriptionStatus = () => {
    const now = Date.now();

    if (!st.subscription.tier || !st.subscription.expiresAt) {
      return {
        active: false,
        tier: null,
        daysRemaining: 0,
        isExpired: false,
      };
    }

    const active = st.subscription.expiresAt > now;
    const daysRemaining = active
      ? Math.ceil((st.subscription.expiresAt - now) / (24 * 60 * 60 * 1000))
      : 0;

    return {
      active,
      tier: st.subscription.tier,
      startedAt: st.subscription.startedAt,
      expiresAt: st.subscription.expiresAt,
      daysRemaining,
      isExpired: !active,
      autoRenew: st.subscription.autoRenew,
      totalDays: st.subscription.totalDays,
    };
  };

  const isSubscribed = () => {
    const status = getSubscriptionStatus();
    return status.active;
  };

  const getCurrentTier = () => {
    const status = getSubscriptionStatus();
    return status.active ? status.tier : null;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 订阅操作
  // ═══════════════════════════════════════════════════════════════════════════

  const subscribe = async (tierId, billingCycle = 'monthly') => {
    const lang = getLang();
    const tier = TIERS[tierId];

    if (!tier) {
      return { success: false, error: lang === 'en' ? 'Invalid tier' : '无效等级' };
    }

    const price = tier.price[billingCycle];

    try {
      // 模拟支付流程
      console.log(`Processing subscription: ${tier.name[lang]} - $${price}/${billingCycle}`);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 模拟支付成功（98%成功率）
      if (Math.random() > 0.02) {
        const now = Date.now();
        const durationMs = billingCycle === 'yearly'
          ? 365 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

        // 保存历史
        if (st.subscription.tier) {
          st.subscription.history.push({
            tier: st.subscription.tier,
            startedAt: st.subscription.startedAt,
            endedAt: now,
          });
        }

        // 更新订阅
        st.subscription.tier = tierId;
        st.subscription.startedAt = now;
        st.subscription.expiresAt = now + durationMs;
        st.subscription.autoRenew = true;
        st.subscription.totalDays += (billingCycle === 'yearly' ? 365 : 30);

        // 触发事件
        eventBus.emit('subscription:subscribed', {
          tier: tierId,
          billingCycle,
          price,
          expiresAt: st.subscription.expiresAt,
        });

        pushLog(lang === 'en'
          ? `🎉 Subscribed to ${tier.name.en}! Welcome to the premium experience!`
          : `🎉 成功订阅${tier.name.zh}！欢迎体验高级会员服务！`
        );

        return { success: true, tier, expiresAt: st.subscription.expiresAt };
      } else {
        throw new Error('Payment failed');
      }
    } catch (error) {
      return { success: false, error: lang === 'en' ? 'Subscription failed' : '订阅失败' };
    }
  };

  const cancelSubscription = () => {
    const lang = getLang();
    const status = getSubscriptionStatus();

    if (!status.active) {
      return { success: false, error: lang === 'en' ? 'Not subscribed' : '未订阅' };
    }

    st.subscription.autoRenew = false;

    eventBus.emit('subscription:cancelled', {
      tier: status.tier,
      expiresAt: status.expiresAt,
    });

    pushLog(lang === 'en'
      ? `⚠️ Subscription cancelled. You still have ${status.daysRemaining} days remaining.`
      : `⚠️ 订阅已取消。你还有 ${status.daysRemaining} 天的会员权益。`
    );

    return { success: true, daysRemaining: status.daysRemaining };
  };

  const renewSubscription = async () => {
    const lang = getLang();
    const status = getSubscriptionStatus();

    if (!status.tier) {
      return { success: false, error: lang === 'en' ? 'No subscription to renew' : '没有可续费的订阅' };
    }

    // 自动按月续费
    return subscribe(status.tier, 'monthly');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 权益与加成
  // ═══════════════════════════════════════════════════════════════════════════

  const getSubscriptionBonuses = () => {
    const status = getSubscriptionStatus();

    if (!status.active) {
      return {
        gpsBonus: 0,
        offlineBonus: 0,
        dailyBonus: 1,
        researchBonus: 0,
        autoBuyer: false,
        crisisImmunity: 0,
        buildingDiscount: 0,
      };
    }

    const tier = TIERS[status.tier];
    return tier.bonuses;
  };

  const getSubscriptionPrivileges = () => {
    const status = getSubscriptionStatus();

    if (!status.active) {
      return {
        noAds: false,
        cloudSave: false,
        prioritySupport: false,
        betaAccess: false,
        maxSavedBuilds: 1,
      };
    }

    const tier = TIERS[status.tier];
    return {
      noAds: true,
      cloudSave: tier.privileges.cloudSave,
      prioritySupport: tier.privileges.prioritySupport,
      betaAccess: tier.privileges.betaAccess,
      customSkin: tier.privileges.customSkin || false,
      devContact: tier.privileges.devContact || false,
      maxSavedBuilds: tier.privileges.maxSavedBuilds,
    };
  };

  // 获取总GPS加成
  const getTotalGPSBonus = () => {
    const bonuses = getSubscriptionBonuses();
    return 1 + (bonuses.gpsBonus || 0);
  };

  // 获取离线收益加成
  const getOfflineBonus = () => {
    const bonuses = getSubscriptionBonuses();
    return 1 + (bonuses.offlineBonus || 0);
  };

  // 检查是否有广告
  const hasAds = () => {
    const privileges = getSubscriptionPrivileges();
    return !privileges.noAds;
  };

  // 检查危机免疫
  const getCrisisImmunity = () => {
    const bonuses = getSubscriptionBonuses();
    return bonuses.crisisImmunity || 0;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 月度奖励
  // ═══════════════════════════════════════════════════════════════════════════

  const claimMonthlyReward = () => {
    const lang = getLang();
    const status = getSubscriptionStatus();

    if (!status.active) {
      return { success: false, error: lang === 'en' ? 'Not subscribed' : '未订阅' };
    }

    const tier = TIERS[status.tier];
    if (!tier.monthlyReward) {
      return { success: false, error: lang === 'en' ? 'No monthly reward for this tier' : '该等级没有月度奖励' };
    }

    // 检查本月是否已领取
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

    if (st.subscription.monthlyRewardsClaimed[monthKey]) {
      return { success: false, error: lang === 'en' ? 'Already claimed this month' : '本月已领取' };
    }

    // 发放奖励
    const reward = tier.monthlyReward;

    // 添加道具到背包
    if (reward.items && st.boost) {
      reward.items.forEach(itemId => {
        st.boost.inventory[itemId] = (st.boost.inventory[itemId] || 0) + 1;
      });
    }

    // 添加研究点
    if (reward.rp) {
      st.rp = (st.rp || 0) + reward.rp;
    }

    // 标记已领取
    st.subscription.monthlyRewardsClaimed[monthKey] = true;

    eventBus.emit('subscription:monthlyRewardClaimed', {
      tier: status.tier,
      reward,
    });

    pushLog(lang === 'en'
      ? `🎁 Monthly reward claimed! Received ${reward.items.length} items and ${reward.rp} RP!`
      : `🎁 月度奖励已领取！获得 ${reward.items.length} 个道具和 ${reward.rp} 研究点！`
    );

    return { success: true, reward };
  };

  // 检查是否可以领取月度奖励
  const canClaimMonthlyReward = () => {
    const status = getSubscriptionStatus();
    if (!status.active) return false;

    const tier = TIERS[status.tier];
    if (!tier.monthlyReward) return false;

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

    return !st.subscription.monthlyRewardsClaimed[monthKey];
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 订阅更新检查
  // ═══════════════════════════════════════════════════════════════════════════

  const update = () => {
    const status = getSubscriptionStatus();

    // 检查是否过期且自动续费
    if (status.isExpired && st.subscription.autoRenew && status.tier) {
      // 尝试自动续费
      renewSubscription();
    }

    // 检查订阅即将过期（7天内）
    if (status.active && status.daysRemaining <= 7 && status.daysRemaining > 0) {
      // 可以在这里添加提醒逻辑
      const lastReminded = st.subscription.lastExpiryReminder;
      const now = Date.now();

      if (!lastReminded || now - lastReminded > 24 * 60 * 60 * 1000) {
        const lang = getLang();
        pushLog(lang === 'en'
          ? `⏰ Your subscription expires in ${status.daysRemaining} days. Don't forget to renew!`
          : `⏰ 你的订阅将在 ${status.daysRemaining} 天后过期，别忘了续费！`
        );
        st.subscription.lastExpiryReminder = now;
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 查询接口
  // ═══════════════════════════════════════════════════════════════════════════

  const getAllTiers = () => Object.values(TIERS).map(tier => ({
    id: tier.id,
    name: tier.name,
    description: tier.description,
    price: tier.price,
    color: tier.color,
    icon: tier.icon,
    popular: tier.popular,
    bestValue: tier.bestValue,
    benefits: tier.benefits,
    bonuses: tier.bonuses,
  }));

  const getTierInfo = (tierId) => {
    const tier = TIERS[tierId];
    if (!tier) return null;

    return {
      id: tier.id,
      name: tier.name,
      description: tier.description,
      price: tier.price,
      color: tier.color,
      icon: tier.icon,
      benefits: tier.benefits,
      bonuses: tier.bonuses,
      privileges: tier.privileges,
      monthlyReward: tier.monthlyReward,
    };
  };

  const getStats = () => ({
    totalDays: st.subscription.totalDays,
    historyCount: st.subscription.history.length,
    autoRenew: st.subscription.autoRenew,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UI 渲染
  // ═══════════════════════════════════════════════════════════════════════════

  const renderSubscriptionPanel = () => {
    const lang = getLang();
    const status = getSubscriptionStatus();

    if (!status.active) {
      // 显示订阅选项
      let html = `
        <div class="subscription-panel not-subscribed">
          <h3>${lang === 'en' ? '💎 Upgrade Your Experience' : '💎 升级你的体验'}</h3>
          <p class="subscription-intro">${lang === 'en' ? 'Choose a plan that fits your play style' : '选择适合你游戏风格的订阅方案'}</p>
          <div class="tiers-grid">
      `;

      Object.values(TIERS).forEach(tier => {
        const popularTag = tier.popular ? `<span class="tag popular">${lang === 'en' ? 'POPULAR' : '热门'}</span>` : '';
        const bestValueTag = tier.bestValue ? `<span class="tag best-value">${lang === 'en' ? 'BEST VALUE' : '最超值'}</span>` : '';

        html += `
          <div class="tier-card ${tier.id}" style="border-color: ${tier.color}">
            <div class="tier-header" style="background: ${tier.color}20">
              <span class="tier-icon">${tier.icon}</span>
              <span class="tier-name">${tier.name[lang]}</span>
              ${popularTag}${bestValueTag}
            </div>
            <div class="tier-price">
              <span class="monthly">$${tier.price.monthly}/${lang === 'en' ? 'month' : '月'}</span>
              <span class="yearly">$${tier.price.yearly}/${lang === 'en' ? 'year' : '年'} (${lang === 'en' ? 'Save' : '省'} ${(tier.price.yearlyDiscount * 100).toFixed(0)}%)</span>
            </div>
            <div class="tier-description">${tier.description[lang]}</div>
            <ul class="tier-benefits">
              ${tier.benefits.map(b => `<li>${b.icon} ${b.name[lang]}</li>`).join('')}
            </ul>
            <div class="tier-bonuses">
              <span class="bonus">GPS +${(tier.bonuses.gpsBonus * 100).toFixed(0)}%</span>
              <span class="bonus">${lang === 'en' ? 'Offline' : '离线'} +${(tier.bonuses.offlineBonus * 100).toFixed(0)}%</span>
            </div>
            <button class="subscribe-btn" data-tier="${tier.id}">${lang === 'en' ? 'Subscribe' : '订阅'}</button>
          </div>
        `;
      });

      html += `</div></div>`;
      return html;
    }

    // 显示当前订阅状态
    const tier = TIERS[status.tier];

    return `
      <div class="subscription-panel active-subscription">
        <h3>${tier.icon} ${tier.name[lang]}</h3>
        <div class="subscription-status">
          <span class="status-badge active">${lang === 'en' ? 'Active' : '有效'}</span>
          <span class="days-remaining">${status.daysRemaining} ${lang === 'en' ? 'days remaining' : '天剩余'}</span>
        </div>
        <div class="subscription-bonuses">
          <h4>${lang === 'en' ? 'Active Bonuses' : '生效加成'}</h4>
          <div class="bonus-list">
            <span class="bonus-tag">GPS +${(tier.bonuses.gpsBonus * 100).toFixed(0)}%</span>
            <span class="bonus-tag">${lang === 'en' ? 'Offline' : '离线'} +${(tier.bonuses.offlineBonus * 100).toFixed(0)}%</span>
            <span class="bonus-tag">${lang === 'en' ? 'Daily' : '每日'} x${tier.bonuses.dailyBonus}</span>
          </div>
        </div>
        ${canClaimMonthlyReward() ? `
          <button class="claim-reward-btn" onclick="window.claimSubscriptionReward()">
            🎁 ${lang === 'en' ? 'Claim Monthly Reward' : '领取月度奖励'}
          </button>
        ` : ''}
        <div class="subscription-actions">
          <button class="cancel-btn" onclick="window.cancelSubscription()">${lang === 'en' ? 'Cancel Subscription' : '取消订阅'}</button>
        </div>
      </div>
    `;
  };

  const renderBenefitsComparison = () => {
    const lang = getLang();

    let html = `
      <div class="benefits-comparison">
        <h3>${lang === 'en' ? 'Compare Plans' : '方案对比'}</h3>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>${lang === 'en' ? 'Feature' : '功能'}</th>
              <th>${lang === 'en' ? 'Free' : '免费'}</th>
              <th>🥈 ${lang === 'en' ? 'Silver' : '白银'}</th>
              <th>🥇 ${lang === 'en' ? 'Gold' : '黄金'}</th>
              <th>💎 ${lang === 'en' ? 'Diamond' : '钻石'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${lang === 'en' ? 'GPS Bonus' : 'GPS加成'}</td>
              <td>-</td>
              <td>+10%</td>
              <td>+25%</td>
              <td>+50%</td>
            </tr>
            <tr>
              <td>${lang === 'en' ? 'Offline Bonus' : '离线加成'}</td>
              <td>-</td>
              <td>+20%</td>
              <td>+50%</td>
              <td>+100%</td>
            </tr>
            <tr>
              <td>${lang === 'en' ? 'No Ads' : '去广告'}</td>
              <td>❌</td>
              <td>✅</td>
              <td>✅</td>
              <td>✅</td>
            </tr>
            <tr>
              <td>${lang === 'en' ? 'Cloud Save' : '云存档'}</td>
              <td>❌</td>
              <td>✅</td>
              <td>✅</td>
              <td>✅</td>
            </tr>
            <tr>
              <td>${lang === 'en' ? 'Monthly Rewards' : '月度奖励'}</td>
              <td>❌</td>
              <td>❌</td>
              <td>✅</td>
              <td>✅</td>
            </tr>
            <tr>
              <td>${lang === 'en' ? 'Auto Buyer' : '自动购买'}</td>
              <td>❌</td>
              <td>❌</td>
              <td>✅</td>
              <td>✅</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    return html;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════════════════

  const init = () => {
    initSubscriptionData();

    // 定期更新
    setInterval(update, 60 * 60 * 1000); // 每小时检查一次
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 导出接口
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // 初始化
    init,
    update,

    // 订阅操作
    subscribe,
    cancelSubscription,
    renewSubscription,

    // 状态查询
    getSubscriptionStatus,
    isSubscribed,
    getCurrentTier,

    // 权益与加成
    getSubscriptionBonuses,
    getSubscriptionPrivileges,
    getTotalGPSBonus,
    getOfflineBonus,
    hasAds,
    getCrisisImmunity,

    // 月度奖励
    claimMonthlyReward,
    canClaimMonthlyReward,

    // 查询
    getAllTiers,
    getTierInfo,
    getStats,

    // UI
    renderSubscriptionPanel,
    renderBenefitsComparison,
  };
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createSubscriptionSystem };
}
