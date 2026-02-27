# 金融帝国（Idle/Incremental）路线图

## 目标
以“可持续迭代 + 可验证”为核心：每轮交付 1 个可验证增量（MVI），并保持模块边界清晰。

## 版本路线图（迭代版 v2）

> 说明：仅保留“可执行版本计划”，与 `AUTO:METRICS`、风险规则、唯一 `NEXT` 严格对齐。

| 版本 | 模式目标 | 本版本唯一主任务（MVI） | 进入条件 | 完成门槛（全部满足） |
| --- | --- | --- | --- | --- |
| v0.9（当前） | Hardening | `M8-T05`：市场事件与利率前瞻（≥2 类宏观事件 + 下一次利率方向预告） | `AUTO:METRICS` 显示 Hardening 或 Risk=中/高 | `node --test tests/formula-system.test.js tests/log-system.test.js` 通过；10 分钟试玩事件触发≥3 次；`NEXT` 更新为 v1.0 主任务 |
| v1.0 | Optimization | 资产配置/风险偏好系统一期（影响自动购买权重与收益波动） | v0.9 发布门槛全部通过 | `bash scripts/verify_soak_thresholds.sh` 通过；新手 15 分钟流程无阻塞；`fail_rate` 不上升 |
| v1.1 | Optimization→Hardening | 季度目标 + 赛季结算 + 可重复挑战 | v1.0 稳定运行一轮迭代 | 180 天指标不劣化（`cagr_180`、`max_drawdown_180`、`blowup_rate`）；关键参数可复现 |
| v1.2（RC） | Hardening | 发布候选收口：存档兼容、回归脚本集成、版本日志自动化 | v1.1 指标稳定且风险等级=低 | 全量测试通过；`node scripts/run_soak_check.js --seconds 1800` 达标；发布清单（验收/回滚/已知问题）完整 |

### 版本节奏与发布规则（修订 v2）
- 单任务原则：每轮只推进 1 个主任务；未达门槛不得并行开启下个版本任务。
- 状态原则：`DONE` 仅在验收证据 + 验证命令通过后更新；`NEXT` 必须且只能有 1 个。
- 指标降级：North Star 连续两轮下降或出现 `trend=down` 时，版本状态降级为 `Recovery`，暂停新功能。
- 风险硬门禁：`bankruptcy_flag=true` 或 `max_drawdown_180>0.7` 时，只允许稳定性/回归类任务进入排期。
- 发布复盘：每次版本完成后，必须在里程碑条目补充“指标影响 + 验证命令 + 证据位置”。

### 发布前检查清单（Checklist）
- [ ] 路线图中仅保留 1 个 `[NEXT]`，且与当前版本主任务一致。
- [ ] `AUTO:METRICS` 区块模式与版本模式无冲突（如 Hardening/Recovery）。
- [ ] 至少 1 条自动化验证命令已执行并记录结果。
- [ ] 对风险指标（`bankruptcy_flag`、`max_drawdown_180`、`blowup_rate`、`fail_rate`）给出当前结论。

## Milestones

### M4：工程化与发布准备（进行中）
- [DONE] M4-T01 单元测试：价格/批量购买/离线/Prestige 公式
  - 验收：`node --test tests/formula-system.test.js` 全通过
  - 完成：2026-02-27
- [DONE] M4-T02 调试面板：GPS 分解 / 市场状态 / 存档大小 / FPS / Heap / 写入频次
  - 验收：`/?debug=1` 可见调试面板并实时刷新
  - 完成：2026-02-27
- [DONE] M4-T03 RAF 速率巡检指标（泄漏前置监控）
  - 验收：`/?debug=1` 显示 `RAF xx/s | OK/WARN`
  - 完成：2026-02-27
- [DONE] M4-T04 长时间运行巡检脚本（30 分钟）
  - 验收：`node scripts/run_soak_check.js --seconds 1800` 输出平均 FPS、峰值 Heap、writes/min 波动与结论
  - 完成：2026-02-27
- [DONE] M4-T05 发布页与版本日志（changelog）
  - 验收：首页标题展示版本号 + 页面存在“版本日志”区块并含版本记录
  - 完成：2026-02-27
  - 证据：`index.html` 含 `#appVersion` 与 `#changelogList`；`scripts/game.js` 初始化调用 `renderChangelog()`

