---
name: crazy-factory-iteration
description: "Use when iterating on the Crazy-Factory repo with modular refactors, roadmap-driven decomposition, and required commit+PR flow. Trigger for requests like 迭代, 迭代skill, 按照路线图发展, 更新路线图, 创建/扩展 systems-ui-fx-core modules, adding checks, and keeping docs/roadmaps synchronized with implementation progress."
---

# Crazy Factory Iteration

执行 Crazy-Factory 的日常迭代闭环：代码切片、校验、路线图同步、提交与 PR。

## Workflow

1. 读取当前路线图：`docs/roadmaps/MULTI_FILE_ARCH_ROADMAP.md`。
2. 用 `scripts/bootstrap_iteration.py` 生成本轮 TODO。
3. 选择一个垂直切片（系统 / UI / FX / 文档闭环），只做一件事。
4. 更新路线图文档；必要时用脚本追加 `ROLLING_UPDATE_LOG.md`。
5. 运行校验命令（优先执行 `npm run check`）。
6. 提交 commit，并创建 PR。

## Iteration Rules

- 保持 MVP：每次迭代只推进一个清晰目标。
- 逻辑与表现分离：
  - 业务逻辑在 `src/systems` / `src/core`
  - 反馈在 `src/fx`
  - 渲染/绑定在 `src/ui`
- 新增反馈事件时，必须同步：
  1. `src/fx/events.js`
  2. `scripts/module_checks.mjs`
  3. `docs/roadmaps/FEEDBACK_EVENT_CATALOG.md`
- 路线图同步必须落地：
  - `docs/roadmaps/MULTI_FILE_ARCH_ROADMAP.md`
  - `docs/roadmaps/ROLLING_UPDATE_LOG.md`

## Execution Commands

先跑统一入口：

```bash
npm run check
```

必要时补跑：

```bash
node scripts/module_checks.mjs
node scripts/economy_checks.js
node scripts/kpi_dashboard_checks.js
```

复用脚本：

- `scripts/run_iteration_checks.sh`
- `scripts/bootstrap_iteration.py`
- `scripts/add_iteration_log.py`
- 参考命令：`references/command-snippets.md`、`references/slice-playbook.md`

## Output Contract

- 变更说明必须包含：
  - 本次切片目标
  - 修改文件
  - 校验命令结果
  - 路线图更新位置
- 若是可感知 UI 变化，补截图流程（按仓库现有截图脚本）。
