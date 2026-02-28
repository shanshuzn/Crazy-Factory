# Phase 6 深度玩法扩展 - 实施路线图

> **阶段**: Phase 6 - Deepening Gameplay  
> **目标**: 增加游戏深度和策略性  
> **预计周期**: 2-3 个月  
> **状态**: 📋 规划中，待启动

---

## 概述

Phase 6 将大幅提升游戏的策略深度和可玩性。通过引入金融衍生品、产业链联动、全球化市场等机制，让玩家从简单的点击购买升级到复杂的策略决策。

---

## 任务优先级与依赖关系

```
P6-T2 产业链联动 (高) ──┬──→ P6-T1 金融衍生品 (高)
                        │
                        └──→ P6-T3 全球化市场 (中)

P6-T4 危机事件系统 (中) ──→ (独立，可与任何任务并行)

P6-T5 联盟/公会系统 (低) ──→ (最后实施，依赖其他系统成熟)
```

---

## P6-T1: 金融衍生品系统 🚧 进行中

**优先级**: 🔴 高  
**预计工期**: 3-4 周  
**前置依赖**: P6-T2 产业链联动（已前置完成）  
**进度**: Week 1 基础架构已完成，核心逻辑已实现

### ✅ 已完成任务

- [x] **1. 创建 derivatives-system.js 模块** (scripts/derivatives-system.js)
  - 模块工厂函数 `createDerivativesSystem()`
  - 数据持久化结构 (st.derivatives)
  - 事件总线集成 (eventBus)
  - 多语言支持 (I18N)

- [x] **2. 定义期货/期权数据结构**
  - 期货合约结构：id, type, leverage, margin, entryPrice, status
  - 期权合约结构：id, type, strikePrice, premium, expiresAt
  - 对冲配置：autoHedge, hedgeRatio
  - 交易统计：totalTrades, profit/loss tracking

- [x] **3. Week 2 核心逻辑** (已实现)
  - 保证金计算：`margin = contractValue * 0.1`
  - 杠杆机制：支持 2x, 5x, 10x 杠杆
  - 爆仓/强平逻辑：维持保证金 5%，触发强平
  - 未实现盈亏实时计算
  - 与市场系统联动 (market.getCurrentIndex)

- [x] **4. Week 3 期权系统** (已实现)
  - 简化版期权定价模型
  - 行权/到期自动处理逻辑
  - 权利金计算（含时间价值）
  - 自动行权（价内期权）和过期处理

- [x] **5. UI 面板与集成**
  - 期货持仓面板 `renderFuturesPanel()`
  - 期权持仓面板 `renderOptionsPanel()`
  - 交易统计面板 `renderStatsPanel()`
  - game.js 集成与事件监听
  - 调试命令：openFutures, closeFutures, buyOptions, getDerivativesStats

### 待完成任务

- [ ] **6. 测试与平衡** (Week 4)
  - 单元测试（开仓、平仓、爆仓场景）
  - 参数平衡调整（保证金率、杠杆倍数）
  - 极端市场条件下系统稳定性测试
  - 与产业链系统的联动测试

### 技术方案

```javascript
// 新增模块: scripts/derivatives-system.js
const createDerivativesSystem = ({
  st,          // 游戏状态
  market,      // 市场系统
  eventBus,    // 事件总线
}) => {
  // 期货合约
  const futures = {
    // 做多/做空市场趋势
    long: { margin: 0.1, leverage: [2, 5, 10] },
    short: { margin: 0.1, leverage: [2, 5, 10] },
  };

  // 期权合约
  const options = {
    // 购买牛市/熊市保险
    call: { premium: 0.05, strikePrice: null },
    put: { premium: 0.05, strikePrice: null },
  };

  // 对冲策略
  const hedging = {
    // 自动对冲比例设置
    autoHedge: false,
    hedgeRatio: 0.3, // 30% 仓位对冲
  };
};
```

### 实施步骤

1. **Week 1**: 基础架构
   - [ ] 创建 derivatives-system.js 模块
   - [ ] 定义期货/期权数据结构
   - [ ] 设计 UI 面板（衍生品交易界面）

2. **Week 2**: 核心逻辑
   - [ ] 实现保证金计算
   - [ ] 实现杠杆机制
   - [ ] 实现爆仓/强平逻辑
   - [ ] 与市场系统联动

3. **Week 3**: 期权系统
   - [ ] 期权定价模型（简化版 Black-Scholes）
   - [ ] 行权/到期逻辑
   - [ ] 权利金计算