### M5：平衡与体验抛光（完成）
- [DONE] M5-T01 市场波动平衡回归（牛/熊周期与收益体感）
  - 验收：给出参数表 + 10 分钟试玩日志
  - 完成：2026-02-27
  - 参数表：`MARKET_CYCLE_MIN=25s`、`MARKET_CYCLE_MAX=55s`、`MARKET_BULL_BONUS=1.4`、`MARKET_BEAR_PENALTY=0.7`
  - 10 分钟日志：`node scripts/run_soak_check.js --seconds 600` => `writesPerMinAvg=11.56`、`writesPerMinStd=0.76`、结论 `FPS稳定 / 写入频次稳定 / Heap峰值正常`
- [DONE] M5-T02 技能专精曲线复核（前中后期收益斜率）
  - 验收：专精层级阈值与收益倍率对照表
  - 完成：2026-02-27
  - 证据：`SKILL_MASTERY_STEP=3`、`SKILL_MASTERY_BONUS=0.05`、技能总等级上限 18（5+5+5+3）
  - 对照表：T0=Lv0-2×1.00；T1=Lv3-5×1.05；T2=Lv6-8×1.10；T3=Lv9-11×1.15；T4=Lv12-14×1.20；T5=Lv15-17×1.25；T6=Lv18×1.30
- [DONE] M5-T03 反馈层细化（购买/研发/市场切换分层反馈）
  - 验收：每类反馈至少 1 项可调参数与截图证明
  - 完成：2026-02-27
  - 参数：购买 `sfxBuy(330/440Hz, square, 0.12/0.10s, gain 0.08/0.06)`；研发 `sfxUpgrade(660/880Hz, sine, 0.15/0.20s, gain 0.10/0.08)`；市场切换 `marketFlashDurationMs=250`、`marketShakePx=6`、`marketShakeMs=220`
  - 截图：`browser:/tmp/codex_browser_invocations/471049d103f3fb5d/artifacts/artifacts/m5-t03-feedback-proof.png`

### M6：稳定性与可维护性（完成）
- [DONE] M6-T01 存档导入鲁棒性校验（非法 JSON/缺字段回退）
  - 验收：提供最少 3 组异常输入与结果日志
  - 完成：2026-02-27
  - 日志1（非法 JSON）：点击导入并输入 `not-json` => 弹窗 `存档格式无效`
  - 日志2（缺字段对象）：`{"savedAt":...,"buildings":[{"id":"workshop","owned":2}]}` => 页面可加载，`workshopOwned=2`，`rp=0 RP`
  - 日志3（越界数值）：`manualPower=-5,researchPoints=-8,skills.manual_mastery=999` => 夹取后 `rp=0 RP`、技能显示 `等级 5/5`
- [DONE] M6-T02 调试面板字段一致性复核（FPS/RAF/Heap 与采样窗口）
  - 验收：字段说明 + 对应采样来源代码行
  - 完成：2026-02-27
  - 字段说明：`debugGps`=base/mul/total/bld；`debugMarket`=BULL/BEAR+timer+cycle；`debugSave`=size+writes/min+last；`debugPerf`=FPS+speed+auto；`debugRaf`=RAF/s+OK/WARN；`debugMem`=Heap MB/n-a
  - 来源行：`scripts/debug-system.js` L11-16(字段容器), L36-37(GPS/Market), L43(Save), L47(RAF), L53(FPS), L59(Heap), L44-46(RAF窗口判定), L49-56(FPS采样窗口)
  - 运行证据：`/?debug=1` 实测文本含 `GPS base...`, `Market BULL...`, `Save key...writes/min...`, `FPS ...`, `RAF ...`, `Heap ...`
- [DONE] M6-T03 事件日志容量策略（上限与裁剪提示）
  - 验收：日志上限值 + 裁剪后用户可见提示
  - 完成：2026-02-27
  - 上限值：`LOG_CAP=20`，`pushLog` 超限裁剪至 20 条，存档读写同口径 `slice(0, LOG_CAP)`
  - 提示：首次触顶写入 `（系统）日志已达上限 20 条，较早记录已裁剪`，可在交易日志区可见

### M7：可观测与回归加固（进行中）
- [DONE] M7-T01 调试面板内存字段兼容说明补齐（浏览器限制提示统一）
  - 验收：README 增加 `Heap n/a` 场景说明与排查建议
  - 完成：2026-02-27
  - 证据：`README.md` 新增 `Heap n/a` 常见场景、预期表现、排查建议；文案与 `scripts/debug-system.js` 的 `Heap n/a (browser restricted)` 一致
