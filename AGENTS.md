# AGENTS.md (finance-idle-metrics-mode)

<!-- AGENTS:CONFIG
version: 1
anchors:
  roadmap_auto_start: "<!-- AUTO:METRICS-START -->"
  roadmap_auto_end: "<!-- AUTO:METRICS-END -->"

north_star:
  # 180天风险调整收益（简化Sharpe）
  source: "output/tuning_report.json:metrics.risk_adjusted_return_180"
  scale: 1.0

supporting_metrics:
  - key: "cagr_180"
    source: "output/tuning_report.json:metrics.cagr_180"
  - key: "max_drawdown_180"
    source: "output/tuning_report.json:metrics.max_drawdown_180"
  - key: "active_system_count"
    source: "output/tuning_report.json:metrics.active_system_count"
  - key: "market_stability_score"
    source: "output/tuning_report.json:metrics.market_stability_score"

risk_metrics:
  - key: "bankruptcy_flag"
    source: "output/tuning_report.json:metrics.bankruptcy_flag"
  - key: "blowup_rate"
    source: "output/tuning_report.json:metrics.blowup_rate"
  - key: "fail_rate"
    source: "output/tuning_report.json:metrics.fail_rate"

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
      bankruptcy_flag_eq: true
      trend_eq: "down"

risk_level_rules:
  high:
    when_any:
      bankruptcy_flag_eq: true
      max_drawdown_180_gt: 0.7
  medium:
    when_any:
      max_drawdown_180_gt: 0.5
      blowup_rate_gt: 0.1
  low:
    default: true

END:AGENTS:CONFIG -->
