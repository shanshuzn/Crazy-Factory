# Phase 7 商业化 - 实施路线图

> **阶段**: Phase 7 - Monetization  
> **目标**: 实现可持续的商业收入  
> **预计周期**: 2-3 个月  
> **状态**: 📋 规划中，待启动

---

## 概述

Phase 7 将为游戏引入商业化机制，在不影响核心游戏体验的前提下，提供付费选项给愿意支持游戏的玩家。我们将采用"付费加速，不付费也能玩"的公平模式。

---

## 任务优先级与依赖关系

```
P7-T2 加速道具 (高) ──┬──→ P7-T1 皮肤/主题系统 (中)
                      │
P7-T3 特权订阅 (高) ──┼──→ P7-T4 限时活动 (中)
                      │
                      └──→ P7-T5 广告变现 (低)
```

---

## P7-T1: 皮肤/主题系统

**优先级**: 🟡 中  
**预计工期**: 2-3 周  
**前置依赖**: 无

### 技术方案

```javascript
// 新增模块: scripts/skin-system.js
const createSkinSystem = ({
  st,
  eventBus,
}) => {
  const skins = {
    cyberpunk: {
      id: 'cyberpunk',
      name: { zh: '赛博朋克', en: 'Cyberpunk' },
      price: 4.99,
      preview: 'url(assets/skins/cyberpunk-preview.jpg)',
      cssVars: {
        '--bg': '#0a0a1a',
        '--primary': '#00ff88',
        '--accent': '#ff0088',
        '--card-bg': '#1a1a2e',
      },
    },
    minimal: {
      id: 'minimal',
      name: { zh: '极简主义', en: 'Minimalist' },
      price: 2.99,
      cssVars: {
        '--bg': '#ffffff',
        '--primary': '#000000',
        '--accent': '#666666',
        '--card-bg': '#f5f5f5',
      },
    },
    golden: {
      id: 'golden',
      name: { zh: '黄金奢华', en: 'Golden Luxury' },
      price: 9.99,
      cssVars: {
        '--bg': '#1a1200',
        '--primary': '#ffd700',
        '--accent': '#ffaa00',
        '--card-bg': '#2a2000',
      },
    },
  };

  // 应用皮肤
  const applySkin = (skinId) => {
    const skin = skins[skinId];
    if (!skin || !st.ownedSkins.includes(skinId)) return false;

    const root = document.documentElement;
    Object.entries(skin.cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    st.currentSkin = skinId;
    return true;
  };

  return { skins, applySkin, purchaseSkin };
};
```

### 实施步骤

1. **Week 1**: 基础架构
   - [ ] 创建 skin-system.js 模块
   - [ ] 定义皮肤数据结构
   - [ ] 设计 CSS 变量系统
   - [ ] 创建皮肤预览界面

2. **Week 2**: 购买与存储
   - [ ] 实现皮肤购买逻辑（模拟支付）
   - [ ] 已购买皮肤持久化
   - [ ] 当前皮肤状态保存
   - [ ] 皮肤切换功能

3. **Week 3**: UI 与优化
   - [ ] 皮肤商店 UI
   - [ ] 皮肤预览功能
   - [ ] 默认皮肤回退
   - [ ] 性能测试

### 预期影响

- 增加视觉付费点
- 不影响游戏平衡
- 提升玩家个性化体验

---

## P7-T2: 加速道具系统 🚧 进行中

**优先级**: 🔴 高  
**预计工期**: 2-3 周  
**前置依赖**: 无  
**进度**: Week 1 基础架构已完成，GPS集成已完成

### ✅ 已完成任务

- [x] **1. 创建 boost-system.js 模块**
  - 模块工厂函数 `createBoostSystem()`
  - 数据持久化结构 (st.boost)
  - 事件总线集成
  - 多语言支持 (I18N)

- [x] **2. 定义道具数据结构**
  - **时间跃迁类**: 1h ($0.99)、8h ($4.99)、24h ($9.99)
  - **倍数加成类**: 双倍1h/4h/24h、三倍1h
  - **智能购买类**: 1h/24h/7天
  - **研究加速类**: 小(500RP)/中(2000RP)/大(10000RP)
  - **组合包**: 新手礼包($1.99)、超级大礼包($19.99)

