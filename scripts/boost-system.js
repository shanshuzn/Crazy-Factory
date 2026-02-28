/**
 * 加速道具系统 (Boost System) - P7-T2
 *
 * 功能：付费加速道具，提供时间价值和效率提升
 * 机制：
 * 1. 时间跃迁：立即获得X小时的GPS收益
 * 2. 双倍收益：一定时间内GPS翻倍
 * 3. 智能购买：自动购买最优建筑
 * 4. 研究加速：立即获得研究点
 */

const createBoostSystem = ({
  st,
  eventBus,
  pushLog,
  I18N,
  economy,
}) => {
  // 获取当前语言
  const getLang = () => (typeof I18N !== 'undefined' ? I18N.getCurrentLang() : 'zh');

  // ═══════════════════════════════════════════════════════════════════════════
  // 数据存储
  // ═══════════════════════════════════════════════════════════════════════════

  const initBoostData = () => {
    if (!st.boost) {
      st.boost = {
        // 道具背包
        inventory: {},
        // 激活的加成效果
        activeEffects: [],
        // 购买统计
        stats: {
          totalPurchases: 0,
          totalSpent: 0,
          totalItemsUsed: 0,
        },
      };
    }

    // 确保所有道具类型都有库存记录
    Object.keys(BOOST_ITEMS).forEach(itemId => {
      if (st.boost.inventory[itemId] === undefined) {
        st.boost.inventory[itemId] = 0;
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 道具配置
  // ═══════════════════════════════════════════════════════════════════════════

  const BOOST_ITEMS = {
    // 时间跃迁类
    time_warp_1h: {
      id: 'time_warp_1h',
      name: { zh: '时间跃迁 1小时', en: 'Time Warp 1H' },
      description: { zh: '立即获得1小时的GPS收益', en: 'Instant 1 hour of GPS earnings' },
      price: 0.99,
      currency: 'USD',
      category: 'time_warp',
      effect: {
        type: 'instant_gps',
        duration: 3600, // 1小时 = 3600秒
      },
      icon: '⏰',
      color: '#4CAF50',
    },
    time_warp_8h: {
      id: 'time_warp_8h',
      name: { zh: '时间跃迁 8小时', en: 'Time Warp 8H' },
      description: { zh: '立即获得8小时的GPS收益', en: 'Instant 8 hours of GPS earnings' },
      price: 4.99,
      currency: 'USD',
      category: 'time_warp',
      effect: {
        type: 'instant_gps',
        duration: 28800, // 8小时
      },
      icon: '⏰',
      color: '#4CAF50',
      popular: true,
    },
    time_warp_24h: {
      id: 'time_warp_24h',
      name: { zh: '时间跃迁 24小时', en: 'Time Warp 24H' },
      description: { zh: '立即获得24小时的GPS收益', en: 'Instant 24 hours of GPS earnings' },
      price: 9.99,
      currency: 'USD',
      category: 'time_warp',
      effect: {
        type: 'instant_gps',
        duration: 86400, // 24小时
      },
      icon: '⏰',
      color: '#4CAF50',
      bestValue: true,
    },

    // 倍数加成类
    double_gps_1h: {
      id: 'double_gps_1h',
      name: { zh: '双倍收益 1小时', en: 'Double GPS 1H' },
      description: { zh: '1小时内GPS翻倍', en: 'Double GPS for 1 hour' },
      price: 0.99,
      currency: 'USD',
      category: 'multiplier',
      effect: {
        type: 'multiplier',
        value: 2,
        duration: 3600,
      },
      icon: '⚡',
      color: '#FF9800',
    },
    double_gps_4h: {
      id: 'double_gps_4h',
      name: { zh: '双倍收益 4小时', en: 'Double GPS 4H' },
      description: { zh: '4小时内GPS翻倍', en: 'Double GPS for 4 hours' },
      price: 2.99,
      currency: 'USD',
      category: 'multiplier',
      effect: {
        type: 'multiplier',
        value: 2,
        duration: 14400,
      },
      icon: '⚡',
      color: '#FF9800',
    },
    double_gps_24h: {
      id: 'double_gps_24h',
      name: { zh: '双倍收益 24小时', en: 'Double GPS 24H' },
      description: { zh: '24小时内GPS翻倍', en: 'Double GPS for 24 hours' },
      price: 4.99,
      currency: 'USD',
      category: 'multiplier',
      effect: {
        type: 'multiplier',
        value: 2,
        duration: 86400,
      },
      icon: '⚡',
      color: '#FF9800',
      popular: true,
    },
    triple_gps_1h: {
      id: 'triple_gps_1h',
      name: { zh: '三倍收益 1小时', en: 'Triple GPS 1H' },
      description: { zh: '1小时内GPS变为3倍', en: 'Triple GPS for 1 hour' },
      price: 1.99,
      currency: 'USD',
      category: 'multiplier',
      effect: {
        type: 'multiplier',
        value: 3,
        duration: 3600,
      },
      icon: '⚡',
      color: '#FF5722',
    },

    // 自动购买类
    auto_buyer_1h: {
      id: 'auto_buyer_1h',
      name: { zh: '智能购买 1小时', en: 'Smart Buyer 1H' },
      description: { zh: '1小时内自动购买最优建筑', en: 'Auto-buy best buildings for 1 hour' },
      price: 0.99,
      currency: 'USD',
      category: 'auto_buyer',
      effect: {
        type: 'auto_buyer',
        duration: 3600,
      },
      icon: '🤖',
      color: '#2196F3',
    },
    auto_buyer_24h: {
      id: 'auto_buyer_24h',
      name: { zh: '智能购买 24小时', en: 'Smart Buyer 24H' },
      description: { zh: '24小时内自动购买最优建筑', en: 'Auto-buy best buildings for 24 hours' },
      price: 3.99,
      currency: 'USD',
      category: 'auto_buyer',
      effect: {
        type: 'auto_buyer',
        duration: 86400,
      },
      icon: '🤖',
      color: '#2196F3',
    },
    auto_buyer_7d: {
      id: 'auto_buyer_7d',
      name: { zh: '智能购买 7天', en: 'Smart Buyer 7D' },
      description: { zh: '7天内自动购买最优建筑', en: 'Auto-buy best buildings for 7 days' },
      price: 9.99,
      currency: 'USD',
      category: 'auto_buyer',
      effect: {
        type: 'auto_buyer',
        duration: 604800,
      },
      icon: '🤖',
      color: '#2196F3',
      bestValue: true,
    },

    // 研究加速类
    research_pack_small: {
      id: 'research_pack_small',
      name: { zh: '研究加速包（小）', en: 'Research Pack (S)' },
      description: { zh: '立即获得500研究点', en: 'Instant 500 Research Points' },
      price: 0.99,
      currency: 'USD',
      category: 'research',
      effect: {
        type: 'rp',
        value: 500,
      },
      icon: '🔬',
      color: '#9C27B0',
    },
    research_pack_medium: {
      id: 'research_pack_medium',
      name: { zh: '研究加速包（中）', en: 'Research Pack (M)' },
      description: { zh: '立即获得2000研究点', en: 'Instant 2000 Research Points' },
      price: 2.99,
      currency: 'USD',
      category: 'research',
      effect: {
        type: 'rp',
        value: 2000,
      },
      icon: '🔬',
      color: '#9C27B0',
    },
    research_pack_large: {
      id: 'research_pack_large',
      name: { zh: '研究加速包（大）', en: 'Research Pack (L)' },
      description: { zh: '立即获得10000研究点', en: 'Instant 10000 Research Points' },
      price: 9.99,
      currency: 'USD',
      category: 'research',
      effect: {
        type: 'rp',
        value: 10000,
      },
      icon: '🔬',
      color: '#9C27B0',
      popular: true,
    },

    // 组合包
    starter_pack: {
      id: 'starter_pack',
      name: { zh: '新手礼包', en: 'Starter Pack' },
      description: { zh: '包含：时间跃迁1h + 双倍收益1h + 研究包（小）', en: 'Includes: Time Warp 1H + Double GPS 1H + Research Pack (S)' },
      price: 1.99,
      currency: 'USD',
      category: 'bundle',
      originalPrice: 2.97,
      discount: 0.33,
      effect: {
        type: 'bundle',
        items: ['time_warp_1h', 'double_gps_1h', 'research_pack_small'],
      },
      icon: '🎁',
      color: '#E91E63',
      oneTime: true,
    },
    mega_bundle: {
      id: 'mega_bundle',
      name: { zh: '超级大礼包', en: 'Mega Bundle' },
      description: { zh: '包含：时间跃迁24h + 双倍收益24h + 智能购买7天 + 研究包（大）', en: 'Includes: Time Warp 24H + Double GPS 24H + Smart Buyer 7D + Research Pack (L)' },
      price: 19.99,
      currency: 'USD',
      category: 'bundle',
      originalPrice: 28.96,
      discount: 0.31,
      effect: {
        type: 'bundle',
        items: ['time_warp_24h', 'double_gps_24h', 'auto_buyer_7d', 'research_pack_large'],
      },
      icon: '🎁',
      color: '#E91E63',
      bestValue: true,
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 购买系统
  // ═══════════════════════════════════════════════════════════════════════════

  // 模拟购买（实际项目中这里会调用支付API）
  const purchaseItem = async (itemId, paymentMethod = 'mock') => {
    const lang = getLang();
    const item = BOOST_ITEMS[itemId];

    if (!item) {
      return { success: false, error: lang === 'en' ? 'Item not found' : '道具不存在' };
    }

    // 检查一次性购买限制
    if (item.oneTime && st.boost.inventory[itemId] > 0) {
      return { success: false, error: lang === 'en' ? 'Already purchased' : '已经购买过' };
    }

    try {
      // 模拟支付流程
      console.log(`Processing payment for ${item.name[lang]}: $${item.price}`);

      // 模拟支付延迟
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 模拟支付成功（95%成功率）
      if (Math.random() > 0.05) {
        // 如果是组合包，添加所有组件
        if (item.effect.type === 'bundle') {
          item.effect.items.forEach(subItemId => {
            st.boost.inventory[subItemId] = (st.boost.inventory[subItemId] || 0) + 1;
          });
        } else {
          // 添加道具到背包
          st.boost.inventory[itemId] = (st.boost.inventory[itemId] || 0) + 1;
        }

        // 更新统计
        st.boost.stats.totalPurchases++;
        st.boost.stats.totalSpent += item.price;

        // 触发事件
        eventBus.emit('boost:purchased', { itemId, item, price: item.price });

        pushLog(lang === 'en'
          ? `💎 Purchased ${item.name.en} for $${item.price}!`
          : `💎 购买${item.name.zh}成功！花费 $${item.price}`
        );

        return { success: true, item };
      } else {
        throw new Error('Payment failed');
      }
    } catch (error) {
      return { success: false, error: lang === 'en' ? 'Payment failed' : '支付失败' };
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 使用道具
  // ═══════════════════════════════════════════════════════════════════════════

  const useItem = (itemId) => {
    const lang = getLang();
    const item = BOOST_ITEMS[itemId];

    if (!item) {
      return { success: false, error: lang === 'en' ? 'Item not found' : '道具不存在' };
    }

    if (st.boost.inventory[itemId] <= 0) {
      return { success: false, error: lang === 'en' ? 'No items in inventory' : '背包中没有该道具' };
    }

    // 应用效果
    const result = applyEffect(item.effect);

    if (result.success) {
      // 消耗道具
      st.boost.inventory[itemId]--;
      st.boost.stats.totalItemsUsed++;

      // 触发事件
      eventBus.emit('boost:used', { itemId, item, result });

      pushLog(lang === 'en'
        ? `✨ Used ${item.name.en}! ${result.message}`
        : `✨ 使用${item.name.zh}！${result.message}`
      );
    }

    return result;
  };

  // 应用效果
  const applyEffect = (effect) => {
    const lang = getLang();

    switch (effect.type) {
      case 'instant_gps':
        const gpsReward = st.totalGPS * effect.duration;
        st.money += gpsReward;
        return {
          success: true,
          message: lang === 'en'
            ? `Gained ${formatNumber(gpsReward)} from ${effect.duration / 3600} hours!`
            : `获得 ${formatNumber(gpsReward)} (${effect.duration / 3600}小时收益)`
        };

      case 'multiplier':
        const expiresAt = Date.now() + effect.duration * 1000;
        st.boost.activeEffects.push({
          type: 'gps_multiplier',
          value: effect.value,
          expiresAt,
          startedAt: Date.now(),
        });
        return {
          success: true,
          message: lang === 'en'
            ? `GPS x${effect.value} for ${effect.duration / 3600} hours!`
            : `GPS ${effect.value}倍加成 ${effect.duration / 3600}小时`
        };

      case 'auto_buyer':
        const autoBuyerExpiresAt = Date.now() + effect.duration * 1000;
        st.boost.activeEffects.push({
          type: 'auto_buyer',
          expiresAt: autoBuyerExpiresAt,
          startedAt: Date.now(),
        });
        return {
          success: true,
          message: lang === 'en'
            ? `Auto-buyer activated for ${effect.duration / 3600} hours!`
            : `智能购买已激活 ${effect.duration / 3600}小时`
        };

      case 'rp':
        st.rp = (st.rp || 0) + effect.value;
        return {
          success: true,
          message: lang === 'en'
            ? `Gained ${formatNumber(effect.value)} Research Points!`
            : `获得 ${formatNumber(effect.value)} 研究点`
        };

      default:
        return { success: false, error: lang === 'en' ? 'Unknown effect type' : '未知效果类型' };
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 效果管理
  // ═══════════════════════════════════════════════════════════════════════════

  const updateEffects = () => {
    const now = Date.now();

    // 清理过期效果
    st.boost.activeEffects = st.boost.activeEffects.filter(effect => {
      if (effect.expiresAt <= now) {
        // 效果过期通知
        const lang = getLang();
        const effectNames = {
          gps_multiplier: lang === 'en' ? 'GPS multiplier' : 'GPS加成',
          auto_buyer: lang === 'en' ? 'Auto-buyer' : '智能购买',
        };
        pushLog(lang === 'en'
          ? `⏱️ ${effectNames[effect.type]} has expired`
          : `⏱️ ${effectNames[effect.type]}已过期`
        );
        return false;
      }
      return true;
    });

    // 执行自动购买
    const autoBuyerEffect = st.boost.activeEffects.find(e => e.type === 'auto_buyer');
    if (autoBuyerEffect) {
      executeAutoBuy();
    }
  };

  // 自动购买逻辑
  const executeAutoBuy = () => {
    // 每秒检查一次
    if (Math.random() > 0.1) return; // 10%概率每秒执行

    // 找到最高效的建筑
    let bestBuilding = null;
    let bestEfficiency = 0;

    // 这里简化处理，实际应该基于DPS/价格比计算
    // 暂时随机购买一个已解锁的建筑
    const availableBuildings = st.buildings.filter(b => b.owned > 0 || st.totalMoney > b.baseCost);
    if (availableBuildings.length > 0) {
      bestBuilding = availableBuildings[Math.floor(Math.random() * availableBuildings.length)];
    }

    if (bestBuilding && st.money >= bestBuilding.baseCost) {
      // 执行购买
      st.money -= bestBuilding.baseCost;
      bestBuilding.owned++;

      eventBus.emit('boost:autoBuy', { buildingId: bestBuilding.id });
    }
  };

  // 获取当前激活的效果
  const getActiveEffects = () => {
    const now = Date.now();
    return st.boost.activeEffects.map(effect => {
      const remaining = Math.max(0, effect.expiresAt - now);
      const total = effect.expiresAt - effect.startedAt;
      return {
        ...effect,
        remainingSeconds: Math.floor(remaining / 1000),
        progressPercent: ((total - remaining) / total) * 100,
      };
    });
  };

  // 获取当前GPS倍数
  const getGPSMultiplier = () => {
    let multiplier = 1;

    st.boost.activeEffects.forEach(effect => {
      if (effect.type === 'gps_multiplier') {
        multiplier *= effect.value;
      }
    });

    return multiplier;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 查询接口
  // ═══════════════════════════════════════════════════════════════════════════

  const getInventory = () => st.boost.inventory;

  const getItemCount = (itemId) => st.boost.inventory[itemId] || 0;

  const getAllItems = () => Object.values(BOOST_ITEMS).map(item => ({
    ...item,
    owned: st.boost.inventory[item.id] || 0,
  }));

  const getItemsByCategory = (category) => {
    return Object.values(BOOST_ITEMS)
      .filter(item => item.category === category)
      .map(item => ({
        ...item,
        owned: st.boost.inventory[item.id] || 0,
      }));
  };

  const getStats = () => st.boost.stats;

  // ═══════════════════════════════════════════════════════════════════════════
  // UI 渲染
  // ═══════════════════════════════════════════════════════════════════════════

  const renderShopPanel = () => {
    const lang = getLang();
    const categories = {
      time_warp: { name: { zh: '时间跃迁', en: 'Time Warp' }, icon: '⏰' },
      multiplier: { name: { zh: '收益加成', en: 'Multipliers' }, icon: '⚡' },
      auto_buyer: { name: { zh: '智能购买', en: 'Auto Buyer' }, icon: '🤖' },
      research: { name: { zh: '研究加速', en: 'Research' }, icon: '🔬' },
      bundle: { name: { zh: '组合包', en: 'Bundles' }, icon: '🎁' },
    };

    let html = `<div class="boost-shop-panel">`;
    html += `<h3>${lang === 'en' ? '💎 Boost Shop' : '💎 道具商店'}</h3>`;

    Object.entries(categories).forEach(([catId, catInfo]) => {
      const items = getItemsByCategory(catId);
      if (items.length === 0) return;

      html += `
        <div class="shop-category">
          <h4>${catInfo.icon} ${catInfo.name[lang]}</h4>
          <div class="items-grid">
      `;

      items.forEach(item => {
        const popularTag = item.popular ? `<span class="tag popular">${lang === 'en' ? 'POPULAR' : '热门'}</span>` : '';
        const bestValueTag = item.bestValue ? `<span class="tag best-value">${lang === 'en' ? 'BEST VALUE' : '最超值'}</span>` : '';
        const discountTag = item.discount ? `<span class="tag discount">-${(item.discount * 100).toFixed(0)}%</span>` : '';

        html += `
          <div class="shop-item" data-item="${item.id}">
            <div class="item-header" style="border-color: ${item.color}">
              <span class="item-icon">${item.icon}</span>
              <span class="item-name">${item.name[lang]}</span>
              ${popularTag}${bestValueTag}${discountTag}
            </div>
            <div class="item-description">${item.description[lang]}</div>
            ${item.originalPrice ? `<div class="original-price">$${item.originalPrice}</div>` : ''}
            <div class="item-price" style="color: ${item.color}">$${item.price}</div>
            ${item.owned > 0 ? `<div class="owned-count">${lang === 'en' ? 'Owned' : '拥有'}: ${item.owned}</div>` : ''}
            <button class="buy-btn" data-item="${item.id}">${lang === 'en' ? 'Buy' : '购买'}</button>
          </div>
        `;
      });

      html += `</div></div>`;
    });

    html += `</div>`;
    return html;
  };

  const renderInventoryPanel = () => {
    const lang = getLang();
    const items = getAllItems().filter(item => item.owned > 0);

    if (items.length === 0) {
      return `
        <div class="boost-inventory-panel empty">
          <h3>${lang === 'en' ? '🎒 Your Items' : '🎒 你的道具'}</h3>
          <p>${lang === 'en' ? 'No items yet. Visit the shop!' : '还没有道具，去商店看看吧！'}</p>
        </div>
      `;
    }

    let html = `
      <div class="boost-inventory-panel">
        <h3>${lang === 'en' ? '🎒 Your Items' : '🎒 你的道具'}</h3>
        <div class="inventory-grid">
    `;

    items.forEach(item => {
      html += `
        <div class="inventory-item" data-item="${item.id}">
          <span class="item-icon">${item.icon}</span>
          <span class="item-name">${item.name[lang]}</span>
          <span class="item-count">x${item.owned}</span>
          <button class="use-btn" data-item="${item.id}">${lang === 'en' ? 'Use' : '使用'}</button>
        </div>
      `;
    });

    html += `</div></div>`;
    return html;
  };

  const renderActiveEffectsPanel = () => {
    const lang = getLang();
    const effects = getActiveEffects();

    if (effects.length === 0) {
      return `
        <div class="active-effects-panel empty">
          <h3>${lang === 'en' ? '✨ Active Boosts' : '✨ 激活的加成'}</h3>
          <p>${lang === 'en' ? 'No active boosts' : '没有激活的加成'}</p>
        </div>
      `;
    }

    let html = `
      <div class="active-effects-panel">
        <h3>${lang === 'en' ? '✨ Active Boosts' : '✨ 激活的加成'}</h3>
        <div class="effects-list">
    `;

    effects.forEach(effect => {
      const minutes = Math.floor(effect.remainingSeconds / 60);
      const seconds = effect.remainingSeconds % 60;
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      const effectNames = {
        gps_multiplier: { zh: 'GPS加成', en: 'GPS Multiplier' },
        auto_buyer: { zh: '智能购买', en: 'Auto Buyer' },
      };

      const effectName = effectNames[effect.type] || { zh: '未知', en: 'Unknown' };
      const displayValue = effect.value ? `x${effect.value}` : '';

      html += `
        <div class="effect-item">
          <span class="effect-name">${effectName[lang]} ${displayValue}</span>
          <div class="effect-progress">
            <div class="progress-bar" style="width: ${effect.progressPercent}%"></div>
          </div>
          <span class="effect-time">${timeStr}</span>
        </div>
      `;
    });

    html += `</div></div>`;
    return html;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════════════════

  const init = () => {
    initBoostData();

    // 定期更新效果
    setInterval(updateEffects, 1000); // 每秒更新
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 导出接口
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // 初始化
    init,
    updateEffects,

    // 购买
    purchaseItem,

    // 使用
    useItem,
    applyEffect,

    // 效果
    getActiveEffects,
    getGPSMultiplier,

    // 查询
    getInventory,
    getItemCount,
    getAllItems,
    getItemsByCategory,
    getStats,

    // UI
    renderShopPanel,
    renderInventoryPanel,
    renderActiveEffectsPanel,
  };
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createBoostSystem };
}

// 辅助函数：数字格式化
function formatNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}
