# 滚动更新日志（Multi-file 迁移）

> 用于记录每轮拆分的“目标 / 改动 / 校验 / 回滚点”，确保迭代可追踪。

## 2026-02-26 / Iteration A
- 目标：单文件拆分为 `src/ + styles/`。
- 改动：抽离 `main.js` / `main.css`，改为模块入口。
- 校验：`economy_checks`、`kpi_dashboard_checks`。
- 回滚点：`index.html` 回内联版本。

## 2026-02-26 / Iteration B
- 目标：阶段2系统解耦。
- 改动：落地 `economySystem/taskSystem/audioSystem` 纯函数/模块化。
- 校验：`module_checks` + 经济脚本。
- 回滚点：`bootstrap` 回内联实现。

## 2026-02-26 / Iteration C
- 目标：阶段3反馈事件化。
- 改动：`FEEDBACK_EVENTS` + `gameFeelSystem` + 事件清单文档。
- 校验：`module_checks` 覆盖 `gameFeelSystem`。
- 回滚点：`bootstrap` 直接调用 FX 函数。

## 2026-02-26 / Iteration D
- 目标：阶段4工程化收口（文档闭环）。
- 改动：新增模块依赖图、状态流转图、滚动更新日志。
- 校验：`npm run check`。
- 回滚点：保留仅 README 路线索引。


## 2026-02-26 / Iteration E
- 目标：沉淀可复用的仓库迭代 skill。
- 改动：新增 `skills/crazy-factory-iteration/`（SKILL + checks 脚本 + checklist 参考）。
- 校验：`bash skills/crazy-factory-iteration/scripts/run_iteration_checks.sh` + skill validate/package。
- 回滚点：仅保留路线图文档，不使用本地 skill。


## 2026-02-26 / Iteration F
- 目标：迭代skill能力
- 改动：新增日志追加脚本与命令片段参考
- 校验：npm run check + skill validate/package
- 回滚点：回退到手工维护日志


## 2026-02-26 / Iteration G
- 目标：发展 skill 的执行效率。
- 改动：新增 `bootstrap_iteration.py` 与切片执行手册，强化迭代前置模板化。
- 校验：`npm run check` + skill validate/package。
- 回滚点：回退到手工写 TODO。

## 模板（后续复用）
```md
## YYYY-MM-DD / Iteration X
- 目标：
- 改动：
- 校验：
- 回滚点：
```
