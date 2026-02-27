# Crazy Factory / 自动化工厂

一个使用原生 **HTML + CSS + JavaScript** 开发的放置类（Idle/Incremental）游戏原型。

## 快速开始

```bash
python3 -m http.server 4173
```

浏览器打开：`http://127.0.0.1:4173`

## 项目定位

当前版本用于快速验证以下核心循环：
- 点击产出 → 购买建筑 → 自动增长
- 升级/成就/Prestige 对中期节奏的影响
- 存档、离线收益与重开体验

## 主要玩法（当前版本）

### 资源与产出
- 核心资源：`Gears（齿轮）`
- 手动生产：每次点击 `+1`（可被升级增强）
- 自动产出：建筑提供 DPS，固定步长循环累计

### 建筑
- Intern（实习生）：基础价格 15，DPS 1
- Conveyor（传送带）：基础价格 100，DPS 8
- Assembler（组装机）：基础价格 1100，DPS 47

价格公式：

```txt
price = floor(basePrice * 1.15 ^ owned)
```

### 系统能力
- 批量购买：`x1 / x10 / x100 / Max`
- 仿真速度：`1x / 2x / 4x`
- 自动购买：可切换自动购买（优先升级，其次高阶建筑）
- 升级系统：手动产出与总 GPS 增益
- 技能系统：消耗 RP 提升手动/产线/采购效率
- 成就系统：达成后发放一次性奖励（齿轮/RP）
- 阶段任务链：连续目标推进，并自动发放任务奖励
- 事件日志：记录关键操作与奖励发放，便于调试平衡
- 统计摘要面板：集中展示建筑/升级/成就/任务与累计进度
- 调试面板：`?debug=1` 可查看 GPS 分解 / 市场状态 / 存档大小 / FPS / RAF速率 / Heap / 写入频次
- Heap `n/a` 说明（`?debug=1`）：
  - 常见场景：浏览器未开放 `performance.memory`（Firefox / Safari / iOS WebView / 部分隐私模式）
  - 预期表现：调试面板显示 `Heap n/a (browser restricted)`，不影响游戏主循环
  - 排查建议：优先在 Chromium 桌面版复测；关闭严格隐私扩展后重开页面；对比 FPS/RAF 与 `run_soak_check` 输出判断是否存在真实性能问题
- 版本日志：首页展示版本号与最近两版变更
- 内容解锁：
  - 建筑按累计齿轮解锁
  - 升级含前置条件与 RP 门槛
- Prestige（软重置）：重置局内进度，换取 RP 永久加成
- 离线收益：离线结算（8 小时封顶）
- 存档：本地自动保存 + 手动重置

## 项目结构

```txt
.
├── index.html
├── styles/
│   └── main.css
├── README.md
├── ROADMAP.md
├── tests/
│   ├── formula-system.test.js
│   └── log-system.test.js
└── scripts/
    ├── game-data.js
    ├── formula-system.js
    ├── log-system.js
    ├── skill-system.js
    ├── economy-system.js
    ├── market-system.js
    ├── feedback-system.js
    ├── save-system.js
    ├── loop-system.js
    ├── render-system.js
    ├── debug-system.js
    ├── game.js
    ├── run_soak_check.js
    ├── run_macro_event_balance_check.js
    └── capture_screenshot.py
```

## 截图与调试（容器/CI）

当 Chromium 在容器里不稳定时，可使用截图脚本：

```bash
python3 scripts/capture_screenshot.py
```

脚本默认按 `Firefox -> WebKit -> Chromium` 依次回退，并可通过环境变量调整：

```bash
SCREENSHOT_ENGINES=firefox,webkit,chromium SCREENSHOT_URL=http://127.0.0.1:4173 SCREENSHOT_OUT=artifacts/factory-screenshot.png python3 scripts/capture_screenshot.py
```

> 在容器中若 Chromium 不稳定（SIGSEGV），建议保持 Firefox 优先。

长时巡检可用：

```bash
node scripts/run_soak_check.js --seconds 1800
```

巡检阈值参数（用于 CI 门禁）：

- `--min-fps`：最低平均 FPS（默认 `55`）
- `--max-heap-mb`：Heap 峰值上限（MB，默认 `256`）
- `--max-writes-std`：`writesPerMin` 标准差上限（默认 `1`）

脚本会在输出 `SOAK_REPORT` 的同时附带 `thresholds` 与 `checks` 字段；任一检查失败时进程返回非零退出码。

CI 示例（可直接复制）：

```bash
node scripts/run_soak_check.js --seconds 600 --min-fps 55 --max-heap-mb 256 --max-writes-std 2
```

阈值回归样例（默认以 60s 样例一次执行验证 pass/fail/invalid 三类路径并归档）：

```bash
bash scripts/verify_soak_thresholds.sh
```

宏观事件平衡复核（用于评估事件触发密度与利率前瞻命中率）：

```bash
node scripts/run_macro_event_balance_check.js --switches 600 --seed 42
```

可加 `--json` 输出纯 JSON，便于 CI 归档与比较；可通过 `--reward-base/--reward-rate-scale/--penalty-base/--penalty-rate-scale/--penalty-gear-ratio` 复核奖惩参数对净收益波动的影响。报告额外包含 `chainTriggers` 与 `preferredBreakdown` 以观察事件连锁与行业偏好分布；游戏内自动投资会按宏观偏好切换预案并在日志可见。

默认会将 pass/fail 的 `SOAK_REPORT` 写入 `artifacts/soak-thresholds/pass.json` 与 `artifacts/soak-thresholds/fail.json`，并保留 `pass.log` / `fail.log` / `invalid.log`。
JSON 解析优先使用 `python3/python`，若不可用会自动回退到 `node`（可用 `VERIFY_SOAK_DISABLE_PYTHON=1` 强制演练回退路径）。
可选设置 `VERIFY_SOAK_TIMEOUT_SEC`（默认 180）控制 verify 脚本总超时，超时将返回非零退出码。
如需自定义目录可传入首个参数：

```bash
bash scripts/verify_soak_thresholds.sh artifacts/my-soak-reports
```

如需覆盖回归样例命令（例如在更短时长下跑 CI），可通过环境变量传入：

```bash
VERIFY_SOAK_PASS_CMD='node scripts/run_soak_check.js --seconds 30 --max-writes-std 3' VERIFY_SOAK_FAIL_CMD='node scripts/run_soak_check.js --seconds 10 --max-writes-std 1' VERIFY_SOAK_INVALID_CMD='node scripts/run_soak_check.js --bad-flag' bash scripts/verify_soak_thresholds.sh
```

参数帮助：

```bash
node scripts/run_soak_check.js --help
bash scripts/verify_soak_thresholds.sh --help
```

## 路线图

后续迭代见 `ROADMAP.md`（已精简为可执行清单）。

## 贡献方向

欢迎围绕以下方向提交改进：
- 数值平衡与经济曲线
- UI/UX 反馈
- 性能优化
- 模块化与自动化测试
