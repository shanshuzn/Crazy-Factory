# AGENTS.md (metrics-driven-mode)

<!-- AGENTS:CONFIG
version: 1
anchors:
  roadmap_auto_start: "<!-- AUTO:METRICS-START -->"
  roadmap_auto_end: "<!-- AUTO:METRICS-END -->"

north_star:
  # 从 output/tuning_report.json -> top1.score.V_total 映射到百分比
  source: "output/tuning_report.json:top1.score.V_total"
  scale: 100

supporting_metrics:
  - key: "growth_momentum"
    source: "output/tuning_report.json:top1.score.components.growth_momentum"
  - key: "return_quality"
    source: "output/tuning_report.json:top1.score.components.return_quality"
  - key: "upgrade_satisfaction"
    source: "output/tuning_report.json:top1.score.components.upgrade_satisfaction"
  - key: "progress_clarity"
    source: "output/tuning_report.json:top1.score.components.progress_clarity"
  - key: "stability_score"
    source: "output/tuning_report.json:top1.score.components.stability_score"

risk_metrics:
  - key: "fail_rate"
    source: "output/tuning_report.json:top1.score.fail_rate"
  - key: "longest_stall_median_seconds"
    source: "output/tuning_report.json:top1.score.bottleneck.longest_stall_median_seconds"
  - key: "constraint_failed"
    source: "output/tuning_report.json:top1.score.constraint_failed"

modes:
  acceleration:
    when:
      north_star_pct_lt: 50
  optimization:
    when:
      north_star_pct_gte: 50
      north_star_pct_lt: 85
  hardening:
    when_any:
      north_star_pct_gte: 85
      risk_level_eq: "高"
  recovery:
    when_any:
      accepted_eq: false
      trend_eq: "down"

risk_level_rules:
  high:
    when_any:
      accepted_eq: false
  medium:
    when_any:
      fail_rate_gt: 0.01
      stall_gt_sec: 1200
  low:
    default: true
END:AGENTS:CONFIG -->


目标：
以“北极星指标”为核心驱动开发，
根据可量化指标自动调整推进策略。

========================================
必须在 ROADMAP.md 定义
========================================

## North Star Metric
定义产品的核心成功指标，例如：
- 核心流程成功率 ≥ 95%
- 用户完成关键任务时间 ≤ 2分钟
- API 成功响应率 ≥ 99%
- 每日活跃功能使用 ≥ 1次

## Supporting Metrics
支撑指标，例如：
- 接口响应时间
- 错误率
- 功能覆盖率
- 测试覆盖率

## Risk Metrics
风险指标，例如：
- DEBT 数量
- 核心流程失败次数
- 高风险模块改动频率

========================================
每轮必须评估
========================================

1. North Star Status（达成度 %）
2. Supporting Metrics 状态
3. Risk Level（低 / 中 / 高）

========================================
自动模式选择
========================================

🔥 Acceleration Mode（加速模式）

触发：
- North Star < 50%
- 指标无明显改善

策略：
- 优先直接提升 North Star 的功能
- 允许简化实现
- 优先打通关键路径

----------------------------------------

⚡ Optimization Mode（优化模式）

触发：
- North Star 50% ~ 85%
- 核心路径可运行

策略：
- 优化 Supporting Metrics
- 提升稳定性与体验
- 控制新增风险

----------------------------------------

🛡 Hardening Mode（强化模式）

触发：
- North Star ≥ 85%
- 或 Risk Level = 高

策略：
- 优先降低 Risk Metrics
- 清理高风险 DEBT
- 强化测试与异常处理

----------------------------------------

🚑 Recovery Mode（恢复模式）

触发：
- 核心指标下降
- 核心流程不可运行

策略：
- 立即修复
- 暂停扩展
- 恢复后重新评估

========================================
通用规则
========================================

R1 若有 (NEXT) 必做，否则按当前模式选任务。
R2 每轮仅 1 个任务。
R3 DONE 必须写日期 + 指标影响说明。
R4 必须说明本轮对 North Star 的影响（+ / - / 0）。
R5 NEXT 必须唯一。
R6 不输出完整 ROADMAP.md，仅输出 diff。

========================================
输出格式
========================================

[Mode]
当前模式

[North Star]
当前估算值 + 变化趋势

[Supporting Metrics]
关键指标变化

[Risk Level]
低 / 中 / 高

[Task]
id / acceptance

[Impact]
对 North Star 的影响说明

[Do]
- 修改文件列表
- 实现摘要

[Verify]
运行方式 / 示例 / 指标验证

[RoadmapPatch]
(diff only)

[Next]
next_id
