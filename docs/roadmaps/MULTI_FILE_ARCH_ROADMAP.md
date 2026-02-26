# 多文件化路线图（MVP → 可维护架构）

## 目标
- 将当前单页逻辑逐步拆分为“状态层 / 系统层 / UI层 / 反馈层”，降低耦合并提升可迭代性。
- 保持现有可玩性不回退，确保每个阶段都可运行、可验证、可回滚。
- 为后续数值平衡、Vibe 反馈迭代与自动化校验预留稳定接口。

## 阶段 0（已完成）
- `index.html` 内联 CSS/JS 已拆分：
  - `styles/main.css`
  - `src/main.js`
- 交付标准：页面行为与原版一致，核心校验脚本通过。

## 阶段 1：建立目录边界（已完成）

### 目录规划
```txt
src/
  core/
    state.js            # 单一状态容器与快照
    constants.js        # 所有可调参数（价格、tick、反馈阈值）
  systems/
    economySystem.js    # 价格、购买、离线收益、Prestige
    taskSystem.js       # 成就、任务、订单逻辑
    audioSystem.js      # 事件音效调度与低性能保护
  ui/
    renderTopbar.js     # 资源区渲染
    renderPanels.js     # 经济/目标栏目渲染
    bindControls.js     # 按钮与交互绑定
  fx/
    feedbackBus.js      # 反馈事件总线（解耦逻辑与表现）
    screenPulse.js      # 脉冲/震屏
    floatingText.js     # 浮字与并发分级
  app/
    bootstrap.js        # 初始化、主循环装配
```

### 交付项
- ✅ 已将入口切分为 `src/main.js` + `src/app/bootstrap.js`，通过 bootstrap 统一启动。
- ✅ 已将“可调手感参数/核心阈值”集中到 `src/core/constants.js`。
- ✅ 已引入 `src/fx/feedbackBus.js` 作为反馈事件总线边界。

### 验收标准
- `node --check` 覆盖所有新增 JS 文件通过。
- `node scripts/economy_checks.js` 通过。
- `node scripts/kpi_dashboard_checks.js` 通过。

## 阶段 2：系统解耦与防回归（1~2 个迭代）

### 重点任务
- ✅ 已落地 `src/systems/economySystem.js` 纯计算函数（价格曲线/当前价格/Prestige收益），并由 bootstrap 调用。
- ✅ 已落地 `src/systems/taskSystem.js` 纯函数（订单加权选择/订单生成/进度计算），并由 bootstrap 调用。
- ✅ 已落地 `src/systems/audioSystem.js` 音效合成与低性能保护逻辑，并由 bootstrap 调用。
- ✅ 已落地 `src/ui/renderTopbar.js` 顶部资源与摘要渲染，bootstrap 改为传参与调用。
- ✅ 已落地 `src/ui/renderPanels.js`（栏目折叠态 + 目标红点提醒渲染）。
- ✅ 已落地 `src/ui/bindControls.js`（顶部控制条与栏目折叠交互绑定）。
- 将“纯计算”与“副作用”分离：
  - 纯函数：价格计算、奖励结算、订单生成。
  - 副作用：DOM 更新、音频播放、localStorage。
- ✅ 已新增 `scripts/module_checks.mjs`，覆盖 `core/state`、`fx/feedbackBus`、`systems/economy+task` 模块级回归。
- ✅ 已落地 `src/core/saveMigrations.js`（`SAVE_MIGRATIONS` 映射表 + 统一迁移入口）。
- 为 `core` 与 `systems` 持续补充最小单测（Node 可跑，无浏览器依赖）。
- 存档兼容策略：新增 `SAVE_VERSION` 迁移映射表，避免后续字段调整导致坏档。

### 验收标准
- 新增 `scripts/*_checks.js` 的模块级回归脚本可独立运行。
- `node scripts/module_checks.mjs` 通过。
- ✅ `scripts/module_checks.mjs` 已覆盖 `src/fx/gameFeelSystem.js` 反馈订阅回归。
- `scripts/module_checks.mjs` 已覆盖存档迁移映射回归（v1→v4）。
- `scripts/module_checks.mjs` 已覆盖音效节流门（normal/safe 冷却阈值）回归。
- 老存档导入成功率维持 100%。

## 阶段 3：Vibe 反馈工程化（1 个迭代）

### 反馈架构
- 使用 `feedbackBus` 统一事件：
- ✅ 已在 bootstrap 中落地 `onManualClick/onBigReward/onTaskComplete/onOrderComplete/onPrestige` 事件分发与订阅。
- ✅ 已新增 `src/fx/gameFeelSystem.js`，将阶段3反馈订阅从 bootstrap 拆出为独立 FX 组合器。
  - `onManualClick`
  - `onBigReward`
  - `onOrderComplete`
  - `onPrestige`
- 每个反馈模块只订阅事件，不反向依赖经济逻辑。

### 性能约束（必须遵守）
- 动画只改 `transform/opacity`，避免频繁触发布局。
- 浮字节点池化，避免每帧创建/销毁 DOM 造成 GC 抖动。
- 高频音效节流（低性能模式下提高冷却阈值）。
- ✅ 已在 `src/systems/audioSystem.js` 落地按事件类型节流门（低性能模式使用更长冷却阈值）。

### 验收标准
- 30 分钟稳定性脚本通过。
- 低性能模式下无明显卡顿峰值。

## 阶段 4：工程化收口（1 个迭代）
- 增加 `npm scripts` 统一命令入口（check/test/sim/screenshot）。
- ✅ 已新增 `package.json` 并提供 `serve/check/sim/screenshot` 统一命令入口。
- 文档补齐：
  - 模块依赖图（`docs/roadmaps/MODULE_DEPENDENCY_MAP.md`）
  - 状态流转图（`docs/roadmaps/STATE_FLOW_MAP.md`）
  - 反馈事件清单（`docs/roadmaps/FEEDBACK_EVENT_CATALOG.md`）
- ✅ 已补齐模块依赖图与状态流转图文档。
- 在 `docs/roadmaps` 维护“滚动更新日志”，确保每轮拆分可追踪（`docs/roadmaps/ROLLING_UPDATE_LOG.md`）。
- ✅ 已新增滚动更新日志文档并沉淀迭代模板。

## 里程碑清单
- M1：目录边界建立 + 主循环可运行。
- M2：核心系统纯函数化 + 存档迁移稳定。
- M3：反馈系统事件化 + 性能基线达标。
- M4：工程命令统一 + 文档闭环。

## 风险与控制
- 风险：一次性大拆分导致行为偏差。
  - 控制：按系统逐块迁移，每块迁移后立即跑 `economy_checks`。
- 风险：反馈特效过度导致性能下降。
  - 控制：默认开启并发上限与降级策略，先保帧率再加特效。

## 执行口径
- 每次只做一个垂直切片（例如“订单系统 + 订单UI + 订单反馈”）。
- 每次提交必须附带可执行校验命令。
- 任一阶段出现回归，优先修复稳定性，不叠加新功能。