- [x] **3. 实现道具使用效果**
  - 时间跃迁：立即获得X小时GPS收益
  - 倍数加成：GPS翻倍/三倍，限时
  - 智能购买：自动购买最优建筑
  - 研究加速：立即获得研究点
  - 自动购买逻辑：每秒10%概率执行

- [x] **4. 道具背包系统**
  - 库存管理 (st.boost.inventory)
  - 激活效果追踪 (st.boost.activeEffects)
  - 购买统计 (st.boost.stats)
  - 效果过期自动清理

- [x] **5. 购买系统**
  - 异步购买函数 (模拟支付)
  - 组合包展开逻辑
  - 一次性购买限制
  - 95%成功率模拟

- [x] **6. UI 面板**
  - 道具商店面板 `renderShopPanel()`
  - 背包面板 `renderInventoryPanel()`
  - 激活效果面板 `renderActiveEffectsPanel()`
  - 分类展示、标签、进度条

- [x] **7. 集成**
  - index.html 引入 boost-system.js
  - game.js 初始化与事件监听
  - economy-system.js GPS倍数加成集成
  - GPS公式：`* boostMult`

### 待完成任务

- [ ] **8. 测试与优化** (Week 2)
  - 购买流程测试
  - 道具效果测试
  - 效果叠加测试
  - 自动购买逻辑优化
  - 限时折扣功能

### 技术方案

```javascript
// 新增模块: scripts/boost-system.js
const createBoostSystem = ({
  st,
  eventBus,
}) => {
  const boostItems = {
    time_warp_1h: {
      id: 'time_warp_1h',
      name: { zh: '时间跃迁 1小时', en: 'Time Warp 1H' },
      description: { zh: '立即获得1小时的GPS收益', en: 'Instant 1 hour of GPS earnings' },
      price: 0.99,
      effect: { type: 'instant_gps', duration: 3600 },
      icon: '⏰',
    },
    time_warp_8h: {
      id: 'time_warp_8h',
      name: { zh: '时间跃迁 8小时', en: 'Time Warp 8H' },
      price: 4.99,
      effect: { type: 'instant_gps', duration: 28800 },
      icon: '⏰',
    },
    double_gps_24h: {
      id: 'double_gps_24h',
      name: { zh: '双倍收益 24小时', en: 'Double GPS 24H' },
      price: 2.99,
      effect: { type: 'multiplier', value: 2, duration: 86400 },
      icon: '⚡',
    },
    auto_buyer_7d: {
      id: 'auto_buyer_7d',
      name: { zh: '智能购买 7天', en: 'Smart Buyer 7D' },
      price: 3.99,
      effect: { type: 'auto_buyer', duration: 604800 },
      icon: '🤖',
    },
    research_pack: {
      id: 'research_pack',
      name: { zh: '研究加速包', en: 'Research Pack' },
      price: 1.99,
      effect: { type: 'rp', value: 1000 },
      icon: '🔬',
    },
  };

  // 使用道具
  const useBoost = (itemId) => {
    const item = boostItems[itemId];
    if (!item || !st.inventory[itemId]) return false;

    // 应用效果
    switch (item.effect.type) {
      case 'instant_gps':
        st.money += st.totalGPS * item.effect.duration;
        break;
      case 'multiplier':
        st.activeBoosts.push({
          type: 'gps_mult',
          value: item.effect.value,
          expiresAt: Date.now() + item.effect.duration * 1000,
        });
        break;
      // ... 其他效果
    }

    // 消耗道具
    st.inventory[itemId]--;
    return true;
  };

  return { boostItems, useBoost, purchaseBoost };
};
```

### 实施步骤

1. **Week 1**: 基础架构
   - [ ] 创建 boost-system.js 模块
   - [ ] 定义道具数据结构
   - [ ] 实现道具使用效果
   - [ ] 道具背包系统

