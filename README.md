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

## 路线图

后续迭代见 `ROADMAP.md`（已精简为可执行清单）。

## 贡献方向

欢迎围绕以下方向提交改进：
- 数值平衡与经济曲线
- UI/UX 反馈
- 性能优化
- 模块化与自动化测试