4. **Week 4**: 测试与平衡
   - [ ] 单元测试
   - [ ] 参数平衡调整
   - [ ] 集成测试
   - [ ] 文档更新

### 预期影响

- 增加策略深度：玩家可通过衍生品对冲风险或放大收益
- 增加高风险高回报玩法
- 与市场系统形成更深联动

---

## P6-T2: 产业链联动 🚧 进行中

**优先级**: 🔴 高  
**预计工期**: 2-3 周  
**前置依赖**: 无（建议优先实施）  
**进度**: 核心框架已实现，GPS加成已集成，UI面板已添加

### ✅ 已完成任务

- [x] **1. 建筑数据 synergy 属性配置** (scripts/game-data.js)
  - 为全部8种建筑添加上下游联动关系
  - 设定加成比例：上游3-6%，下游3-6%，根据建筑类型不同
  - Workshop→Factory→Logistics→RealEstate→Bank→Fund→CentralBank→Conglomerate

- [x] **2. synergy-system.js 加成计算模块** (scripts/synergy-system.js)
  - 单个建筑加成计算 `calculateBuildingSynergy()`
  - 全局加成汇总 `calculateGlobalSynergy()`
  - 上游/下游计数与加成计算逻辑
  - 事件通知机制 `synergy:activated`

- [x] **3. GPS 计算集成产业链加成** (scripts/economy-system.js)
  - 添加 `setSynergyMultiplier()` 回调接口
  - 修改 GPS 公式：`baseGPS * gpsMultiplier * ... * synergyMult`

- [x] **4. UI 提示显示加成** (scripts/game.js)
  - 产业链联动面板渲染 `renderGlobalSynergyPanel()`
  - 动态插入到排行榜和每日任务之间
  - 30秒自动刷新机制
  - 调试命令：`window.getSynergyInfo(buildingId)`

### 待完成任务

- [ ] **5. 测试与平衡调整**
  - 验证各建筑加成数值是否合理（目标：总加成15-25%）
  - 检查极端情况下加成是否会过高
  - 根据测试反馈微调上下游加成比例
  - 确保与现有经济系统的平衡性

### 技术方案

```javascript
// 修改: scripts/game-data.js - 建筑配置增加联动属性
const buildings = [
  {
    id: "workshop",
    name: "手工作坊",
    // ... 原有属性
    synergy: {
      // 产业链加成
      upstream: null,     // 上游产业
      downstream: ["factory"], // 下游产业
      bonusPerDownstream: 0.05, // 每个下游建筑+5%产出
    },
  },
  {
    id: "factory",
    name: "轻工厂",
    synergy: {
      upstream: ["workshop"],
      downstream: ["corp"],
      bonusPerUpstream: 0.03, // 每个上游建筑+3%产出
    },
  },
];

// 新增模块: scripts/synergy-system.js
const calculateSynergyBonus = (building, allBuildings) => {
  let bonus = 1.0;

  // 上游加成
  if (building.synergy?.upstream) {
    const upstreamCount = building.synergy.upstream.reduce((sum, id) => {
      const b = allBuildings.find(x => x.id === id);
      return sum + (b?.owned || 0);
    }, 0);
    bonus += upstreamCount * (building.synergy.bonusPerUpstream || 0);
  }

  // 下游加成
  if (building.synergy?.downstream) {
    const downstreamCount = building.synergy.downstream.reduce((sum, id) => {
      const b = allBuildings.find(x => x.id === id);
      return sum + (b?.owned || 0);
    }, 0);
    bonus += downstreamCount * (building.synergy.bonusPerDownstream || 0);
  }

  return bonus;
};
```

### 实施步骤

1. **Week 1**: 数据结构
   - [ ] 为所有建筑添加 synergy 属性
   - [ ] 设计产业链图（手工作坊→工厂→公司→银行→央行）
   - [ ] 确定加成数值

2. **Week 2**: 核心逻辑
   - [ ] 创建 synergy-system.js
   - [ ] 实现加成计算
   - [ ] 修改 GPS 计算（加入产业链加成）
   - [ ] 添加 UI 提示（显示当前加成）

3. **Week 3**: 优化与测试
   - [ ] 性能优化（缓存加成计算）
   - [ ] 平衡性测试
   - [ ] 更新教程说明产业链机制

### 预期影响

- 改变购买策略：玩家需考虑产业链布局
- 增加建筑间相互依赖
- 为后期建筑（银行/央行）增加前置价值

---

## P6-T3: 全球化市场 🚧 进行中

**优先级**: 🟡 中  
**预计工期**: 2-3 周  
**前置依赖**: P6-T2 产业链联动（已完成）  
**进度**: 核心框架已实现，多地区市场已集成，GPS公式已更新

