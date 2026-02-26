# 垂直切片执行手册

## 原则
- 一次只推进一个切片：`systems` / `ui` / `fx` / `docs`。
- 每个切片都需要“代码改动 + 路线图记录 + 校验结果”。

## 常见切片模板

### systems 切片
- 目标：新增/重构纯函数，不改 UI。
- 必做：`scripts/module_checks.mjs` 增加断言。
- 文档：更新 `MULTI_FILE_ARCH_ROADMAP.md` 阶段2。

### ui 切片
- 目标：抽离渲染/绑定逻辑，保持行为不变。
- 必做：`npm run check`。
- 文档：更新 `ROLLING_UPDATE_LOG.md`，记录回滚点。

### fx 切片
- 目标：事件化反馈或演出参数收敛。
- 必做：同步 `src/fx/events.js` + `FEEDBACK_EVENT_CATALOG.md`。
- 文档：更新阶段3进展。

### docs 切片
- 目标：补齐依赖图/流转图/运行手册。
- 必做：`npm run check`（确认文档改动未影响脚本链）。
- 文档：更新 `ROLLING_UPDATE_LOG.md` 模板记录。