2. **Week 2**: 购买与使用
   - [ ] 道具商店 UI
   - [ ] 购买流程（模拟支付）
   - [ ] 道具使用界面
   - [ ] 效果叠加逻辑

3. **Week 3**: 优化与测试
   - [ ] 限时折扣功能
   - [ ] 打包销售（Bundle）
   - [ ] 购买确认对话框
   - [ ] 平衡性测试

### 预期影响

- 主要收入来源之一
- 提供时间价值，不影响平衡
- 适合 impatient 玩家

---

## P7-T3: 特权订阅系统 🚧 进行中

**优先级**: 🔴 高  
**预计工期**: 3-4 周  
**前置依赖**: 无  
**进度**: Week 1 基础架构已完成，GPS集成已完成

### ✅ 已完成任务

- [x] **1. 创建 subscription-system.js 模块**
  - 模块工厂函数 `createSubscriptionSystem()`
  - 数据持久化结构 (st.subscription)
  - 事件总线集成
  - 多语言支持 (I18N)

- [x] **2. 定义订阅等级**
  - **白银会员** ($4.99/月): GPS+10%, 离线+20%, 去广告, 云存档
  - **黄金会员** ($9.99/月): GPS+25%, 离线+50%, 月度奖励, 自动购买, Beta资格
  - **钻石会员** ($19.99/月): GPS+50%, 离线+100%, 定制皮肤, 开发者联系

- [x] **3. 订阅权益系统**
  - GPS加成、离线加成、每日奖励倍数
  - 研究点加成、自动购买、危机免疫
  - 去广告、云存档、优先客服
  - 特权功能：配置保存槽位、Beta测试资格

- [x] **4. 订阅状态管理**
  - 订阅/续费/取消功能
  - 到期时间追踪
  - 自动续费机制
  - 订阅历史记录
  - 累计订阅天数统计

- [x] **5. 月度奖励系统**
  - 每月可领取的道具包
  - 月度奖励领取状态追踪
  - 不同等级不同奖励

- [x] **6. 集成**
  - index.html 引入 subscription-system.js
  - game.js 初始化与事件监听
  - economy-system.js GPS加成集成
  - GPS公式：`* subscriptionMult`

### 待完成任务

- [ ] **7. UI 面板** (Week 2)
  - 订阅选择页面
  - 权益对比表格
  - 当前订阅状态面板
  - 月度奖励领取界面

- [ ] **8. 支付集成** (Week 3)
  - 支付流程优化
  - 订阅管理界面
  - 续费提醒
  - 退款处理

### 技术方案

```javascript
// 新增模块: scripts/subscription-system.js
const createSubscriptionSystem = ({
  st,
  eventBus,
}) => {
  const tiers = {
    silver: {
      id: 'silver',
      name: { zh: '白银会员', en: 'Silver' },
      price: { monthly: 4.99, yearly: 39.99 },
      benefits: [
        { zh: '移除广告', en: 'No Ads' },
        { zh: '每日双倍奖励', en: 'Daily Double Rewards' },
        { zh: '专属皮肤', en: 'Exclusive Skin' },
        { zh: '云存档', en: 'Cloud Save' },
      ],
      bonuses: {
        gpsBonus: 0.1,        // +10% GPS
        offlineBonus: 0.2,    // +20% 离线收益
        dailyBonus: 2,        // 双倍每日奖励
      },
    },
    gold: {
      id: 'gold',
      name: { zh: '黄金会员', en: 'Gold' },
      price: { monthly: 9.99, yearly: 79.99 },
      benefits: [
        { zh: '白银会员所有权益', en: 'All Silver benefits' },
        { zh: '每月免费道具包', en: 'Monthly Free Boost Pack' },
        { zh: '优先客服支持', en: 'Priority Support' },
        { zh: ' Beta 测试资格', en: 'Beta Access' },
      ],
      bonuses: {
        gpsBonus: 0.25,       // +25% GPS
        offlineBonus: 0.5,    // +50% 离线收益
        dailyBonus: 3,        // 三倍每日奖励
        autoBuyer: true,      // 免费自动购买
      },
    },
    diamond: {
      id: 'diamond',
      name: { zh: '钻石会员', en: 'Diamond' },
      price: { monthly: 19.99, yearly: 149.99 },
      benefits: [
        { zh: '黄金会员所有权益', en: 'All Gold benefits' },
        { zh: '每周专属活动', en: 'Weekly Exclusive Events' },
        { zh: '定制皮肤', en: 'Custom Skin Design' },
        { zh: '开发者直接联系', en: 'Direct Developer Contact' },
      ],
      bonuses: {
        gpsBonus: 0.5,        // +50% GPS
        offlineBonus: 1.0,    // +100% 离线收益
        dailyBonus: 5,        // 五倍每日奖励
        autoBuyer: true,
        noCrisis: true,       // 免疫危机事件
      },
    },
  };

  // 检查订阅状态
  const getSubscriptionStatus = () => {
    if (!st.subscription || !st.subscription.expiresAt) {
      return { active: false, tier: null };
    }

    const now = Date.now();
    const active = st.subscription.expiresAt > now;

    return {
      active,
      tier: active ? st.subscription.tier : null,
      expiresAt: st.subscription.expiresAt,
      daysRemaining: active ? Math.ceil((st.subscription.expiresAt - now) / (24 * 60 * 60 * 1000)) : 0,
    };
  };

  // 获取当前订阅加成
  const getSubscriptionBonuses = () => {
    const status = getSubscriptionStatus();
    if (!status.active) return { gpsBonus: 0, offlineBonus: 0, dailyBonus: 1 };

    return tiers[status.tier].bonuses;
  };

  return { tiers, getSubscriptionStatus, getSubscriptionBonuses, subscribe };
};
```