### ✅ 已完成任务

- [x] **1. 创建 global-market-system.js 模块**
  - 模块工厂函数 `createGlobalMarketSystem()`
  - 数据持久化结构 (st.globalMarket)
  - 事件总线集成
  - 多语言支持 (I18N)

- [x] **2. 定义地区数据结构**
  - 亚洲市场 (Asia): UTC+8, 波动率1.2x, 科技驱动
  - 欧洲市场 (Europe): UTC+0, 波动率1.0x, 金融主导
  - 美洲市场 (America): UTC-5, 波动率1.3x, 消费驱动
  - 各地区独立价格、趋势、事件状态

- [x] **3. 地区切换与加成系统**
  - `switchRegion(regionId)` 切换当前市场
  - 地区生产加成 `productionBonus` (70%-130%)
  - 地区投资加成 `investmentBonus`
  - GPS公式集成地区加成因子 `regionMult()`

- [x] **4. 跨地区套利系统**
  - 自动检测价格差异 (>5%触发)
  - 套利交易执行 `executeArbitrage()`
  - 日限额机制 (每日5次)
  - 冷却时间 60秒
  - 手续费 0.5%

- [x] **5. 地区特定事件系统**
  - 亚洲: 科技繁荣、货币危机、贸易协定
  - 欧洲: 欧央行政策、脱欧影响、绿色协议
  - 美洲: 美联储加息、科技股IPO、衰退恐慌
  - 事件效果: 生产加成/投资加成/波动率变化

- [x] **6. 跨地区投资系统**
  - 向任意地区投资 `investInRegion()`
  - 每秒收益 0.1% * 地区投资加成
  - 实时收益计算

- [x] **7. UI面板与集成**
  - 地区列表面板 `renderRegionPanel()`
  - 套利机会面板 `renderArbitragePanel()`
  - 投资统计面板 `renderInvestmentPanel()`
  - game.js 集成与 5秒自动刷新
  - economy-system.js GPS加成集成
  - 调试命令: switchRegion, getRegionInfo, executeArbitrage, investInRegion

### 待完成任务

- [ ] **8. 测试与优化**
  - 套利平衡性测试（防止过度套利）
  - 地区切换流畅度优化
  - 事件触发频率校准
  - 多地区数据同步测试

### 技术方案

```javascript
// 新增模块: scripts/global-market-system.js
const createGlobalMarketSystem = ({
  st,
  market,
}) => {
  // 多地区市场
  const regions = {
    asia: { timezone: 8, volatility: 1.2, trend: 'bull' },
    europe: { timezone: 0, volatility: 1.0, trend: 'bear' },
    america: { timezone: -5, volatility: 1.3, trend: 'sideways' },
  };

  // 跨地区套利
  const arbitrage = {
    enabled: false,
    detectPriceDiff: () => {
      // 检测不同地区价格差异
    },
  };

  // 地区特定事件
  const regionalEvents = {
    asia: ['tech_boom', 'currency_crisis'],
    europe: ['ecb_policy', 'brexit_aftermath'],
    america: ['fed_rate', 'tech_ipo'],
  };
};
```

### 实施步骤

1. **Week 1**: 基础架构
   - [ ] 创建 global-market-system.js
   - [ ] 定义地区数据结构
   - [ ] 设计地区切换 UI

2. **Week 2**: 多市场逻辑
   - [ ] 实现不同时区市场波动
   - [ ] 实现跨地区套利检测
   - [ ] 地区特定事件系统

3. **Week 3**: 集成与优化
   - [ ] 与现有市场系统集成
   - [ ] UI 优化（显示多地区信息）
   - [ ] 性能测试

### 预期影响

- 增加全球市场视野
- 引入时差交易策略
- 丰富事件系统

---

## P6-T4: 危机事件系统

**优先级**: 🟡 中  
**预计工期**: 1-2 周  
**前置依赖**: 无（可独立实施）

### 技术方案

```javascript
// 新增模块: scripts/crisis-system.js
const createCrisisSystem = ({
  st,
  eventBus,
  buildings,
}) => {
  const crises = {
    financial_crisis: {
      probability: 0.001, // 每日 0.1% 概率
      duration: 300, // 5 分钟
      effects: {
        gpsMultiplier: 0.5,
        buildingEfficiency: 0.7,
      },
      recovery: {
        type: 'bailout', // 或 'wait_out'
        cost: () => st.lifetimeGears * 0.1,
      },
    },
    pandemic: {
      probability: 0.0005,
      duration: 600,
      effects: {
        manualPower: 0.5,
        offlineRate: 0.3,
      },
    },
    cyber_attack: {
      probability: 0.0003,
      duration: 60,
      effects: {
        autoBuyDisabled: true,
        marketFrozen: true,
      },
    },
  };
};
```

