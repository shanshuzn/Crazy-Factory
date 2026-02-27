# 金融帝国（Idle/Incremental）路线图

## 目标
以“可持续迭代 + 可验证”为核心：每轮交付 1 个可验证增量（MVI），并保持模块边界清晰。

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
- [TODO] M7-T03 巡检脚本输出阈值化（超阈值返回非零退出码）
  - 验收：为 FPS/Heap/writes 波动增加可配置阈值参数
- [NEXT] M7-T03 巡检脚本输出阈值化（超阈值返回非零退出码）
  - 验收：为 FPS/Heap/writes 波动增加可配置阈值参数

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