### 实施步骤

1. **Week 1**: 基础架构
   - [ ] 创建 subscription-system.js 模块
   - [ ] 定义订阅等级数据结构
   - [ ] 订阅状态管理
   - [ ] 到期检查机制

2. **Week 2**: 权益系统
   - [ ] GPS加成集成
   - [ ] 离线收益加成
   - [ ] 每日奖励倍数
   - [ ] 自动购买特权

3. **Week 3**: UI 与支付
   - [ ] 订阅页面 UI
   - [ ] 权益对比展示
   - [ ] 订阅管理界面
   - [ ] 续费提醒

4. **Week 4**: 测试与优化
   - [ ] 订阅流程测试
   - [ ] 权益生效测试
   - [ ] 降级处理
   - [ ] 退款处理

### 预期影响

- 稳定月收入来源
- 提升用户 LTV
- 增强用户粘性

---

## P7-T4: 限时活动系统

**优先级**: 🟡 中  
**预计工期**: 2-3 周  
**前置依赖**: P7-T2 加速道具

### 技术方案

```javascript
// 新增模块: scripts/event-shop-system.js
const createEventShopSystem = ({
  st,
  eventBus,
}) => {
  const events = {
    black_friday: {
      id: 'black_friday',
      name: { zh: '黑色星期五', en: 'Black Friday' },
      startDate: '2026-11-27',
      endDate: '2026-11-30',
      discounts: {
        allItems: 0.5,  // 全场5折
      },
      exclusiveItems: ['exclusive_skin_bf'],
    },
    new_year: {
      id: 'new_year',
      name: { zh: '新年活动', en: 'New Year Event' },
      startDate: '2026-12-31',
      endDate: '2027-01-03',
      discounts: { bundles: 0.3 },
      missions: [
        { target: 'earn_1t', reward: 'time_warp_24h' },
        { target: 'buy_100_buildings', reward: 'double_gps_48h' },
      ],
    },
  };

  // 检查当前活动
  const getActiveEvents = () => {
    const now = new Date();
    return Object.values(events).filter(event => {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      return now >= start && now <= end;
    });
  };

  return { events, getActiveEvents, getDiscountedPrice };
};
```

### 实施步骤

1. **Week 1**: 活动框架
   - [ ] 创建 event-shop-system.js
   - [ ] 活动时间管理
   - [ ] 折扣计算逻辑
   - [ ] 专属商品系统