- [DONE] M7-T02 事件日志裁剪单测（日志上限与提示文案）
  - 验收：新增 1 个 Node 测试覆盖上限与提示触发
  - 完成：2026-02-27
  - 证据：`tests/log-system.test.js` 覆盖 `LOG_CAP` 裁剪与提示文案仅触发一次；`node --test tests/formula-system.test.js tests/log-system.test.js` 全通过
- [DONE] M7-T03 巡检脚本输出阈值化（超阈值返回非零退出码）
  - 验收：为 FPS/Heap/writes 波动增加可配置阈值参数
  - 完成：2026-02-27
  - 指标影响：North Star +（阈值化后可自动判定稳定性，减少人工误判）；Risk 低（阈值可配置，默认策略保守）
  - 证据：`scripts/run_soak_check.js` 新增 `--min-fps` / `--max-heap-mb` / `--max-writes-std`，并在任一阈值失败时返回非零退出码
- [DONE] M7-T04 巡检脚本阈值文档化与CI接入示例
  - 验收：README 增加阈值参数说明与一条可复制的 CI 命令
  - 完成：2026-02-27
  - 指标影响：North Star +（门禁配置可复制，回归执行率提升）；Risk 低（仅文档改动）
  - 证据：`README.md` 新增阈值参数说明、`SOAK_REPORT` 字段说明及 CI 命令示例
- [DONE] M7-T05 巡检阈值回归测试样例（通过/失败）
  - 验收：新增一份脚本化示例，分别演示 exit 0 与 exit 1
  - 完成：2026-02-27
  - 指标影响：North Star +（阈值门禁回归路径可重复验证，减少配置漂移）
  - 证据：新增 `scripts/verify_soak_thresholds.sh`，依次验证 `run_soak_check` 的 exit 0 与 exit 1
- [DONE] M7-T06 巡检回归脚本输出归档（JSON文件）
  - 验收：支持将 pass/fail 两次报告输出到 artifacts 目录
  - 完成：2026-02-27
  - 指标影响：North Star +（巡检证据可追溯，回归复现效率提升）
  - 证据：`scripts/verify_soak_thresholds.sh` 新增归档逻辑，输出 `pass.json` / `fail.json` 与对应日志
- [DONE] M7-T07 巡检脚本参数帮助信息（--help）
  - 验收：`run_soak_check.js` 与 `verify_soak_thresholds.sh` 提供参数说明
  - 完成：2026-02-27
  - 指标影响：North Star +（脚本可发现性提升，误用参数导致失败的概率下降）
  - 证据：`node scripts/run_soak_check.js --help` 与 `bash scripts/verify_soak_thresholds.sh --help` 输出参数说明
- [DONE] M7-T08 巡检脚本错误参数回归（未知参数返回非零）
  - 验收：`run_soak_check.js --bad-flag` 返回非零并输出帮助
  - 完成：2026-02-27
  - 指标影响：North Star +（错误参数路径可自动回归，减少发布前遗漏）
  - 证据：新增 `tests/soak-cli.test.js`，覆盖未知参数时 exit=1 与帮助输出
- [DONE] M7-T09 将错误参数校验整合进阈值回归脚本
  - 验收：`verify_soak_thresholds.sh` 一次执行覆盖 pass/fail/invalid 三类路径
  - 完成：2026-02-27
  - 指标影响：North Star +（单次脚本覆盖更多失败面，回归完整性提升）
  - 证据：`scripts/verify_soak_thresholds.sh` 新增 invalid 路径校验并产出 `invalid.log`
- [DONE] M7-T10 为 verify 脚本增加无 Python 解析兜底
  - 验收：无 python 环境下也能生成 pass/fail JSON
  - 完成：2026-02-27
  - 指标影响：North Star +（环境兼容性提升，CI 可用性更稳）
  - 证据：`scripts/verify_soak_thresholds.sh` 支持 python 不可用时自动回退 node 解析 JSON
- [DONE] M7-T11 为 verify 脚本补充回退路径测试
  - 验收：使用环境变量强制 node 回退并通过
  - 完成：2026-02-27
  - 指标影响：North Star +（回退机制被自动测试覆盖，跨环境回归更可靠）
  - 证据：新增 `tests/verify-soak-fallback.test.js`，用 `VERIFY_SOAK_DISABLE_PYTHON=1` 验证归档 JSON 生成
