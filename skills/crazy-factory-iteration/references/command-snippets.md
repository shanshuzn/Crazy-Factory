# 命令片段

## 标准校验
```bash
npm run check
```

## 初始化本轮 TODO
```bash
python3 skills/crazy-factory-iteration/scripts/bootstrap_iteration.py \
  --id G \
  --slice "fx-event" \
  --goal "统一反馈事件契约"
```

## 追加一条滚动更新日志
```bash
python3 skills/crazy-factory-iteration/scripts/add_iteration_log.py \
  --id F \
  --goal "阶段3反馈优化" \
  --changes "拆分 gameFeel 订阅到 fx 模块" \
  --checks "npm run check" \
  --rollback "回到 bootstrap 内联订阅"
```

## 校验技能本身
```bash
python3 /opt/codex/skills/.system/skill-creator/scripts/quick_validate.py skills/crazy-factory-iteration
```
