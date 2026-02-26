# Iteration H TODO

- 日期：2026-02-26
- 垂直切片：docs-skill
- 目标：补齐迭代产物校验链

## 任务清单
- [ ] 仅修改一个垂直切片
- [ ] 更新 `docs/roadmaps/MULTI_FILE_ARCH_ROADMAP.md`
- [ ] 追加 `docs/roadmaps/ROLLING_UPDATE_LOG.md`
- [ ] 高价值事件回放（订单完成 / Prestige）
- [ ] 运行 `npm run check`
- [ ] 提交 commit
- [ ] 创建 PR

## 命令
```bash
npm run check
python3 skills/crazy-factory-iteration/scripts/add_iteration_log.py \
  --id H \
  --goal "补齐迭代产物校验链" \
  --changes "<填写改动>" \
  --checks "npm run check" \
  --rollback "<填写回滚点>"
```
