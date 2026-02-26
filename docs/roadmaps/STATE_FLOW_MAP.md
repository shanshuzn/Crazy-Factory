# 状态流转图（Phase 4）

## 主循环状态流

```txt
input(click / controls)
  -> mutate state (core runtime)
  -> emit feedback events
  -> render ui
  -> autosave snapshot
```

## 存档流

```txt
load raw save
  -> migrateSaveData(raw, SAVE_VERSION)
  -> hydrate runtime state
  -> normalize runtime values
  -> render
```

## 订单流

```txt
ensureOrder()
  -> pickWeightedOrderTemplate()
  -> createOrderFromTemplate()
  -> state.activeOrder

claim order
  -> getOrderProgress()
  -> grantReward()
  -> emit onOrderComplete
  -> rotate next order
```

## Prestige 流

```txt
calc gain (economySystem)
  -> apply RP/meta carry
  -> emit onPrestige
  -> resetRunState
  -> save + render
```

## 反馈流

```txt
business emitFeedback(FEEDBACK_EVENTS.*)
  -> feedbackBus.emit(...)
  -> attachGameFeelHandlers subscribers
  -> visual/audio effects
```

## 边界原则

- 状态写入集中在 `bootstrap`。
- 纯计算集中在 `systems`。
- 反馈执行集中在 `fx`。
- UI 更新集中在 `ui`。