2. **Week 2**: 活动任务
   - [ ] 活动任务定义
   - [ ] 任务进度追踪
   - [ ] 任务奖励发放
   - [ ] 活动排行榜

3. **Week 3**: UI 与运营
   - [ ] 活动页面 UI
   - [ ] 倒计时显示
   - [ ] 活动通知
   - [ ] 后台配置工具

### 预期影响

- 刺激短期消费
- 提升用户活跃度
- 制造稀缺感

---

## P7-T5: 广告变现系统

**优先级**: 🟢 低  
**预计工期**: 1-2 周  
**前置依赖**: 无

### 技术方案

```javascript
// 新增模块: scripts/ad-system.js
const createAdSystem = ({
  st,
  eventBus,
}) => {
  const adPlacements = {
    banner: {
      id: 'banner',
      type: 'banner',
      location: 'bottom',
      frequency: 'always',
    },
    interstitial: {
      id: 'interstitial',
      type: 'interstitial',
      trigger: 'session_start',
      frequency: 300, // 每5分钟最多一次
    },
    rewarded: {
      id: 'rewarded',
      type: 'rewarded_video',
      rewards: [
        { type: 'gps', value: 300, description: '5分钟GPS' },
        { type: 'rp', value: 50, description: '50研究点' },
        { type: 'boost', value: 'double_gps_1h', description: '双倍收益1小时' },
      ],
      dailyLimit: 5,
    },
  };

  // 显示激励广告
  const showRewardedAd = (rewardIndex) => {
    if (st.adsWatchedToday >= adPlacements.rewarded.dailyLimit) {
      return { success: false, error: 'Daily limit reached' };
    }

    // 模拟广告展示
    return new Promise((resolve) => {
      // 实际项目中这里会调用广告 SDK
      setTimeout(() => {
        const reward = adPlacements.rewarded.rewards[rewardIndex];
        applyReward(reward);
        st.adsWatchedToday++;
        resolve({ success: true, reward });
      }, 5000); // 模拟5秒广告
    });
  };

  return { adPlacements, showRewardedAd, getAdsWatchedToday };
};
```

### 实施步骤

1. **Week 1**: 基础集成
   - [ ] 创建 ad-system.js
   - [ ] 广告位定义
   - [ ] 激励广告逻辑
   - [ ] 每日限制管理

2. **Week 2**: UI 与优化
   - [ ] 广告按钮 UI
   - [ ] 奖励选择界面
   - [ ] 广告加载优化
   - [ ] 用户偏好设置

### 预期影响

- 非付费用户变现
- 提供替代付费选项
- 广告收入补充

---

## 实施顺序建议

### 推荐路径

```
Week 1-2:  P7-T2 加速道具 (高优先级，快速收入)
Week 3-4:  P7-T3 特权订阅 (高优先级，稳定收入)
Week 5-6:  P7-T1 皮肤/主题 (中优先级，视觉付费)
Week 7-8:  P7-T4 限时活动 (中优先级，活动运营)
Week 9-10: P7-T5 广告变现 (低优先级，补充收入)
```

---

## 商业模式总览

| 收入来源 | 单价范围 | 占比预期 | 用户接受度 |
|----------|----------|----------|------------|
| 加速道具 | $0.99-$9.99 | 40% | 高 |
| 订阅服务 | $4.99-$19.99/月 | 35% | 中 |
| 皮肤主题 | $2.99-$9.99 | 15% | 高 |
| 限时活动 | 可变 | 7% | 中 |
| 广告收入 | - | 3% | 低 |

---

## 成功指标

- **ARPU** (每用户平均收入): > $0.5
- **LTV** (用户生命周期价值): > $5
- **付费转化率**: > 2%
- **订阅续费率**: > 60%
- **广告 eCPM**: > $5

---

## 伦理准则

1. **不强制付费**: 所有付费内容都应该是可选的
2. **明码标价**: 所有价格透明，无隐藏消费
3. **价值对等**: 付费内容应该提供相应价值
4. **防沉迷**: 对大额消费进行提示
5. **退款政策**: 合理的退款机制

---

*创建日期: 2026-02-28*  
*版本: v1.0*  
*作者: AI Assistant*
