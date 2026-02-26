# 模块依赖图（Phase 4）

> 目标：明确“谁可以依赖谁”，避免回到单文件耦合。

## 依赖层级（自上而下）

```txt
src/main.js
  -> src/app/bootstrap.js
      -> src/core/*
      -> src/systems/*
      -> src/ui/*
      -> src/fx/*

src/ui/*
  -> 只接收参数 / DOM 引用（不反向依赖 systems）

src/systems/*
  -> 可依赖 src/core/constants.js
  -> 不依赖 ui/fx/app

src/fx/*
  -> 可依赖 src/fx/events.js
  -> 不依赖 systems 内部状态实现
```

## 当前模块清单

- `src/main.js`
  - 入口层，仅调用 `boot()`。
- `src/app/bootstrap.js`
  - 组装层，连接 state/systems/ui/fx。
- `src/core/constants.js`
  - 常量层，提供数值与阈值。
- `src/core/state.js`
  - 初始状态工厂。
- `src/core/saveMigrations.js`
  - 存档迁移映射与入口。
- `src/systems/economySystem.js`
  - 纯经济计算。
- `src/systems/taskSystem.js`
  - 订单/任务纯函数。
- `src/systems/audioSystem.js`
  - 音效合成与节流门。
- `src/fx/events.js`
  - 反馈事件常量。
- `src/fx/feedbackBus.js`
  - 事件总线。
- `src/fx/gameFeelSystem.js`
  - 反馈订阅执行。
- `src/ui/renderTopbar.js`
  - 顶部信息渲染。
- `src/ui/renderPanels.js`
  - 栏目折叠/提醒渲染。
- `src/ui/bindControls.js`
  - 控件事件绑定。

## 守则

1. `systems` 新增函数默认做纯函数，避免 DOM 和 localStorage。
2. `app/bootstrap` 负责“连线”，不新增复杂业务计算。
3. 反馈效果只通过 `FEEDBACK_EVENTS` 分发，禁止业务层直接硬编码效果字符串。
