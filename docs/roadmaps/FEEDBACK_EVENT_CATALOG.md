# Feedback 事件清单（Phase 3）

## 目标
- 明确反馈事件契约，避免事件名分散导致的订阅/分发错配。
- 为后续 FX 演出扩展提供稳定输入，不直接耦合经济/存档逻辑。

## 事件列表

### `onManualClick`
- 触发时机：玩家手动点击生产时。
- payload：`{ gain: number }`
- 默认演出：按钮 pop + 浮字 + click 音效。

### `onBigReward`
- 触发时机：领取齿轮/RP 奖励时。
- payload：`{ text: string, kind?: "gear"|"rp", priority?: "normal"|"high", anchorEl?: HTMLElement }`
- 默认演出：浮字 + 面板脉冲 + reward 音效。

### `onTaskComplete`
- 触发时机：阶段任务完成时。
- payload：`{ title: string }`
- 默认演出：任务高光 + 震屏 + order 音效。

### `onOrderComplete`
- 触发时机：生产订单完成并领取时。
- payload：`{ title: string }`
- 默认演出：订单高光 + 订单面板脉冲 + 震屏 + order 音效。

### `onPrestige`
- 触发时机：执行 Prestige 时。
- payload：`{ gain: number }`
- 默认演出：Prestige 高光 + 震屏 + prestige 音效。

## 使用约束
- 逻辑层只调用 `emitFeedback(...)`，不直接拼装表现细节。
- FX 层通过 `attachGameFeelHandlers(...)` 订阅并实现表现。
- 新增事件时，必须同步：
  1. `src/fx/events.js` 常量定义
  2. `scripts/module_checks.mjs` 覆盖
  3. 本清单文档