- [DONE] M7-T12 为 verify 脚本增加可配置样例参数
  - 验收：允许通过环境变量覆盖 PASS/FAIL 示例命令
  - 完成：2026-02-27
  - 指标影响：North Star +（CI 可按场景定制样例命令，接入灵活性提升）
  - 证据：`scripts/verify_soak_thresholds.sh` 新增 `VERIFY_SOAK_PASS_CMD` / `VERIFY_SOAK_FAIL_CMD` / `VERIFY_SOAK_INVALID_CMD`
- [DONE] M7-T13 为可配置样例参数补充自动化测试
  - 验收：新增测试验证覆盖命令可生效
  - 完成：2026-02-27
  - 指标影响：North Star +（命令覆盖能力具备自动验证，避免配置失效）
  - 证据：新增 `tests/verify-soak-config.test.js`，校验 PASS/FAIL/INVALID 覆盖命令生效
- [DONE] M7-T14 校准 verify 脚本默认样例阈值（减少短测波动）
  - 验收：默认样例在 60s 内稳定得到 pass/fail 预期
  - 完成：2026-02-27
  - 指标影响：North Star +（默认样例在短时长下结果稳定，回归耗时更可控）
  - 证据：默认 pass/fail 调整为 60s；连续两次验证均得到 `pass=true` 与 `fail=false`
- [DONE] M7-T15 为默认 60s 样例增加基线快照测试
  - 验收：测试断言默认样例 durationSec=60
  - 完成：2026-02-27
  - 指标影响：North Star +（默认样例时长被测试固定，防止回归漂移）
  - 证据：新增 `tests/verify-soak-defaults.test.js`，断言 pass/fail 的 `durationSec=60`
- [DONE] M7-T16 为 verify 脚本增加超时保护
  - 验收：单次 verify 总耗时超阈值时给出非零退出
  - 完成：2026-02-27
  - 指标影响：North Star +（防止回归流程失控卡死，CI 稳定性提升）
  - 证据：`scripts/verify_soak_thresholds.sh` 新增 `VERIFY_SOAK_TIMEOUT_SEC` 并在超时后返回非零
- [DONE] M8-T01 多头连击玩法（手动撮合叠层增益）
  - 验收：多头期间手动撮合可叠加连击层数，并提升手动收益与总产出
  - 完成：2026-02-27
  - 指标影响：North Star +（手动操作反馈更强，中前期留存与参与度提升）
  - 证据：新增 `marketMomentum` 与 `marketMomentumTimer`，`manualDesc` 显示连击层与手动加成
- [DONE] M8-T02 连击玩法平衡复核（层数上限/持续时间）
  - 验收：给出 10 分钟样例日志与推荐参数
  - 完成：2026-02-27
  - 指标影响：North Star +（连击强度进入可控区间，节奏更稳）
  - 证据：新增 `scripts/run_momentum_balance_check.js`，10 分钟报告建议“保持当前参数”
  - 推荐参数：`MOMENTUM_CAP=12`、`MOMENTUM_DURATION=5s`、`MANUAL_PER_STACK=6%`、`GPS_PER_STACK=2%`
- [DONE] M8-T03 真实金融体系一期：政策利率与资金成本
  - 验收：新增“政策利率”变量并影响手动/自动收益与市场波动
  - 完成：2026-02-27
  - 指标影响：North Star +（新增政策利率驱动收益与波动，金融系统真实感提升）
  - 证据：`policyRate` 已纳入状态与存档；收益公式新增利率拖拽因子；市场切换会变动利率并反馈至 UI
- [DONE] M8-T04 真实金融体系二期：资金成本可视化与研发对冲
  - 验收：界面展示“利率对收益影响比例”，并新增至少 1 个可降低利率拖拽的研发项
  - 完成：2026-02-27
  - 指标影响：North Star +（利率影响透明化并提供对冲成长路径，决策反馈更清晰）
  - 证据：手动收益文案新增“利率效率 %”；新增研发“久期对冲”可降低利率拖拽
- [DONE] M8-T05 真实金融体系三期：市场事件与利率前瞻
  - 验收：新增至少 2 类宏观事件并可提前预告下一次利率方向
  - 完成：2026-02-27
  - 指标影响：North Star +（市场叙事与利率预期联动，策略反馈更完整）
  - 证据：新增 `MACRO_EVENTS`（通胀升温/增长放缓）；市场栏显示“宏观事件/利率前瞻”；切换日志写入 `🔮 利率前瞻`