### 实施步骤

1. **Week 1**: 核心机制
   - [ ] 创建 crisis-system.js
   - [ ] 定义危机类型和效果
   - [ ] 实现危机触发逻辑
   - [ ] 实现危机恢复机制

2. **Week 2**: UI 与平衡
   - [ ] 危机警告 UI
   - [ ] 危机期间特效
   - [ ] 参数平衡
   - [ ] 测试

### 预期影响

- 增加游戏挑战性
- 引入黑天鹅事件
- 测试玩家应变能力

---

## P6-T5: 联盟/公会系统

**优先级**: 🟢 低  
**预计工期**: 3-4 周  
**前置依赖**: 其他所有 Phase 6 任务完成

### 技术方案

```javascript
// 新增模块: scripts/guild-system.js
const createGuildSystem = ({
  st,
  I18N,
}) => {
  // 由于纯前端限制，使用本地存储模拟
  const guilds = {
    // 预定义的一些"虚拟公会"
    alpha_traders: { name: 'Alpha Traders', members: 42, totalPower: 1e12 },
    beta_investors: { name: 'Beta Investors', members: 38, totalPower: 8e11 },
    gamma_holders: { name: 'Gamma Holders', members: 55, totalPower: 1.5e12 },
  };

  // 玩家可选择加入一个公会
  const joinGuild = (guildId) => {
    // 获得公会加成
  };

  // 公会贡献
  const contribute = (amount) => {
    // 贡献资源，提升公会等级
    // 获得个人奖励
  };

  // 公会排行榜
  const guildLeaderboard = () => {
    // 显示各公会排名
  };
};
```

### 实施步骤

1. **Week 1**: 基础架构
   - [ ] 创建 guild-system.js
   - [ ] 定义预置公会数据
   - [ ] 设计公会 UI

2. **Week 2**: 核心功能
   - [ ] 实现公会选择/切换
   - [ ] 实现公会加成计算
   - [ ] 实现贡献系统

3. **Week 3**: 社交功能
   - [ ] 公会排行榜
   - [ ] 公会成就
   - [ ] 公会事件

4. **Week 4**: 测试与优化
   - [ ] 平衡性测试
   - [ ] 性能优化
   - [ ] 文档

### 预期影响

- 增加社交归属感
- 引入团队协作元素
- 延长游戏生命周期

---

## 实施顺序建议

### 推荐路径 A（平衡型）
```
Week 1-2:  P6-T2 产业链联动
Week 3-4:  P6-T4 危机事件系统
Week 5-6:  P6-T1 金融衍生品
Week 7-8:  P6-T3 全球化市场
Week 9-12: P6-T5 联盟/公会
```

### 推荐路径 B（深度优先型）
```
Week 1-3:  P6-T2 产业链联动
Week 4-7:  P6-T1 金融衍生品
Week 8-9:  P6-T4 危机事件系统
Week 10-11: P6-T3 全球化市场
Week 12-15: P6-T5 联盟/公会
```

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 金融衍生品过于复杂 | 中 | 高 | 提供简化模式，可选开启 |
| 产业链联动计算性能问题 | 中 | 中 | 缓存计算结果，增量更新 |
| 危机事件平衡性 | 高 | 中 | 大量测试，提供难度选项 |
| 多市场系统复杂度 | 中 | 中 | 先实现2个地区，逐步扩展 |

---

## 成功指标

- [ ] 平均游戏时长增加 30%
- [ ] 7日留存率提升 10%
- [ ] 用户付费率提升
- [ ] 社区讨论活跃度提升（Discord/论坛）
- [ ] 新功能使用率达到 60%

---

## 附录

### 新增脚本文件清单

| 文件 | 描述 |
|------|------|
| `scripts/derivatives-system.js` | 金融衍生品系统 |
| `scripts/synergy-system.js` | 产业链联动系统 |
| `scripts/global-market-system.js` | 全球化市场系统 |
| `scripts/crisis-system.js` | 危机事件系统 |
| `scripts/guild-system.js` | 联盟/公会系统 |

### 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `scripts/game-data.js` | 添加建筑 synergy 属性 |
| `scripts/game.js` | 集成新系统 |
| `index.html` | 添加新脚本引用 |

---

*创建日期*: 2026-02-28  
*版本*: v1.0
