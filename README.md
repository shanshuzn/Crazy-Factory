# Crazy Factory / 自动化工厂

一个使用原生 **HTML + CSS + JavaScript** 开发的放置类（Idle/Incremental）游戏原型。

## 快速开始

```bash
node scripts/serve_static.js
```

浏览器打开：`http://127.0.0.1:4173`

> 若你使用截图容器/CI，请优先使用 `node scripts/serve_static.js`。该脚本会对未知路径回退到 `index.html`，可避免截图时出现 `Not Found` 空白页。

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
- 建筑专精：每种建筑提供“产出/成本”双分支专精，消耗 RP 进行长期定向成长
- 成就系统：达成后发放一次性奖励（齿轮/RP）
- 阶段任务链：连续目标推进，并自动发放任务奖励
- 事件日志：记录关键操作与奖励发放，便于调试平衡
- 统计摘要面板：集中展示建筑/升级/成就/任务与累计进度
- 界面分栏目：将经济操作与目标追踪拆分为双栏目，降低中后期信息拥挤
- UI 优化：参考经典放置游戏的信息架构，强化顶部资源区、横向控制条与双栏目视觉分区
- 栏目折叠展开：经济/目标栏目支持折叠状态切换并写入存档
- 折叠交互细化：折叠按钮加入箭头旋转与过渡动画，目标栏目在有可领取内容时显示红点提示
- 生产订单：解锁后生成随机订单，按阶段扩展订单池（点击/产出/多建筑目标），完成可领取齿轮/RP，并支持消耗齿轮刷新
- 反馈增强：点击与领取奖励触发轻量弹跳/浮字反馈，便于快速调节游戏手感
- 连击系统：手动点击可叠连击倍率并随时间衰减，在关键连击点触发额外高光反馈
- 高价值事件演出：任务/成就/订单完成与 Prestige 触发脉冲+震屏强化反馈
- 反馈并发控制：浮字采用智能分级并发（关键奖励可用高优先级名额），震屏冷却期自动降级为边框脉冲
- 低性能模式：一键缩短浮字时长并关闭震屏，且可启用“低性能音效保护”抑制高频振荡
- 音效入口：内置轻量 WebAudio 事件音（点击/奖励/订单/Prestige）并支持一键开关
- 内容解锁：
  - 建筑按累计齿轮解锁
  - 升级含前置条件与 RP 门槛
- Prestige（软重置）：重置局内进度，换取 RP 永久加成
- 离线收益：离线结算（8 小时封顶）
- 存档：本地自动保存 + 手动重置
- 经济校验脚本：`node scripts/economy_checks.js` 可快速验证价格/离线/Prestige/存档迁移边界
- 经济曲线二次调优：中后期建筑价格增长斜率放缓，Prestige 在高累计阶段增加额外成长奖励

## 项目结构

```txt
.
├── index.html
├── package.json
├── src/
│   ├── main.js
│   ├── app/
│   │   └── bootstrap.js
│   ├── core/
│   │   ├── constants.js
│   │   ├── state.js
│   │   └── saveMigrations.js
│   ├── fx/
│   │   ├── feedbackBus.js
│   │   └── gameFeelSystem.js
│   ├── systems/
│   │   ├── economySystem.js
│   │   ├── taskSystem.js
│   │   └── audioSystem.js
│   └── ui/
│       ├── renderTopbar.js
│       ├── renderPanels.js
│       └── bindControls.js
├── styles/
│   └── main.css
├── README.md
├── docs/
│   └── roadmaps/
│       ├── ROADMAP.md
│       ├── WORKPLAN.md
│       ├── FINANCE_ROADMAP.md
│       ├── ROLLING_UPDATE_MONITORING_ROADMAP.md
│       ├── ROLLING_UPDATE_RUNBOOK.md
│       └── SEED_ROUND_ROADMAP.md
└── scripts/
    ├── serve_static.js
    ├── capture_screenshot.py
    ├── economy_checks.js
    ├── module_checks.mjs
    ├── finance_checks.js
    ├── kpi_dashboard_checks.js
    └── sim_common.js
```


## 工程命令（npm scripts）

```bash
npm run serve
npm run check
npm run sim:baseline
npm run sim:stability
npm run sim:balance
```

## 截图与调试（容器/CI）

当 Chromium 在容器里不稳定时，可使用截图脚本（支持 Python Playwright 与 npx 自动回退）：

```bash
python3 scripts/capture_screenshot.py
```

脚本默认按 `Firefox -> WebKit -> Chromium` 依次回退，并可通过环境变量调整：

```bash
SCREENSHOT_ENGINES=firefox,webkit,chromium SCREENSHOT_URL=http://127.0.0.1:4173 SCREENSHOT_OUT=artifacts/factory-screenshot.png python3 scripts/capture_screenshot.py
```

若当前环境未安装 `playwright` Python 包，脚本会自动回退到 `npx playwright`（首次执行需要联网拉取依赖）。

> 在容器中若 Chromium 不稳定（SIGSEGV），建议保持 Firefox 优先。

> 若环境同时缺少 Python Playwright 与 npx，脚本会尝试自动安装 Python Playwright（可用 `SCREENSHOT_BOOTSTRAP=0` 关闭）。

## 路线图

- 产品年度路线：`docs/roadmaps/ROADMAP.md`
- 执行节奏路线：`docs/roadmaps/WORKPLAN.md`
- 多文件化路线：`docs/roadmaps/MULTI_FILE_ARCH_ROADMAP.md`
- 金融专项路线：`docs/roadmaps/FINANCE_ROADMAP.md`
- 滚动更新监控路线：`docs/roadmaps/ROLLING_UPDATE_MONITORING_ROADMAP.md`
- 滚动更新执行手册：`docs/roadmaps/ROLLING_UPDATE_RUNBOOK.md`
- 种子轮融资路线：`docs/roadmaps/SEED_ROUND_ROADMAP.md`
- 反馈事件清单：`docs/roadmaps/FEEDBACK_EVENT_CATALOG.md`
- 模块依赖图：`docs/roadmaps/MODULE_DEPENDENCY_MAP.md`
- 状态流转图：`docs/roadmaps/STATE_FLOW_MAP.md`
- 滚动更新日志：`docs/roadmaps/ROLLING_UPDATE_LOG.md`

## 贡献方向

欢迎围绕以下方向提交改进：
- 数值平衡与经济曲线
- UI/UX 反馈
- 性能优化
- 模块化与自动化测试


## 工作路线图（执行版）
- 详见 `docs/roadmaps/WORKPLAN.md`（双周冲刺节奏、验证命令、复盘模板）。