- [DONE] M8-T06 宏观事件平衡复核：事件频率与前瞻命中率
  - 验收：给出 10 分钟样例日志，包含事件触发次数与前瞻方向统计
  - 完成：2026-02-27
  - 指标影响：North Star +（事件触发密度与前瞻命中可量化，后续调参更可控）
  - 证据：新增 `scripts/run_macro_event_balance_check.js`；`--switches 600 --seed 42` 输出 `totalEventTriggers=114`、`outlookHitRate=0.725`、建议“保持当前参数”
- [DONE] M8-T07 宏观事件闭环：前瞻命中奖励与误判惩罚
  - 验收：新增命中/误判反馈规则，并在交易日志中可见命中统计
  - 完成：2026-02-27
  - 指标影响：North Star +（预判正确带来正反馈，错误有成本，策略参与度提升）
  - 证据：市场切换新增 `✅ 前瞻命中`/`⚠️ 前瞻误判` 结算日志；市场栏展示“命中率 x% hits/total”
- [DONE] M8-T08 前瞻系统调优：命中率区间与奖惩系数回归
  - 验收：给出 600 次模拟报告，命中率与奖惩后净收益波动在可控区间
  - 完成：2026-02-27
  - 指标影响：North Star +（奖惩参数可调并可量化验证，降低迭代回归成本）
  - 证据：`run_macro_event_balance_check.js` 新增奖惩参数与 `netDeltaPerSwitch/netDeltaStdPerSwitch`；默认 600 次模拟输出建议“保持当前参数”
- [DONE] M8-T09 宏观事件扩展：事件连锁与行业偏好
  - 验收：至少新增 1 条事件连锁逻辑，并给出 600 次模拟分布对比
  - 完成：2026-02-27
  - 指标影响：North Star +（宏观叙事与产业经营联动，策略深度提升）
  - 证据：`MACRO_EVENTS` 新增 `nextEventId/preferredBuildingId`；市场日志显示连锁触发与偏好产业；CLI 输出 `chainTriggers` 与 `preferredBreakdown`
- [NEXT] M8-T10 宏观策略层：事件预案与自动配置
  - 验收：新增 1 套基于事件偏好的自动投资预案，可在日志查看切换记录

<!-- AUTO:METRICS-START -->
[Mode]
🛡 Hardening Mode（强化模式）

[North Star]
92.0% (trend: up)

[Supporting Metrics]
- growth_momentum: 91.0%（连击参数完成平衡复核并形成推荐）
- return_quality: 81.0%
- upgrade_satisfaction: 78.0%
- progress_clarity: 91.0%
- stability_score: 88.0%

[Risk Level]
低

[Task]
M8-T04 / 真实金融体系二期：资金成本可视化与研发对冲

[Impact]
对 North Star 影响：+（利率影响可见且可对冲，提升策略可解释性与目标感）

[Do]
- 修改文件列表：`scripts/economy-system.js`、`scripts/game-data.js`、`scripts/render-system.js`、`scripts/save-system.js`、`scripts/game.js`、`ROADMAP.md`
- 实现摘要：新增“久期对冲”研发降低利率拖拽，并在手动收益文案实时展示“利率效率”比例

[Verify]
- `node --test tests/formula-system.test.js tests/log-system.test.js tests/soak-cli.test.js tests/verify-soak-fallback.test.js tests/verify-soak-config.test.js tests/verify-soak-defaults.test.js`

[RoadmapPatch]
(diff only)

[Next]
M8-T05
<!-- AUTO:METRICS-END -->

## 当前版本能力（摘要）
- 模块化系统：formula/economy/skill/market/feedback/save/render/loop/debug
- 经济核心公式已抽离为纯函数并具备 Node 单测
- `?debug=1` 支持 GPS 分解、市场状态、存档大小、writes/min、FPS、RAF/s、Heap
- 支持 `scripts/run_soak_check.js` 进行 30 分钟巡检报告导出

## 历史完成摘要（归档）
- M1~M3 核心循环、进度系统、中期内容扩展均已完成（建筑层级、升级链、成就任务、Prestige、离线收益、音效反馈）

## 规则
- DONE 仅保留近期关键项；历史内容归档摘要。
- 每轮仅执行 1 个任务；必须维护唯一 NEXT。
