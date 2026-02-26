import {
  AUDIO_ENABLED_DEFAULT,
  AUDIO_VOLUME,
  CHAIN_BONUS_PER_STAGE,
  CHAIN_MAX_STAGES,
  COMBO_BONUS_PER_STACK,
  COMBO_DECAY_SECONDS,
  COMBO_MAX_STREAK,
  DEFAULT_FINANCE_ASSETS,
  FINANCE_BASE_APR,
  FINANCE_COOLDOWN_MS,
  FINANCE_CYCLE_AMPLITUDE,
  FINANCE_HEDGE_APR_MULT,
  FINANCE_HEDGE_COST_RATIO,
  FINANCE_HEDGE_DURATION_MS,
  FINANCE_HEDGE_VOL_MULT,
  FINANCE_MAX_SHARE_OF_MAINLINE,
  FINANCE_META_APR_PER_POINT,
  FINANCE_MIN_CAP_GPS,
  FINANCE_PRESTIGE_SPRINT_APR_BONUS,
  FINANCE_PRESTIGE_SPRINT_TRIGGER,
  FINANCE_PRESTIGE_SPRINT_VOL_MULT,
  FINANCE_TIER_APR_BONUS,
  FINANCE_UNLOCK_LIFETIME_GEARS,
  FIXED_STEP,
  FX_BTN_POP_MS,
  FX_FLOAT_DURATION_MS,
  FX_HIGHLIGHT_DURATION_MS,
  FX_MAX_FLOATING_GAINS,
  FX_PANEL_PULSE_MS,
  FX_PRIORITY_SLOTS,
  FX_SHAKE_COOLDOWN_MS,
  FX_SHAKE_DURATION_MS,
  LOW_PERF_FLOAT_SCALE,
  MAX_ACCUMULATED_SECONDS,
  OFFLINE_CAP_SECONDS,
  ORDER_REROLL_COST,
  ORDER_TIER_STEP,
  ORDER_UNLOCK_LIFETIME_GEARS,
  OVERDRIVE_COOLDOWN_MS,
  OVERDRIVE_COST_GEARS,
  OVERDRIVE_DURATION_MS,
  OVERDRIVE_GPS_MULT,
  OVERDRIVE_UNLOCK_LIFETIME_GEARS,
  PRESTIGE_BASE_DIVISOR,
  PRESTIGE_LATE_BONUS_START,
  PRESTIGE_LATE_BONUS_STEP,
  PRICE_CURVE_LATE_FACTOR,
  PRICE_CURVE_LATE_START,
  PRICE_CURVE_MID_FACTOR,
  PRICE_CURVE_MID_START,
  PRICE_GROWTH,
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  TICK_RATE
} from "../core/constants.js";
import { createInitialState } from "../core/state.js";
import { createFeedbackBus } from "../fx/feedbackBus.js";
import { attachGameFeelHandlers } from "../fx/gameFeelSystem.js";
import { FEEDBACK_EVENTS } from "../fx/events.js";
import { migrateSaveData as migrateSavePayload } from "../core/saveMigrations.js";
import { getCurrentPrice as calcCurrentPrice, getPrestigeGain as calcPrestigeGain } from "../systems/economySystem.js";
import { createOrderFromTemplate, getOrderProgress as calcOrderProgress, pickWeightedOrderTemplate as pickWeightedTemplate } from "../systems/taskSystem.js";
import { createAudioSystem } from "../systems/audioSystem.js";
import { renderTopbar } from "../ui/renderTopbar.js";
import { renderCategoryAlerts, renderCategoryCollapse } from "../ui/renderPanels.js";
import { bindPrimaryControls } from "../ui/bindControls.js";

export function boot() {
const PRESTIGE_BRANCHES = [
      { id: "legacy_manual", name: "传承：工匠路线", desc: "手动产出永久 +12%", cost: 2, maxLevel: 5, type: "manual", value: 0.12 },
      { id: "legacy_line", name: "传承：产线路线", desc: "总 GPS 永久 +10%", cost: 2, maxLevel: 5, type: "gps", value: 0.10 }
    ];

    const ORDER_TEMPLATES = [
      { key: "clicks", type: "clicks", minTier: 1, weight: 3, title: "订单：人工质检", desc: "手动点击完成一次人工抽检" },
      { key: "lifetime", type: "lifetime", minTier: 1, weight: 3, title: "订单：加急出货", desc: "在当前阶段额外生产齿轮" },
      { key: "conveyor", type: "building", buildingId: "conveyor", minTier: 1, weight: 2, title: "订单：扩展传送线", desc: "新增传送带以提升物流效率" },
      { key: "assembler", type: "building", buildingId: "assembler", minTier: 2, weight: 1, title: "订单：精密组装", desc: "扩充组装机以提升高阶产线" },
      { key: "intern", type: "building", buildingId: "intern", minTier: 3, weight: 2, title: "订单：培训冲刺", desc: "扩招实习生补充基础产线" },
      // Week3 扩展模板：限时、组合、高风险高收益。通过 target/reward 系数复用已有流程，避免增加状态复杂度。
      { key: "rush_clicks", type: "clicks", minTier: 2, weight: 2, title: "限时单：质检冲刺", desc: "短平快点击冲刺，适合补短线收益", targetScale: 0.75, rewardScale: 0.9 },
      { key: "hybrid_line", type: "building", buildingId: "conveyor", minTier: 3, weight: 2, title: "组合单：物流联动", desc: "同步扩建传送与基础人力，强调中期联动", targetScale: 1.25, rewardScale: 1.45 },
      { key: "all_in_prestige", type: "lifetime", minTier: 4, weight: 1, title: "高风险单：全压出货", desc: "重载长单，完成后直接给 RP，适合冲 Prestige 前夕", targetScale: 1.85, rewardType: "rp", rewardScale: 1.8 },
      { key: "finance_funding", type: "lifetime", minTier: 2, weight: 2, financeTag: "融资单", preferredMarket: "overheat", title: "融资单：杠杆扩产", desc: "借势市场升温，完成后回补齿轮", targetScale: 1.15, rewardScale: 1.35 },
      { key: "finance_hedge", type: "clicks", minTier: 2, weight: 2, financeTag: "套保单", preferredMarket: "panic", title: "套保单：紧急风控", desc: "在恐慌窗口快速执行人工风控", targetScale: 0.9, rewardType: "rp", rewardScale: 1.2 },
      { key: "finance_settlement", type: "building", buildingId: "assembler", minTier: 3, weight: 1, financeTag: "结算单", preferredMarket: "pullback", title: "结算单：利润落袋", desc: "回调期完成高价值结算", targetScale: 1.2, rewardScale: 1.5 }
    ];

    const upgrades = [
      { id: "training", name: "员工培训", price: 250, desc: "手动生产 +1", type: "manual", value: 1, purchased: false, unlockRP: 0, requires: null },
      { id: "lubricant", name: "润滑油优化", price: 800, desc: "总 GPS x1.5", type: "gps", value: 1.5, purchased: false, unlockRP: 0, requires: "training" },
      { id: "ai", name: "调度 AI", price: 5000, desc: "总 GPS x2", type: "gps", value: 2, purchased: false, unlockRP: 1, requires: "lubricant" }
    ];

    const skills = [
      { id: "manual_mastery", name: "手动精通", desc: "手动产出每级 +25%", maxLevel: 5, level: 0, costRP: 1 },
      { id: "line_optimizer", name: "产线优化", desc: "总 GPS 每级 +20%", maxLevel: 5, level: 0, costRP: 1 },
      { id: "bulk_discount", name: "采购折扣", desc: "建筑价格每级 -3%", maxLevel: 5, level: 0, costRP: 1 }
    ];



    const specializationUpgrades = [
      { id: "intern_output", buildingId: "intern", branch: "output", name: "实习生训练计划", desc: "实习生产出每级 +20%", costRP: 1, maxLevel: 5, level: 0 },
      { id: "intern_cost", buildingId: "intern", branch: "cost", name: "实习生批量招募", desc: "实习生价格每级 -4%", costRP: 1, maxLevel: 5, level: 0 },
      { id: "conveyor_output", buildingId: "conveyor", branch: "output", name: "传送带高效马达", desc: "传送带产出每级 +20%", costRP: 2, maxLevel: 5, level: 0 },
      { id: "conveyor_cost", buildingId: "conveyor", branch: "cost", name: "传送带标准化采购", desc: "传送带价格每级 -4%", costRP: 2, maxLevel: 5, level: 0 },
      { id: "assembler_output", buildingId: "assembler", branch: "output", name: "组装机精密校准", desc: "组装机产出每级 +20%", costRP: 3, maxLevel: 5, level: 0 },
      { id: "assembler_cost", buildingId: "assembler", branch: "cost", name: "组装机供应链优化", desc: "组装机价格每级 -4%", costRP: 3, maxLevel: 5, level: 0 }
    ];

    const achievements = [
      { id: "first_click", name: "开工！", desc: "首次手动生产", reward: { type: "gear", value: 10 }, check: () => state.totalClicks >= 1, done: false, claimed: false },
      { id: "intern", name: "第一位员工", desc: "拥有 1 台实习生", reward: { type: "gear", value: 50 }, check: () => (buildings.find((b) => b.id === "intern")?.owned || 0) >= 1, done: false, claimed: false },
      { id: "hundred_gears", name: "齿轮仓储", desc: "累计获得 100 齿轮", reward: { type: "gear", value: 120 }, check: () => state.lifetimeGears >= 100, done: false, claimed: false },
      { id: "gps_50", name: "产线启动", desc: "总 GPS 达到 50", reward: { type: "rp", value: 1 }, check: () => getTotalGPS() >= 50, done: false, claimed: false }
    ];

    const questChain = [
      { id: "q_click", title: "任务 1：手动点击 20 次", rewardText: "奖励 +120 齿轮", reward: { type: "gear", value: 120 },
        progress: () => Math.min(state.totalClicks, 20), target: 20 },
      { id: "q_intern", title: "任务 2：拥有 10 台实习生", rewardText: "奖励 +300 齿轮", reward: { type: "gear", value: 300 },
        progress: () => Math.min((buildings.find((b) => b.id === "intern")?.owned || 0), 10), target: 10 },
      { id: "q_gps", title: "任务 3：总 GPS 达到 100", rewardText: "奖励 +1 RP", reward: { type: "rp", value: 1 },
        progress: () => Math.min(getTotalGPS(), 100), target: 100 }
    ];

    const buildings = [
      { id: "intern", name: "实习生", basePrice: 15, dps: 1, owned: 0, unlockLifetimeGears: 0 },
      { id: "conveyor", name: "传送带", basePrice: 100, dps: 8, owned: 0, unlockLifetimeGears: 200 },
      { id: "assembler", name: "组装机", basePrice: 1100, dps: 47, owned: 0, unlockLifetimeGears: 1500 }
    ];

    const state = createInitialState({
      audioEnabledDefault: AUDIO_ENABLED_DEFAULT,
      defaultFinanceAssets: DEFAULT_FINANCE_ASSETS
    });
    const feedbackBus = createFeedbackBus();
    const audioSystem = createAudioSystem({
      getState: () => state,
      volume: AUDIO_VOLUME
    });

    const gearsEl = document.getElementById("gears");
    const gpsEl = document.getElementById("gps");
    const manualBtn = document.getElementById("manualBtn");
    const manualHintEl = document.getElementById("manualHint");
    const buildingList = document.getElementById("buildingList");
    const modeButtons = [...document.querySelectorAll("[data-mode]")];
    const speedButtons = [...document.querySelectorAll("[data-speed]")];
    const autoBuyBtn = document.getElementById("autoBuyBtn");
    const audioBtn = document.getElementById("audioBtn");
    const lowPerfBtn = document.getElementById("lowPerfBtn");
    const lowPerfAudioBtn = document.getElementById("lowPerfAudioBtn");
    const exportSaveBtn = document.getElementById("exportSaveBtn");
    const importSaveBtn = document.getElementById("importSaveBtn");
    const prestigeBtn = document.getElementById("prestigeBtn");
    const resetSaveBtn = document.getElementById("resetSaveBtn");
    const debugToggleBtn = document.getElementById("debugToggleBtn");
    const offlineNoticeEl = document.getElementById("offlineNotice");
    const offlineTextEl = document.getElementById("offlineText");
    const claimOfflineBtn = document.getElementById("claimOfflineBtn");
    const overdriveFillEl = document.getElementById("overdriveFill");
    const overdriveHintEl = document.getElementById("overdriveHint");
    const overdriveStatusEl = document.getElementById("overdriveStatus");
    const overdriveCountEl = document.getElementById("overdriveCount");
    const overdriveBtn = document.getElementById("overdriveBtn");
    const debugPanelEl = document.getElementById("debugPanel");
    const debugSnapshotInfoEl = document.getElementById("debugSnapshotInfo");
    const debugAddGearsBtn = document.getElementById("debugAddGearsBtn");
    const debugAddRpBtn = document.getElementById("debugAddRpBtn");
    const debugSnapshotBtn = document.getElementById("debugSnapshotBtn");
    const debugManualMultBtn = document.getElementById("debugManualMultBtn");
    const debugGpsMultBtn = document.getElementById("debugGpsMultBtn");
    const debugResetMultBtn = document.getElementById("debugResetMultBtn");
    const upgradeList = document.getElementById("upgradeList");
    const achievementList = document.getElementById("achievementList");
    const skillList = document.getElementById("skillList");
    const specializationList = document.getElementById("specializationList");
    const prestigeBranchList = document.getElementById("prestigeBranchList");
    const prestigeBranchSummaryEl = document.getElementById("prestigeBranchSummary");
    const prestigeBranchHintEl = document.getElementById("prestigeBranchHint");
    const goalTitleEl = document.getElementById("goalTitle");
    const goalFillEl = document.getElementById("goalFill");
    const goalHintEl = document.getElementById("goalHint");
    const goalPctEl = document.getElementById("goalPct");
    const questRewardEl = document.getElementById("questReward");
    const rpEl = document.getElementById("rp");
    const rewardFeedEl = document.getElementById("rewardFeed");
    const eventLogEl = document.getElementById("eventLog");
    const statBuildingsEl = document.getElementById("statBuildings");
    const statUpgradesEl = document.getElementById("statUpgrades");
    const statAchievementsEl = document.getElementById("statAchievements");
    const statQuestEl = document.getElementById("statQuest");
    const statModeEl = document.getElementById("statMode");
    const statLifetimeEl = document.getElementById("statLifetime");
    const statChainEl = document.getElementById("statChain");
    const orderTitleEl = document.getElementById("orderTitle");
    const orderFillEl = document.getElementById("orderFill");
    const orderHintEl = document.getElementById("orderHint");
    const orderPctEl = document.getElementById("orderPct");
    const orderRewardEl = document.getElementById("orderReward");
    const claimOrderBtn = document.getElementById("claimOrderBtn");
    const rerollOrderBtn = document.getElementById("rerollOrderBtn");
    const financeTitleEl = document.getElementById("financeTitle");
    const financeFillEl = document.getElementById("financeFill");
    const financeHintEl = document.getElementById("financeHint");
    const financeYieldEl = document.getElementById("financeYield");
    const financeCapitalEl = document.getElementById("financeCapital");
    const financeBreakdownEl = document.getElementById("financeBreakdown");
    const financeMarketEl = document.getElementById("financeMarket");
    const financeStrategyEl = document.getElementById("financeStrategy");
    const financeSwitchesEl = document.getElementById("financeSwitches");
    const financeSeasonEl = document.getElementById("financeSeason");
    const financeIntelEl = document.getElementById("financeIntel");
    const financeLeaderboardEl = document.getElementById("financeLeaderboard");
    const financeAssetsEl = document.getElementById("financeAssets");
    const financeLiquidityEl = document.getElementById("financeLiquidity");
    const financeAdviceEl = document.getElementById("financeAdvice");
    const financeStrategyConservativeBtn = document.getElementById("financeStrategyConservativeBtn");
    const financeStrategyBalancedBtn = document.getElementById("financeStrategyBalancedBtn");
    const financeStrategyAggressiveBtn = document.getElementById("financeStrategyAggressiveBtn");
    const financeInvestBtn = document.getElementById("financeInvestBtn");
    const financeWithdrawBtn = document.getElementById("financeWithdrawBtn");
    const financeUpgradeBtn = document.getElementById("financeUpgradeBtn");
    const financeHedgeBtn = document.getElementById("financeHedgeBtn");
    const financeSettleBtn = document.getElementById("financeSettleBtn");
    const financeAutoBtn = document.getElementById("financeAutoBtn");
    const financeAssetBondBtn = document.getElementById("financeAssetBondBtn");

    const setMetricPillTone = (el, tone) => {
      if (!el) return;
      el.classList.remove("good", "warn", "danger");
      if (tone && ["good", "warn", "danger"].includes(tone)) {
        el.classList.add(tone);
      }
    };
    const financeAssetEquityBtn = document.getElementById("financeAssetEquityBtn");
    const financeAssetDerivativeBtn = document.getElementById("financeAssetDerivativeBtn");
    const fxLayerEl = document.getElementById("fxLayer");
    const highlightLayerEl = document.getElementById("highlightLayer");
    const gamePanelEl = document.querySelector(".game");

    const buildingViewMap = new Map();
    const upgradeViewMap = new Map();
    const achievementViewMap = new Map();
    const skillViewMap = new Map();
    const specializationViewMap = new Map();
    const prestigeBranchViewMap = new Map();

    const format = (num) => {
      if (!Number.isFinite(num)) return "0";
      const abs = Math.abs(num);
      if (abs >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
      if (abs >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
      if (abs >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
      return num.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
    };

    const getSkillLevel = (id) => skills.find((s) => s.id === id)?.level || 0;
    const getSpecializationLevel = (buildingId, branch) => specializationUpgrades.find((s) => s.buildingId === buildingId && s.branch === branch)?.level || 0;
    const getBuildingCostMultiplier = (buildingId) => Math.max(0.65, 1 - getSpecializationLevel(buildingId, "cost") * 0.04);
    const getBuildingOutputMultiplier = (buildingId) => 1 + getSpecializationLevel(buildingId, "output") * 0.2;
    const getDiscountMultiplier = (buildingId) => Math.max(0.7, 1 - getSkillLevel("bulk_discount") * 0.03) * getBuildingCostMultiplier(buildingId);

const getCurrentPrice = (building, ownedOffset = 0) => calcCurrentPrice({
      basePrice: building.basePrice,
      owned: building.owned,
      ownedOffset,
      growth: PRICE_GROWTH,
      discountMultiplier: getDiscountMultiplier(building.id),
      curve: {
        midStart: PRICE_CURVE_MID_START,
        lateStart: PRICE_CURVE_LATE_START,
        midFactor: PRICE_CURVE_MID_FACTOR,
        lateFactor: PRICE_CURVE_LATE_FACTOR
      }
    });

    const getPrestigeGain = (lifetimeGears) => calcPrestigeGain(lifetimeGears, {
      baseDivisor: PRESTIGE_BASE_DIVISOR,
      lateBonusStart: PRESTIGE_LATE_BONUS_START,
      lateBonusStep: PRESTIGE_LATE_BONUS_STEP
    });

    const getBaseGPS = () => buildings.reduce((sum, b) => sum + b.dps * b.owned * getBuildingOutputMultiplier(b.id), 0);
    const getResearchMultiplier = () => 1 + state.researchPoints * 0.1;
    const getPrestigeBranchLevel = (id) => Math.max(0, Number(state.prestigeBranches?.[id]) || 0);
    const getPrestigeManualMultiplier = () => 1 + getPrestigeBranchLevel("legacy_manual") * 0.12;
    const getPrestigeGpsMultiplier = () => 1 + getPrestigeBranchLevel("legacy_line") * 0.10;
    const getSkillGpsMultiplier = () => 1 + getSkillLevel("line_optimizer") * 0.2;
    const getSkillManualMultiplier = () => 1 + getSkillLevel("manual_mastery") * 0.25;
    const isOverdriveActive = (nowMs = Date.now()) => nowMs < state.overdriveUntil;
    const getOverdriveMultiplier = (nowMs = Date.now()) => isOverdriveActive(nowMs) ? OVERDRIVE_GPS_MULT : 1;
    const getIndustryChainMultiplier = () => {
      const internOwned = buildings.find((b) => b.id === "intern")?.owned || 0;
      const conveyorOwned = buildings.find((b) => b.id === "conveyor")?.owned || 0;
      const assemblerOwned = buildings.find((b) => b.id === "assembler")?.owned || 0;
      // 工业产业链联动：只有“人力-运输-组装”都跟上时才给高效增益，鼓励平衡扩张而非单点堆叠。
      const chainStage = Math.min(internOwned / 20, conveyorOwned / 10, assemblerOwned / 5);
      const clampedStage = Math.max(0, Math.min(CHAIN_MAX_STAGES, chainStage));
      const imbalance = Math.max(0, (Math.max(internOwned, conveyorOwned, assemblerOwned) - Math.min(internOwned, conveyorOwned, assemblerOwned)) / 120);
      const synergy = 1 + clampedStage * CHAIN_BONUS_PER_STAGE;
      return Math.max(1, synergy - imbalance * 0.06);
    };

    const getTotalGPS = () => getBaseGPS() * state.gpsMultiplier * getResearchMultiplier() * getSkillGpsMultiplier() * getIndustryChainMultiplier() * getPrestigeGpsMultiplier() * getOverdriveMultiplier() * state.debugGpsMult;
    const getComboMultiplier = () => 1 + Math.min(COMBO_MAX_STREAK, state.comboStreak) * COMBO_BONUS_PER_STACK;
    const getManualGain = () => state.manualPower * getSkillManualMultiplier() * getComboMultiplier() * getPrestigeManualMultiplier() * state.debugManualMult;

    const FINANCE_MARKET_STATES = {
      stable: { label: "平稳", aprDelta: 0, cycleScale: 0.8, orderWeight: 1 },
      overheat: { label: "过热", aprDelta: 0.018, cycleScale: 1.15, orderWeight: 1.2 },
      pullback: { label: "回调", aprDelta: -0.012, cycleScale: 0.95, orderWeight: 1.05 },
      panic: { label: "恐慌", aprDelta: -0.022, cycleScale: 0.7, orderWeight: 1.25 }
    };
    const FINANCE_STRATEGIES = {
      conservative: { label: "稳健", aprMult: 0.9, mainlineMult: 1.08, orderRewardMult: 1.02 },
      balanced: { label: "平衡", aprMult: 1, mainlineMult: 1, orderRewardMult: 1 },
      aggressive: { label: "激进", aprMult: 1.22, mainlineMult: 0.92, orderRewardMult: 1.12 }
    };
    const FINANCE_MARKET_TIMELINE = ["stable", "overheat", "pullback", "panic"];
    const FINANCE_SEASONS = [
      { key: "inflation", label: "高通胀", aprShift: 0.012, capMult: 1.05, aiPressure: 0.18 },
      { key: "tightening", label: "紧缩", aprShift: -0.009, capMult: 0.9, aiPressure: 0.38 },
      { key: "supply_shock", label: "供给冲击", aprShift: -0.003, capMult: 0.95, aiPressure: 0.46 }
    ];

    const getCurrentMarketKey = () => {
      const idx = Math.floor(state.totalClicks / 75) % FINANCE_MARKET_TIMELINE.length;
      return FINANCE_MARKET_TIMELINE[idx];
    };
    const getCurrentMarketState = () => FINANCE_MARKET_STATES[getCurrentMarketKey()];
    const getCurrentSeason = () => FINANCE_SEASONS[state.financeSeasonIndex % FINANCE_SEASONS.length];
    const getIntelPreview = (steps = 2) => {
      const start = Math.floor(state.totalClicks / 75);
      const arr = [];
      for (let i = 1; i <= steps; i += 1) {
        const key = FINANCE_MARKET_TIMELINE[(start + i) % FINANCE_MARKET_TIMELINE.length];
        arr.push(FINANCE_MARKET_STATES[key].label);
      }
      return arr.join(" → ");
    };
    const getAssetRiskBudget = () => state.financeAssets.bond * 0.6 + state.financeAssets.equity * 1 + state.financeAssets.derivative * 1.45;
    const getAiLiquidityPressure = () => {
      const season = getCurrentSeason();
      const wave = (Math.sin(state.totalClicks / 38) + 1) / 2;
      return Math.min(1, season.aiPressure * 0.7 + wave * 0.45);
    };
    const getCurrentStrategyProfile = () => FINANCE_STRATEGIES[state.financeStrategy] || FINANCE_STRATEGIES.balanced;
    const isHedgeActive = (nowMs = Date.now()) => state.financeHedgeUntil > nowMs;
    const getFinanceCreditLevel = () => {
      const chainBonus = Math.max(0, Math.floor((getIndustryChainMultiplier() - 1) / 0.08));
      return Math.max(0, state.financeCreditBase + chainBonus);
    };
    const isPrestigeSprintWindow = () => {
      const current = getPrestigeGain(state.lifetimeGears);
      const nearNext = getPrestigeGain(state.lifetimeGears + 220_000) > current;
      const progress = Math.min(1, state.lifetimeGears / 2_000_000);
      return current >= 1 && (nearNext || progress >= FINANCE_PRESTIGE_SPRINT_TRIGGER);
    };

    // 金融系统：把市场状态、策略切换、对冲动作并入收益构成，形成“低风险+高风险”共存。
    const getFinanceAprComponents = (nowMs = Date.now()) => {
      const strategy = getCurrentStrategyProfile();
      const market = getCurrentMarketState();
      const hedgeOn = isHedgeActive(nowMs);
      const season = getCurrentSeason();
      const aiPressure = getAiLiquidityPressure();
      const base = FINANCE_BASE_APR;
      const cycle = FINANCE_CYCLE_AMPLITUDE * Math.sin(state.totalClicks / 45) * market.cycleScale * (hedgeOn ? FINANCE_HEDGE_VOL_MULT : 1);
      const creditLevel = getFinanceCreditLevel();
      const sprintOn = isPrestigeSprintWindow();
      const riskControl = state.financeTier * FINANCE_TIER_APR_BONUS;
      const marketShift = market.aprDelta + creditLevel * 0.003 + season.aprShift;
      const strategyShift = base * (strategy.aprMult - 1);
      const metaShift = state.financeMetaPoints * FINANCE_META_APR_PER_POINT + state.financeLineage * 0.002;
      const sprintShift = sprintOn ? FINANCE_PRESTIGE_SPRINT_APR_BONUS : 0;
      const hedgeShift = hedgeOn ? (base * FINANCE_HEDGE_APR_MULT - base) : 0;
      const assetShift = (getAssetRiskBudget() - 1) * 0.01;
      const liquidityShift = -aiPressure * 0.012;
      const cycleBoost = sprintOn ? FINANCE_PRESTIGE_SPRINT_VOL_MULT : 1;
      return { base, cycle: cycle * cycleBoost, riskControl, marketShift, strategyShift, metaShift, sprintShift, hedgeShift, assetShift, liquidityShift, creditLevel, sprintOn, season, aiPressure };
    };
    const getFinanceApr = (nowMs = Date.now()) => {
      const c = getFinanceAprComponents(nowMs);
      return Math.max(0.01, c.base + c.cycle + c.riskControl + c.marketShift + c.strategyShift + c.metaShift + c.sprintShift + c.hedgeShift + c.assetShift + c.liquidityShift);
    };
    // 金融收益做“主线占比封顶”：避免单一路线碾压，同时策略会影响主线权重。
    const getFinanceIncomePerSecond = (baseGps = getTotalGPS(), nowMs = Date.now()) => {
      const raw = state.financeCapital * getFinanceApr(nowMs);
      const cap = Math.max(FINANCE_MIN_CAP_GPS, baseGps * FINANCE_MAX_SHARE_OF_MAINLINE * getCurrentSeason().capMult * (1 - getAiLiquidityPressure() * 0.25));
      return Math.min(raw, cap);
    };

    const getMainlineGpsWithFinanceStrategy = (gps = getTotalGPS()) => {
      const strategy = getCurrentStrategyProfile();
      return gps * strategy.mainlineMult;
    };

    // 金融建议器：明确提供低风险（对冲/提取）与高风险（激进/投入）动作窗口。
    const getFinanceAdvice = ({ unlocked, mainlineGps, financeIncome, investCooling, withdrawCooling, hedgeCost }) => {
      if (!unlocked) return { tone: "info", text: `建议：先把累计齿轮推到 ${FINANCE_UNLOCK_LIFETIME_GEARS} 解锁金融。` };

      const upgradeCost = 1 + state.financeTier;
      const cap = Math.max(FINANCE_MIN_CAP_GPS, mainlineGps * FINANCE_MAX_SHARE_OF_MAINLINE * getCurrentSeason().capMult * (1 - getAiLiquidityPressure() * 0.25));
      const capRatio = cap > 0 ? financeIncome / cap : 0;
      const marketKey = getCurrentMarketKey();

      if (marketKey === "panic" && state.financeCapital >= hedgeCost && !isHedgeActive()) {
        return { tone: "warn", text: "建议：恐慌期先做对冲（低风险动作），压低波动再观察提取窗口。" };
      }

      if (isPrestigeSprintWindow() && state.financeStrategy !== "aggressive") {
        return { tone: "good", text: "建议：已进入 Prestige 冲刺窗口，可切激进策略冲高收益后再重置。" };
      }

      if (state.financeTier < 8 && state.researchPoints >= upgradeCost) {
        return { tone: "good", text: `建议：可升级风控（消耗 ${upgradeCost} RP），直接抬升长期年化。` };
      }

      if (state.financeStrategy !== "aggressive" && getCurrentMarketKey() === "overheat") {
        return { tone: "good", text: "建议：过热期可切换激进策略（高风险动作）争取短线收益。" };
      }

      if (!investCooling && state.gears >= 100 && capRatio < 0.75) {
        return { tone: "good", text: "建议：当前未接近收益封顶，优先投入 10% 齿轮提高资金池。" };
      }

      if (!withdrawCooling && capRatio >= 0.95 && state.financeCapital > 0) {
        return { tone: "warn", text: "建议：金融收益接近封顶，可提取 25% 回流主线扩产。" };
      }

      if (investCooling || withdrawCooling) {
        return { tone: "info", text: "建议：处于冷却窗口，先购买建筑/推进订单再回金融操作。" };
      }

      return { tone: "info", text: "建议：维持当前配置，观察市场切换后再决定投入或提取。" };
    };

    const getAffordableCount = (building, budget, mode) => {
      if (mode === "1") return budget >= getCurrentPrice(building) ? 1 : 0;
      if (mode === "10" || mode === "100") {
        const target = Number(mode);
        let totalCost = 0;
        for (let i = 0; i < target; i += 1) {
          totalCost += getCurrentPrice(building, i);
          if (totalCost > budget) return i;
        }
        return target;
      }

      let count = 0;
      let totalCost = 0;
      while (count < 10000) {
        totalCost += getCurrentPrice(building, count);
        if (totalCost > budget) return count;
        count += 1;
      }
      return count;
    };

    const getPurchaseCost = (building, count) => {
      let cost = 0;
      for (let i = 0; i < count; i += 1) {
        cost += getCurrentPrice(building, i);
      }
      return cost;
    };



    const triggerButtonPop = (el) => {
      if (!el) return;
      el.classList.remove("btn-pop");
      // 强制重排，确保连续触发也能看到动画。
      void el.offsetWidth;
      el.classList.add("btn-pop");
      window.setTimeout(() => el.classList.remove("btn-pop"), FX_BTN_POP_MS);
    };

    const triggerPanelPulse = (el) => {
      if (!el) return;
      el.classList.remove("panel-pulse");
      void el.offsetWidth;
      el.classList.add("panel-pulse");
      window.setTimeout(() => el.classList.remove("panel-pulse"), FX_PANEL_PULSE_MS);
    };

    const triggerTypedPanelPulse = (type, el = gamePanelEl) => {
      if (!el) return;
      const map = {
        task: "panel-pulse-task",
        order: "panel-pulse-order",
        prestige: "panel-pulse-prestige"
      };
      const className = map[type] || "panel-pulse";
      el.classList.remove("panel-pulse-task", "panel-pulse-order", "panel-pulse-prestige", "panel-pulse");
      void el.offsetWidth;
      el.classList.add(className);
      window.setTimeout(() => el.classList.remove(className), FX_PANEL_PULSE_MS + 40);
    };

    const triggerScreenShake = (el = gamePanelEl, fallbackType = "task") => {
      if (!el) return;
      if (state.lowPerfMode) {
        triggerTypedPanelPulse(fallbackType, el);
        return;
      }
      const now = performance.now();
      // 限制高频震屏；冷却期内自动降级为边框脉冲，保证反馈连续但不过载。
      if (now - state.lastShakeAt < FX_SHAKE_COOLDOWN_MS) {
        triggerTypedPanelPulse(fallbackType, el);
        return;
      }
      state.lastShakeAt = now;
      el.classList.remove("screen-shake");
      void el.offsetWidth;
      el.classList.add("screen-shake");
      window.setTimeout(() => el.classList.remove("screen-shake"), FX_SHAKE_DURATION_MS);
    };

    // 高价值事件使用统一高光模板：视觉层统一，后续只改这里即可完成风格迭代。
    const triggerEventHighlight = (type, text, subtitle = "") => {
      if (!highlightLayerEl || !text) return;
      const item = document.createElement("div");
      item.className = `event-highlight ${type || "task"}`;
      const titleEl = document.createElement("span");
      titleEl.className = "title";
      titleEl.textContent = text;
      item.appendChild(titleEl);
      if (subtitle) {
        const subtitleEl = document.createElement("span");
        subtitleEl.className = "subtitle";
        subtitleEl.textContent = subtitle;
        item.appendChild(subtitleEl);
      }
      highlightLayerEl.appendChild(item);
      window.setTimeout(() => item.remove(), FX_HIGHLIGHT_DURATION_MS);
    };

    const spawnFloatingGain = (anchorEl, text, kind = "gear", priority = "normal") => {
      if (!fxLayerEl || !anchorEl) return;
      const hardCap = FX_MAX_FLOATING_GAINS + FX_PRIORITY_SLOTS;
      const normalCap = FX_MAX_FLOATING_GAINS;
      const canSpawn = priority === "high"
        ? state.activeFloatingGains < hardCap
        : state.activeFloatingGains < normalCap;
      if (!canSpawn) return;
      state.activeFloatingGains += 1;

      const rect = anchorEl.getBoundingClientRect();
      const item = document.createElement("div");
      item.className = `floating-gain ${kind}${priority === "high" ? " priority-high" : ""}`;
      item.textContent = text;
      item.style.left = `${rect.left + rect.width / 2}px`;
      item.style.top = `${rect.top - 6}px`;
      fxLayerEl.appendChild(item);
      const duration = Math.floor((FX_FLOAT_DURATION_MS + 80) * (state.lowPerfMode ? LOW_PERF_FLOAT_SCALE : 1));
      window.setTimeout(() => {
        item.remove();
        state.activeFloatingGains = Math.max(0, state.activeFloatingGains - 1);
      }, duration);
    };

    // 阶段3：反馈事件化接线，后续可整体迁移到独立 FX 组合器。
    const emitFeedback = (eventName, payload = {}) => feedbackBus.emit(eventName, payload);
    attachGameFeelHandlers({
      feedbackBus,
      manualBtn,
      gamePanelEl,
      orderPanelEl: document.getElementById("orderPanel"),
      format,
      triggerButtonPop,
      spawnFloatingGain,
      triggerPanelPulse,
      triggerEventHighlight,
      triggerScreenShake,
      playSfx: (kind) => audioSystem.playSfx(kind)
    });
    const getOrderProgress = (order = state.activeOrder) => calcOrderProgress(order, {
      totalClicks: state.totalClicks,
      lifetimeGears: state.lifetimeGears,
      buildingOwnedById: Object.fromEntries(buildings.map((b) => [b.id, b.owned]))
    });
    const pickWeightedOrderTemplate = (tier, marketKey = "stable") => {
      const unlocked = ORDER_TEMPLATES.filter((template) => template.minTier <= tier);
      return pickWeightedTemplate(unlocked, marketKey, Math.random) || ORDER_TEMPLATES[0];
    };

    const createOrder = () => {
      const tier = Math.max(1, Math.floor(state.lifetimeGears / ORDER_TIER_STEP) + 1);
      const marketKey = getCurrentMarketKey();
      const template = pickWeightedOrderTemplate(tier, marketKey);
      const strategy = getCurrentStrategyProfile();
      const timestamp = Date.now();
      const targetScale = Math.max(0.6, Number(template.targetScale) || 1);
      const rewardScale = Math.max(0.5, (Number(template.rewardScale) || 1) * strategy.orderRewardMult * (getCurrentMarketState().orderWeight || 1));

      state.activeOrder = createOrderFromTemplate({
        template,
        tier,
        timestamp,
        rewardScale,
        targetScale,
        runtimeSnapshot: {
          totalClicks: state.totalClicks,
          lifetimeGears: state.lifetimeGears,
          buildingOwnedById: Object.fromEntries(buildings.map((b) => [b.id, b.owned]))
        }
      });

      saveGame();
    };

    const ensureOrder = () => {
      const unlocked = state.lifetimeGears >= ORDER_UNLOCK_LIFETIME_GEARS;
      if (!unlocked) return;
      if (!state.activeOrder) createOrder();
    };
    const migrateSaveData = (rawData) => migrateSavePayload(rawData, SAVE_VERSION);

    const resetCollectionProgress = () => {
      for (const b of buildings) b.owned = 0;
      for (const u of upgrades) u.purchased = false;
      for (const s of skills) s.level = 0;
      for (const sp of specializationUpgrades) sp.level = 0;
      for (const a of achievements) {
        a.done = false;
        a.claimed = false;
      }
    };

    const normalizeFinanceAssets = () => {
      const b = Math.max(0, Number(state.financeAssets?.bond) || DEFAULT_FINANCE_ASSETS.bond);
      const e = Math.max(0, Number(state.financeAssets?.equity) || DEFAULT_FINANCE_ASSETS.equity);
      const d = Math.max(0, Number(state.financeAssets?.derivative) || DEFAULT_FINANCE_ASSETS.derivative);
      const sum = b + e + d;
      if (sum <= 0) {
        state.financeAssets = { ...DEFAULT_FINANCE_ASSETS };
        return;
      }
      state.financeAssets = { bond: b / sum, equity: e / sum, derivative: d / sum };
    };

    const normalizeRuntimeState = () => {
      state.gears = Math.max(0, Number(state.gears) || 0);
      state.lifetimeGears = Math.max(0, Number(state.lifetimeGears) || 0);
      state.financeCapital = Math.max(0, Number(state.financeCapital) || 0);
      state.researchPoints = Math.max(0, Math.floor(Number(state.researchPoints) || 0));
      state.overdriveUntil = Math.max(0, Number(state.overdriveUntil) || 0);
      state.overdriveCooldownUntil = Math.max(0, Number(state.overdriveCooldownUntil) || 0);
      state.overdriveActivations = Math.max(0, Math.floor(Number(state.overdriveActivations) || 0));
      normalizeFinanceAssets();
    };

    const resetRunState = () => {
      state.gears = 0;
      state.purchaseMode = "1";
      state.pendingOfflineGears = 0;
      state.accumulator = 0;
      state.manualPower = 1;
      state.gpsMultiplier = 1;
      state.totalClicks = 0;
      state.lifetimeGears = 0;
      state.lastRewardText = "";
      state.gameSpeed = 1;
      state.questIndex = 0;
      state.autoBuy = false;
      state.autoBuyAccumulator = 0;
      state.activeOrder = null;
      state.comboStreak = 0;
      state.comboTimer = 0;
      state.financeCapital = 0;
      state.financeTier = 0;
      state.financeLastInvestAt = 0;
      state.financeLastWithdrawAt = 0;
      state.financeStrategy = "balanced";
      state.financeHedgeUntil = 0;
      state.financeStrategySwitches = 0;
      state.financeSeasonIndex = 0;
      state.financeLeaderboard = [];
      state.financeAssets = { ...DEFAULT_FINANCE_ASSETS };
      state.financeLineage = 0;
      state.financeAutoPilot = false;
      state.financeAutoAccumulator = 0;
      state.overdriveUntil = 0;
      state.overdriveCooldownUntil = 0;
      state.overdriveActivations = 0;
      resetCollectionProgress();
    };

    const saveGame = () => {
      normalizeRuntimeState();
      const payload = {
        gears: state.gears,
        purchaseMode: state.purchaseMode,
        gameSpeed: state.gameSpeed,
        autoBuy: state.autoBuy,
        questIndex: state.questIndex,
        logs: state.logs.slice(0, 20),
        buildings: buildings.map((b) => ({ id: b.id, owned: b.owned })),
        upgrades: upgrades.map((u) => ({ id: u.id, purchased: u.purchased })),
        manualPower: state.manualPower,
        gpsMultiplier: state.gpsMultiplier,
        totalClicks: state.totalClicks,
        lifetimeGears: state.lifetimeGears,
        achievements: achievements.map((a) => ({ id: a.id, done: a.done, claimed: a.claimed })),
        skills: skills.map((s) => ({ id: s.id, level: s.level })),
        specializationUpgrades: specializationUpgrades.map((sp) => ({ id: sp.id, level: sp.level })),
        researchPoints: state.researchPoints,
        activeOrder: state.activeOrder,
        audioEnabled: state.audioEnabled,
        lowPerfMode: state.lowPerfMode,
        lowPerfAudioSafe: state.lowPerfAudioSafe,
        categoryCollapse: state.categoryCollapse,
        financeCapital: state.financeCapital,
        financeTier: state.financeTier,
        financeLastInvestAt: state.financeLastInvestAt,
        financeLastWithdrawAt: state.financeLastWithdrawAt,
        financeStrategy: state.financeStrategy,
        financeHedgeUntil: state.financeHedgeUntil,
        financeMetaPoints: state.financeMetaPoints,
        financeCreditBase: state.financeCreditBase,
        financeStrategySwitches: state.financeStrategySwitches,
        financeSeasonIndex: state.financeSeasonIndex,
        financeLeaderboard: state.financeLeaderboard,
        financeAssets: state.financeAssets,
        financeLineage: state.financeLineage,
        financeAutoPilot: state.financeAutoPilot,
        prestigeBranches: state.prestigeBranches,
        debugPanelOpen: state.debugPanelOpen,
        debugManualMult: state.debugManualMult,
        debugGpsMult: state.debugGpsMult,
        overdriveUntil: state.overdriveUntil,
        overdriveCooldownUntil: state.overdriveCooldownUntil,
        overdriveActivations: state.overdriveActivations,
        saveVersion: SAVE_VERSION,
        savedAt: Date.now()
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    };


    const exportSave = async () => {
      const raw = localStorage.getItem(SAVE_KEY) || "";
      if (!raw) {
        window.alert("当前没有可导出的存档。");
        return;
      }
      try {
        await navigator.clipboard.writeText(raw);
        pushLog("已导出存档到剪贴板");
      } catch {
        window.prompt("复制以下存档文本", raw);
      }
    };

    // 导入前做结构白名单校验，避免脏字段直写主存档；失败可自动回滚到备份。
    const sanitizeImportPayload = (data) => {
      if (!data || typeof data !== "object") return null;
      if (!Array.isArray(data.buildings) || !Array.isArray(data.upgrades)) return null;
      if (!Array.isArray(data.skills) || !Array.isArray(data.achievements)) return null;
      if (data.financeLeaderboard && !Array.isArray(data.financeLeaderboard)) return null;
      if (data.financeAssets && typeof data.financeAssets !== "object") return null;
      return data;
    };

    const importSave = () => {
      const raw = window.prompt("粘贴存档文本以导入（会覆盖当前进度）");
      if (!raw) return;
      const previousRaw = localStorage.getItem(SAVE_KEY);
      if (previousRaw) localStorage.setItem(SAVE_BACKUP_KEY, previousRaw);
      try {
        const data = sanitizeImportPayload(migrateSaveData(JSON.parse(raw)));
        if (!data) throw new Error("invalid payload");
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        pushLog("已导入存档，正在刷新状态");
        loadGame();
        render();
      } catch {
        const backupRaw = localStorage.getItem(SAVE_BACKUP_KEY);
        if (backupRaw) {
          localStorage.setItem(SAVE_KEY, backupRaw);
          loadGame();
          render();
          window.alert("导入失败，已自动回滚到导入前存档。");
        } else {
          window.alert("存档格式无效，导入失败。");
        }
      }
    };

    const loadGame = () => {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return;
        const data = migrateSaveData(JSON.parse(raw));
        if (!data || typeof data !== "object") return;

        state.gears = Number(data.gears) || 0;
        if (["1", "10", "100", "max"].includes(data.purchaseMode)) {
          state.purchaseMode = data.purchaseMode;
        }
        if ([1,2,4].includes(Number(data.gameSpeed))) {
          state.gameSpeed = Number(data.gameSpeed);
        }
        state.autoBuy = Boolean(data.autoBuy);
        state.audioEnabled = data.audioEnabled !== false;
        state.lowPerfMode = Boolean(data.lowPerfMode);
        state.lowPerfAudioSafe = Boolean(data.lowPerfAudioSafe);
        state.financeCapital = Math.max(0, Number(data.financeCapital) || 0);
        state.financeTier = Math.max(0, Math.min(8, Math.floor(Number(data.financeTier) || 0)));
        state.financeLastInvestAt = Math.max(0, Number(data.financeLastInvestAt) || 0);
        state.financeLastWithdrawAt = Math.max(0, Number(data.financeLastWithdrawAt) || 0);
        state.financeStrategy = ["conservative", "balanced", "aggressive"].includes(data.financeStrategy) ? data.financeStrategy : "balanced";
        state.financeHedgeUntil = Math.max(0, Number(data.financeHedgeUntil) || 0);
        state.financeMetaPoints = Math.max(0, Math.floor(Number(data.financeMetaPoints) || 0));
        state.financeCreditBase = Math.max(0, Math.floor(Number(data.financeCreditBase) || 0));
        state.financeStrategySwitches = Math.max(0, Math.floor(Number(data.financeStrategySwitches) || 0));
        state.financeSeasonIndex = Math.max(0, Math.floor(Number(data.financeSeasonIndex) || 0)) % FINANCE_SEASONS.length;
        state.financeLeaderboard = Array.isArray(data.financeLeaderboard) ? data.financeLeaderboard.slice(0, 5).map((x) => Number(x) || 0) : [];
        const fa = data.financeAssets && typeof data.financeAssets === "object" ? data.financeAssets : {};
        const b = Math.max(0, Number(fa.bond) || 0.34);
        const e = Math.max(0, Number(fa.equity) || 0.33);
        const d = Math.max(0, Number(fa.derivative) || 0.33);
        const sum = b + e + d || 1;
        state.financeAssets = { bond: b/sum, equity: e/sum, derivative: d/sum };
        state.financeLineage = Math.max(0, Math.floor(Number(data.financeLineage) || 0));
        state.financeAutoPilot = Boolean(data.financeAutoPilot);
        state.financeAutoAccumulator = 0;
        state.prestigeBranches = {
          legacy_manual: Math.max(0, Math.min(5, Math.floor(Number(data.prestigeBranches?.legacy_manual) || 0))),
          legacy_line: Math.max(0, Math.min(5, Math.floor(Number(data.prestigeBranches?.legacy_line) || 0)))
        };
        state.debugPanelOpen = Boolean(data.debugPanelOpen);
        state.debugManualMult = Math.max(0.2, Math.min(5, Number(data.debugManualMult) || 1));
        state.debugGpsMult = Math.max(0.2, Math.min(5, Number(data.debugGpsMult) || 1));
        state.overdriveUntil = Math.max(0, Number(data.overdriveUntil) || 0);
        state.overdriveCooldownUntil = Math.max(0, Number(data.overdriveCooldownUntil) || 0);
        state.overdriveActivations = Math.max(0, Math.floor(Number(data.overdriveActivations) || 0));
        if (data.categoryCollapse && typeof data.categoryCollapse === "object") {
          state.categoryCollapse.economy = Boolean(data.categoryCollapse.economy);
          state.categoryCollapse.goals = Boolean(data.categoryCollapse.goals);
        }
        state.comboStreak = 0;
        state.comboTimer = 0;
        state.activeFloatingGains = 0;
        state.lastShakeAt = 0;
        state.questIndex = Math.max(0, Math.min(Number(data.questIndex) || 0, questChain.length));
        if (Array.isArray(data.logs)) state.logs = data.logs.slice(0, 20);

        if (Array.isArray(data.buildings)) {
          for (const saved of data.buildings) {
            const target = buildings.find((b) => b.id === saved.id);
            if (!target) continue;
            target.owned = Math.max(0, Math.floor(Number(saved.owned) || 0));
          }
        }

        state.manualPower = Math.max(1, Number(data.manualPower) || 1);
        state.gpsMultiplier = Math.max(1, Number(data.gpsMultiplier) || 1);
        state.totalClicks = Math.max(0, Number(data.totalClicks) || 0);
        state.lifetimeGears = Math.max(0, Number(data.lifetimeGears) || 0);
        state.researchPoints = Math.max(0, Math.floor(Number(data.researchPoints) || 0));
        if (data.activeOrder && typeof data.activeOrder === "object") {
          state.activeOrder = data.activeOrder;
        }

        if (Array.isArray(data.upgrades)) {
          for (const saved of data.upgrades) {
            const target = upgrades.find((u) => u.id === saved.id);
            if (!target) continue;
            target.purchased = Boolean(saved.purchased);
          }
        }

        if (Array.isArray(data.skills)) {
          for (const saved of data.skills) {
            const target = skills.find((s) => s.id === saved.id);
            if (!target) continue;
            target.level = Math.max(0, Math.min(target.maxLevel, Math.floor(Number(saved.level) || 0)));
          }
        }

        if (Array.isArray(data.specializationUpgrades)) {
          for (const saved of data.specializationUpgrades) {
            const target = specializationUpgrades.find((sp) => sp.id === saved.id);
            if (!target) continue;
            target.level = Math.max(0, Math.min(target.maxLevel, Math.floor(Number(saved.level) || 0)));
          }
        }

        if (Array.isArray(data.achievements)) {
          for (const saved of data.achievements) {
            const target = achievements.find((a) => a.id === saved.id);
            if (!target) continue;
            target.done = Boolean(saved.done);
            target.claimed = Boolean(saved.claimed);
          }
        }

        normalizeRuntimeState();

        const savedAt = Number(data.savedAt) || Date.now();
        const offlineSeconds = Math.max(0, Math.min((Date.now() - savedAt) / 1000, OFFLINE_CAP_SECONDS));
        const offlineGears = getTotalGPS() * offlineSeconds;
        if (offlineGears > 0) {
          state.pendingOfflineGears = offlineGears;
        }

        ensureOrder();

        if ((Number(data.saveVersion) || 1) !== SAVE_VERSION) {
          saveGame();
        }

      } catch (error) {
        console.warn("存档读取失败，已忽略：", error);
        const backupRaw = localStorage.getItem(SAVE_BACKUP_KEY);
        if (backupRaw) {
          localStorage.setItem(SAVE_KEY, backupRaw);
          window.alert("当前存档读取失败，已回滚到最近一次备份。");
        }
      }
    };

    const createBuildingRow = (building) => {
      const row = document.createElement("div");
      row.className = "building";
      row.dataset.id = building.id;

      row.innerHTML = `
        <div>
          <div class="name">${building.name}</div>
          <div class="meta">
            <span>产出：${building.dps} / 秒</span>
            <span>拥有：<strong data-owned="${building.id}">0</strong></span>
          </div>
          <div class="hint" data-hint="${building.id}"></div>
          <div class="locked-note" data-lock="${building.id}"></div>
        </div>
        <button class="btn buy-btn" data-buy="${building.id}">购买 x1（0 齿轮）</button>
      `;

      buildingList.appendChild(row);

      buildingViewMap.set(building.id, {
        ownedEl: row.querySelector(`[data-owned="${building.id}"]`),
        buyBtn: row.querySelector(`[data-buy="${building.id}"]`),
        hintEl: row.querySelector(`[data-hint="${building.id}"]`),
        lockEl: row.querySelector(`[data-lock="${building.id}"]`)
      });
    };

    const createUpgradeRow = (upgrade) => {
      const row = document.createElement("div");
      row.className = "upgrade";
      row.dataset.id = upgrade.id;
      row.innerHTML = `
        <div>
          <div class="name">${upgrade.name}</div>
          <div class="meta">${upgrade.desc}</div>
          <div class="meta" data-upgrade-lock="${upgrade.id}"></div>
        </div>
        <button class="btn upgrade-btn" data-upgrade="${upgrade.id}">研发（${format(upgrade.price)} 齿轮）</button>
      `;
      upgradeList.appendChild(row);
      upgradeViewMap.set(upgrade.id, {
        btn: row.querySelector(`[data-upgrade="${upgrade.id}"]`),
        lockEl: row.querySelector(`[data-upgrade-lock="${upgrade.id}"]`)
      });
    };

    const createSkillRow = (skill) => {
      const row = document.createElement("div");
      row.className = "skill";
      row.dataset.id = skill.id;
      row.innerHTML = `
        <div>
          <div class="name">${skill.name}</div>
          <div class="meta">${skill.desc}</div>
          <div class="meta" data-skill-meta="${skill.id}"></div>
        </div>
        <button class="btn skill-btn" data-skill-buy="${skill.id}">升级（1 RP）</button>
      `;
      skillList.appendChild(row);
      skillViewMap.set(skill.id, {
        btn: row.querySelector(`[data-skill-buy="${skill.id}"]`),
        meta: row.querySelector(`[data-skill-meta="${skill.id}"]`)
      });
    };

    const createSpecializationRow = (spec) => {
      const row = document.createElement("div");
      row.className = "skill";
      row.dataset.id = spec.id;
      row.innerHTML = `
        <div>
          <div class="name">${spec.name}</div>
          <div class="meta">${spec.desc}</div>
          <div class="meta" data-spec-meta="${spec.id}"></div>
        </div>
        <button class="btn skill-btn" data-spec-buy="${spec.id}">升级（${spec.costRP} RP）</button>
      `;
      specializationList.appendChild(row);
      specializationViewMap.set(spec.id, {
        btn: row.querySelector(`[data-spec-buy="${spec.id}"]`),
        meta: row.querySelector(`[data-spec-meta="${spec.id}"]`)
      });
    };

    const createPrestigeBranchRow = (branch) => {
      const row = document.createElement("div");
      row.className = "skill";
      row.dataset.id = branch.id;
      row.innerHTML = `
        <div>
          <div class="name">${branch.name}</div>
          <div class="meta">${branch.desc}</div>
          <div class="meta" data-branch-meta="${branch.id}"></div>
        </div>
        <button class="btn skill-btn" data-branch-buy="${branch.id}">升级（${branch.cost} RP）</button>
      `;
      prestigeBranchList.appendChild(row);
      prestigeBranchViewMap.set(branch.id, {
        btn: row.querySelector(`[data-branch-buy="${branch.id}"]`),
        meta: row.querySelector(`[data-branch-meta="${branch.id}"]`)
      });
    };

    const buyPrestigeBranch = (id) => {
      const branch = PRESTIGE_BRANCHES.find((b) => b.id === id);
      if (!branch) return;
      const level = getPrestigeBranchLevel(id);
      if (level >= branch.maxLevel || state.researchPoints < branch.cost) return;
      state.researchPoints -= branch.cost;
      state.prestigeBranches[id] = level + 1;
      pushLog(`Prestige 分支升级：${branch.name} Lv.${state.prestigeBranches[id]}`);
      saveGame();
      render();
    };

    const buySpecialization = (id) => {
      const spec = specializationUpgrades.find((sp) => sp.id === id);
      if (!spec) return;
      if (spec.level >= spec.maxLevel) return;
      if (state.researchPoints < spec.costRP) return;
      state.researchPoints -= spec.costRP;
      spec.level += 1;
      pushLog(`专精升级：${spec.name} Lv.${spec.level}`);
      saveGame();
      render();
    };

    const createAchievementRow = (achievement) => {
      const row = document.createElement("div");
      row.className = "achievement";
      row.dataset.id = achievement.id;
      row.innerHTML = `
        <div>
          <div class="name">${achievement.name}</div>
          <div class="meta">${achievement.desc}</div>
        </div>
        <span class="badge" data-achievement-badge="${achievement.id}">未完成</span>
      `;
      achievementList.appendChild(row);
      achievementViewMap.set(achievement.id, {
        badge: row.querySelector(`[data-achievement-badge="${achievement.id}"]`)
      });
    };

    
    const claimAchievementReward = (achievement) => {
      if (!achievement.reward || achievement.claimed) return;
      achievement.claimed = true;
      grantReward(achievement.reward, `成就奖励（${achievement.name}）`, "high");
      saveGame();
    };

    
    const isBuildingUnlocked = (building) => state.lifetimeGears >= building.unlockLifetimeGears;

    const getUpgradeLockedReason = (upgrade) => {
      if (state.researchPoints < upgrade.unlockRP) {
        return `需要 RP ${upgrade.unlockRP}`;
      }
      if (upgrade.requires) {
        const required = upgrades.find((u) => u.id === upgrade.requires);
        if (required && !required.purchased) return `前置：${required.name}`;
      }
      return "";
    };

    
    const pushLog = (message) => {
      const line = `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${message}`;
      state.logs.unshift(line);
      state.logs = state.logs.slice(0, 20);
    };

    const grantReward = (reward, label, priority = "normal") => {
      if (!reward) return;
      if (reward.type === "gear") {
        state.gears += reward.value;
        state.lifetimeGears += reward.value;
        state.lastRewardText = `${label}：+${format(reward.value)} 齿轮`;
        pushLog(state.lastRewardText);
        emitFeedback(FEEDBACK_EVENTS.BIG_REWARD, { text: `+${format(reward.value)} 齿轮`, kind: "gear", priority, anchorEl: gamePanelEl });
      }
      if (reward.type === "rp") {
        state.researchPoints += reward.value;
        state.lastRewardText = `${label}：+${reward.value} RP`;
        pushLog(state.lastRewardText);
        emitFeedback(FEEDBACK_EVENTS.BIG_REWARD, { text: `+${reward.value} RP`, kind: "rp", priority, anchorEl: gamePanelEl });
      }
    };

    const updateQuestProgress = () => {
      if (state.questIndex >= questChain.length) {
        goalTitleEl.textContent = "阶段任务：已全部完成";
        goalFillEl.style.width = "100%";
        goalHintEl.textContent = "你已完成当前任务链";
        goalPctEl.textContent = "100%";
        questRewardEl.textContent = "奖励：已领取完毕";
        return;
      }

      const quest = questChain[state.questIndex];
      const current = quest.progress();
      const pct = Math.min(100, (current / quest.target) * 100);
      goalTitleEl.textContent = `阶段任务：${quest.title}`;
      goalFillEl.style.width = `${pct}%`;
      goalHintEl.textContent = current >= quest.target ? "任务已完成，奖励已发放" : `进度 ${format(current)} / ${format(quest.target)}`;
      goalPctEl.textContent = `${pct.toFixed(0)}%`;
      questRewardEl.textContent = `奖励：${quest.rewardText}`;

      if (current >= quest.target) {
        grantReward(quest.reward, `任务奖励（${quest.title}）`, "high");
        emitFeedback(FEEDBACK_EVENTS.TASK_COMPLETE, { title: quest.title });
        state.questIndex += 1;
        saveGame();
      }
    };

    const renderMode = () => {
      for (const btn of modeButtons) {
        btn.classList.toggle("active", btn.dataset.mode === state.purchaseMode);
      }
      for (const btn of speedButtons) {
        btn.classList.toggle("active", Number(btn.dataset.speed) === state.gameSpeed);
      }
      autoBuyBtn.classList.toggle("active", state.autoBuy);
      autoBuyBtn.textContent = `自动购买: ${state.autoBuy ? "开" : "关"}`;
      audioBtn.classList.toggle("active", state.audioEnabled);
      audioBtn.textContent = `音效: ${state.audioEnabled ? "开" : "关"}`;
      lowPerfBtn.classList.toggle("active", state.lowPerfMode);
      lowPerfBtn.textContent = `低性能模式: ${state.lowPerfMode ? "开" : "关"}`;
      lowPerfAudioBtn.classList.toggle("active", state.lowPerfAudioSafe);
      lowPerfAudioBtn.textContent = `低性能音效保护: ${state.lowPerfAudioSafe ? "开" : "关"}`;
      debugToggleBtn.classList.toggle("active", state.debugPanelOpen);
      debugToggleBtn.textContent = `调试面板: ${state.debugPanelOpen ? "开" : "关"}`;
    };

    const render = () => {
      renderTopbar({
        elements: {
          gearsEl,
          gpsEl,
          rpEl,
          statModeEl,
          statLifetimeEl,
          statChainEl
        },
        values: {
          gears: state.gears,
          totalGPS: getTotalGPS(),
          researchPoints: state.researchPoints,
          researchMultiplier: getResearchMultiplier(),
          gameSpeed: state.gameSpeed,
          financeIncomePerSecond: getFinanceIncomePerSecond(),
          industryChainMultiplier: getIndustryChainMultiplier(),
          financeCreditLevel: getFinanceCreditLevel(),
          financeMetaPoints: state.financeMetaPoints,
          prestigeManualMultiplier: getPrestigeManualMultiplier(),
          prestigeGpsMultiplier: getPrestigeGpsMultiplier(),
          autoBuy: state.autoBuy,
          lifetimeGears: state.lifetimeGears
        },
        format
      });

      for (const building of buildings) {
        const view = buildingViewMap.get(building.id);
        if (!view) continue;

        const count = getAffordableCount(building, state.gears, state.purchaseMode);
        const intendedCount = state.purchaseMode === "max" ? count : Math.min(count, Number(state.purchaseMode) || 1);
        const purchaseCount = Math.max(1, intendedCount || 0);
        const cost = getPurchaseCost(building, purchaseCount);

        view.ownedEl.textContent = building.owned;
        view.buyBtn.textContent = `购买 x${purchaseCount}（${format(cost)} 齿轮）`;

        const unlocked = isBuildingUnlocked(building);
        const affordable = count > 0 && unlocked;
        view.buyBtn.disabled = !affordable;

        if (!unlocked) {
          view.lockEl.textContent = `解锁条件：累计齿轮 ${format(building.unlockLifetimeGears)}`;
          view.hintEl.textContent = "";
        } else {
          view.lockEl.textContent = "";
          if (affordable) {
            view.hintEl.textContent = "";
          } else {
            const nextPrice = getCurrentPrice(building);
            view.hintEl.textContent = `还差 ${format(nextPrice - state.gears)} 齿轮`;
          }
        }
      }

      for (const upgrade of upgrades) {
        const view = upgradeViewMap.get(upgrade.id);
        if (!view) continue;
        if (upgrade.purchased) {
          view.btn.textContent = "已研发";
          view.btn.disabled = true;
          view.lockEl.textContent = "";
          continue;
        }
        const lockedReason = getUpgradeLockedReason(upgrade);
        view.lockEl.textContent = lockedReason;
        view.btn.textContent = `研发（${format(upgrade.price)} 齿轮）`;
        view.btn.disabled = state.gears < upgrade.price || Boolean(lockedReason);
      }
      updateQuestProgress();

      for (const skill of skills) {
        const view = skillViewMap.get(skill.id);
        if (!view) continue;
        view.meta.textContent = `等级 ${skill.level}/${skill.maxLevel}`;
        if (skill.level >= skill.maxLevel) {
          view.btn.disabled = true;
          view.btn.textContent = "已满级";
        } else {
          view.btn.disabled = state.researchPoints < skill.costRP;
          view.btn.textContent = `升级（${skill.costRP} RP）`;
        }
      }

      for (const spec of specializationUpgrades) {
        const view = specializationViewMap.get(spec.id);
        if (!view) continue;
        view.meta.textContent = `等级 ${spec.level}/${spec.maxLevel}`;
        if (spec.level >= spec.maxLevel) {
          view.btn.disabled = true;
          view.btn.textContent = "已满级";
        } else {
          view.btn.disabled = state.researchPoints < spec.costRP;
          view.btn.textContent = `升级（${spec.costRP} RP）`;
        }
      }

      const manualLegacy = getPrestigeBranchLevel("legacy_manual");
      const lineLegacy = getPrestigeBranchLevel("legacy_line");
      prestigeBranchSummaryEl.textContent = `分支：工匠 Lv.${manualLegacy} / 产线 Lv.${lineLegacy}`;
      prestigeBranchHintEl.textContent = `当前永久加成：手动 x${getPrestigeManualMultiplier().toFixed(2)} / 产线 x${getPrestigeGpsMultiplier().toFixed(2)}`;
      for (const branch of PRESTIGE_BRANCHES) {
        const view = prestigeBranchViewMap.get(branch.id);
        if (!view) continue;
        const level = getPrestigeBranchLevel(branch.id);
        view.meta.textContent = `等级 ${level}/${branch.maxLevel}`;
        if (level >= branch.maxLevel) {
          view.btn.disabled = true;
          view.btn.textContent = "已满级";
        } else {
          view.btn.disabled = state.researchPoints < branch.cost;
          view.btn.textContent = `升级（${branch.cost} RP）`;
        }
      }

      for (const achievement of achievements) {
        if (!achievement.done && achievement.check()) {
          achievement.done = true;
          claimAchievementReward(achievement);
        }
        const view = achievementViewMap.get(achievement.id);
        if (!view) continue;
        view.badge.classList.toggle("done", achievement.done);
        view.badge.textContent = achievement.done ? (achievement.claimed ? "已完成+奖励" : "已完成") : "未完成";
      }

      debugPanelEl.style.display = state.debugPanelOpen ? "block" : "none";
      debugSnapshotInfoEl.textContent = `快照：齿轮 ${format(state.gears)} / RP ${state.researchPoints} / GPS ${format(getTotalGPS())}`;
      debugManualMultBtn.textContent = `手动倍率 x${state.debugManualMult.toFixed(2)}`;
      debugGpsMultBtn.textContent = `产线倍率 x${state.debugGpsMult.toFixed(2)}`;

      if (state.pendingOfflineGears > 0) {
        offlineNoticeEl.style.display = "flex";
        offlineTextEl.textContent = `你离开期间积累了 ${format(state.pendingOfflineGears)} 齿轮`;
      } else {
        offlineNoticeEl.style.display = "none";
        offlineTextEl.textContent = "";
      }

      rewardFeedEl.textContent = state.lastRewardText || "成就奖励将显示在这里";

      eventLogEl.innerHTML = "";
      for (const line of state.logs.slice(0, 6)) {
        const el = document.createElement("div");
        el.className = "log-item";
        el.textContent = line;
        eventLogEl.appendChild(el);
      }

      const totalBuildings = buildings.reduce((sum, b) => sum + b.owned, 0);
      const doneAchievements = achievements.filter((a) => a.done).length;
      const doneUpgrades = upgrades.filter((u) => u.purchased).length;
      const totalSkillLevels = skills.reduce((sum, s) => sum + s.level, 0);
      const totalSpecLevels = specializationUpgrades.reduce((sum, sp) => sum + sp.level, 0);
      statBuildingsEl.textContent = `建筑总数：${totalBuildings}`;
      statUpgradesEl.textContent = `升级已研发：${doneUpgrades}/${upgrades.length} | 技能等级：${totalSkillLevels} | 专精等级：${totalSpecLevels}`;
      statAchievementsEl.textContent = `成就完成：${doneAchievements}/${achievements.length}`;
      statQuestEl.textContent = `任务进度：${Math.min(state.questIndex, questChain.length)}/${questChain.length}`;

      if (manualHintEl) {
        manualHintEl.textContent = `连击 x${(getComboMultiplier()).toFixed(2)}（${state.comboStreak} 连，${COMBO_DECAY_SECONDS}s 衰减）`;
      }

      const orderUnlocked = state.lifetimeGears >= ORDER_UNLOCK_LIFETIME_GEARS;
      if (!orderUnlocked) {
        orderTitleEl.textContent = "生产订单：尚未解锁";
        orderFillEl.style.width = "0%";
        orderHintEl.textContent = `累计齿轮达到 ${ORDER_UNLOCK_LIFETIME_GEARS} 后解锁`;
        orderPctEl.textContent = "0%";
        orderRewardEl.textContent = "奖励：-";
        claimOrderBtn.disabled = true;
        rerollOrderBtn.disabled = true;
      } else {
        ensureOrder();

        const order = state.activeOrder;
        const progress = order ? Math.min(getOrderProgress(order), order.target) : 0;
        const pct = order ? Math.min(100, (progress / order.target) * 100) : 0;
        orderTitleEl.textContent = order?.title || "生产订单";
        orderFillEl.style.width = `${pct}%`;
        const financeTagText = order?.financeTag ? `【${order.financeTag}】` : "";
        orderHintEl.textContent = order ? `${financeTagText}${order.desc}（${format(progress)} / ${format(order.target)}）` : "暂无订单";
        orderPctEl.textContent = `${pct.toFixed(0)}%`;
        orderRewardEl.textContent = order
          ? `奖励：${order.reward.type === "gear" ? `+${format(order.reward.value)} 齿轮` : `+${order.reward.value} RP`}`
          : "奖励：-";
        claimOrderBtn.disabled = !(order && progress >= order.target);
        rerollOrderBtn.disabled = state.gears < ORDER_REROLL_COST;
      }

      const financeUnlocked = state.lifetimeGears >= FINANCE_UNLOCK_LIFETIME_GEARS;
      if (!financeUnlocked) {
        const pct = Math.min(100, (state.lifetimeGears / FINANCE_UNLOCK_LIFETIME_GEARS) * 100);
        financeTitleEl.textContent = "金融系统：尚未解锁";
        financeFillEl.style.width = `${pct}%`;
        financeHintEl.textContent = `累计齿轮达到 ${FINANCE_UNLOCK_LIFETIME_GEARS} 后解锁`;
        financeYieldEl.textContent = "年化：0%";
        financeCapitalEl.textContent = "资金池：0";
        financeBreakdownEl.textContent = "构成：基础 0% / 波动 0% / 风控 0%";
        financeMarketEl.textContent = "市场：平稳";
        financeStrategyEl.textContent = "策略：平衡";
        financeSwitchesEl.textContent = "切换：0 次";
        financeSeasonEl.textContent = "赛季：-";
        financeIntelEl.textContent = "情报：下一步市场 -";
        financeLeaderboardEl.textContent = "赛季榜：暂无";
        financeAssetsEl.textContent = "资产：债 34% / 股 33% / 衍 33%";
        financeLiquidityEl.textContent = "流动性：正常";
        setMetricPillTone(financeMarketEl, null);
        setMetricPillTone(financeSeasonEl, null);
        setMetricPillTone(financeLiquidityEl, null);
        financeStrategyConservativeBtn.disabled = true;
        financeStrategyBalancedBtn.disabled = true;
        financeStrategyAggressiveBtn.disabled = true;
        financeStrategyConservativeBtn.classList.remove("active");
        financeStrategyBalancedBtn.classList.remove("active");
        financeStrategyAggressiveBtn.classList.remove("active");
        financeInvestBtn.disabled = true;
        financeWithdrawBtn.disabled = true;
        financeUpgradeBtn.disabled = true;
        financeHedgeBtn.disabled = true;
        financeSettleBtn.disabled = true;
        financeAutoBtn.disabled = true;
        financeAutoBtn.classList.remove("active");
        financeAutoBtn.textContent = "半自动策略：关";
        financeAssetBondBtn.disabled = true;
        financeAssetEquityBtn.disabled = true;
        financeAssetDerivativeBtn.disabled = true;
        const advice = getFinanceAdvice({ unlocked: false, mainlineGps: 0, financeIncome: 0, investCooling: false, withdrawCooling: false });
        financeAdviceEl.textContent = advice.text;
        financeAdviceEl.className = `subtitle finance-advice ${advice.tone}`;
      } else {
        const market = getCurrentMarketState();
        const strategy = getCurrentStrategyProfile();
        const apr = getFinanceApr();
        const comp = getFinanceAprComponents();
        const nowMs = Date.now();
        const investCooling = nowMs - state.financeLastInvestAt < FINANCE_COOLDOWN_MS;
        const withdrawCooling = nowMs - state.financeLastWithdrawAt < FINANCE_COOLDOWN_MS;
        financeTitleEl.textContent = `金融系统：风控等级 ${state.financeTier}`;
        financeFillEl.style.width = `${Math.min(100, (state.financeTier / 8) * 100)}%`;
        const mainlineGps = getTotalGPS();
        const effectiveFinance = getFinanceIncomePerSecond(mainlineGps);
        const cap = Math.max(FINANCE_MIN_CAP_GPS, mainlineGps * FINANCE_MAX_SHARE_OF_MAINLINE * getCurrentSeason().capMult * (1 - getAiLiquidityPressure() * 0.25));
        financeHintEl.textContent = `秒收益：+${format(effectiveFinance)} 齿轮（封顶 ${format(cap)}）`;
        financeYieldEl.textContent = `年化：${(apr * 100).toFixed(1)}%`;
        financeCapitalEl.textContent = `资金池：${format(state.financeCapital)}`;
        const sprintText = comp.sprintOn ? " / 冲刺 +ON" : "";
        financeBreakdownEl.textContent = `构成：基础 ${(comp.base * 100).toFixed(1)}% / 波动 ${(comp.cycle * 100).toFixed(1)}% / 风控 ${(comp.riskControl * 100).toFixed(1)}% / 信用 Lv.${comp.creditLevel} / 元进度 +${(state.financeMetaPoints * FINANCE_META_APR_PER_POINT * 100).toFixed(1)}%${sprintText}`;
        financeMarketEl.textContent = `市场：${market.label}`;
        financeStrategyEl.textContent = `策略：${strategy.label}`;
        financeSwitchesEl.textContent = `切换：${state.financeStrategySwitches} 次`;
        financeSeasonEl.textContent = `赛季：${comp.season.label}`;
        financeIntelEl.textContent = `情报：下一步市场 ${getIntelPreview(2)}`;
        const lb = state.financeLeaderboard.slice(0, 3).map((x, i) => `#${i+1} ${x}`).join(" | ");
        financeLeaderboardEl.textContent = `赛季榜：${lb || "暂无"}`;
        financeAssetsEl.textContent = `资产：债 ${(state.financeAssets.bond*100).toFixed(0)}% / 股 ${(state.financeAssets.equity*100).toFixed(0)}% / 衍 ${(state.financeAssets.derivative*100).toFixed(0)}%`;
        financeLiquidityEl.textContent = comp.aiPressure > 0.6 ? "流动性：紧张" : (comp.aiPressure > 0.35 ? "流动性：偏紧" : "流动性：正常");
        setMetricPillTone(financeMarketEl, market.factor >= 0.01 ? "good" : (market.factor <= -0.01 ? "danger" : "warn"));
        setMetricPillTone(financeSeasonEl, comp.season.capMult >= 1 ? "good" : "warn");
        setMetricPillTone(financeLiquidityEl, comp.aiPressure > 0.6 ? "danger" : (comp.aiPressure > 0.35 ? "warn" : "good"));
        financeStrategyConservativeBtn.classList.toggle("active", state.financeStrategy === "conservative");
        financeStrategyBalancedBtn.classList.toggle("active", state.financeStrategy === "balanced");
        financeStrategyAggressiveBtn.classList.toggle("active", state.financeStrategy === "aggressive");
        financeStrategyConservativeBtn.disabled = false;
        financeStrategyBalancedBtn.disabled = false;
        financeStrategyAggressiveBtn.disabled = false;
        financeInvestBtn.disabled = state.gears < 100 || investCooling;
        financeWithdrawBtn.disabled = state.financeCapital < 1 || withdrawCooling;
        const creditDiscount = Math.min(0.35, getFinanceCreditLevel() * 0.04);
        const upgradeCost = Math.max(1, Math.ceil((1 + state.financeTier) * (1 - creditDiscount)));
        financeUpgradeBtn.disabled = state.researchPoints < upgradeCost || state.financeTier >= 8;
        financeInvestBtn.textContent = investCooling ? "投入冷却中..." : "投入 10% 齿轮";
        financeWithdrawBtn.textContent = withdrawCooling ? "提取冷却中..." : "提取 25% 资金";
        financeUpgradeBtn.textContent = state.financeTier >= 8 ? "风控已满级" : `风控升级（${upgradeCost} RP）`;
        const hedgeCost = Math.max(1, Math.floor(state.financeCapital * FINANCE_HEDGE_COST_RATIO));
        financeHedgeBtn.disabled = isHedgeActive() || state.financeCapital < hedgeCost;
        financeHedgeBtn.textContent = isHedgeActive() ? "对冲生效中..." : `对冲（${format(hedgeCost)} 资金，12s）`;
        financeSettleBtn.disabled = state.financeCapital < 100;
        financeAutoBtn.disabled = false;
        financeAutoBtn.classList.toggle("active", state.financeAutoPilot);
        financeAutoBtn.textContent = `半自动策略：${state.financeAutoPilot ? "开" : "关"}`;
        financeAssetBondBtn.disabled = false;
        financeAssetEquityBtn.disabled = false;
        financeAssetDerivativeBtn.disabled = false;
        const advice = getFinanceAdvice({
          unlocked: true,
          mainlineGps,
          financeIncome: effectiveFinance,
          investCooling,
          withdrawCooling,
          hedgeCost: Math.max(1, Math.floor(state.financeCapital * FINANCE_HEDGE_COST_RATIO))
        });
        financeAdviceEl.textContent = advice.text;
        financeAdviceEl.className = `subtitle finance-advice ${advice.tone}`;
      }

      const nowMs = Date.now();
      const overdriveUnlocked = state.lifetimeGears >= OVERDRIVE_UNLOCK_LIFETIME_GEARS;
      const overdriveActive = isOverdriveActive(nowMs);
      const overdriveCooling = nowMs < state.overdriveCooldownUntil;
      overdriveFillEl.style.width = `${Math.min(100, (state.lifetimeGears / OVERDRIVE_UNLOCK_LIFETIME_GEARS) * 100)}%`;
      overdriveCountEl.textContent = `本轮触发：${state.overdriveActivations} 次`;
      if (!overdriveUnlocked) {
        overdriveHintEl.textContent = `累计齿轮达到 ${OVERDRIVE_UNLOCK_LIFETIME_GEARS} 后解锁`;
        overdriveStatusEl.textContent = "状态：未解锁";
        overdriveBtn.disabled = true;
        overdriveBtn.textContent = `启动超载（消耗 ${OVERDRIVE_COST_GEARS} 齿轮）`;
      } else if (overdriveActive) {
        const left = Math.max(0, Math.ceil((state.overdriveUntil - nowMs) / 1000));
        overdriveHintEl.textContent = `超载生效中：总 GPS x${OVERDRIVE_GPS_MULT}`;
        overdriveStatusEl.textContent = `状态：运行中（剩余 ${left}s）`;
        overdriveBtn.disabled = true;
        overdriveBtn.textContent = "超载运行中...";
      } else if (overdriveCooling) {
        const left = Math.max(0, Math.ceil((state.overdriveCooldownUntil - nowMs) / 1000));
        overdriveHintEl.textContent = "超载结束后进入冷却，可用来规划爆发窗口";
        overdriveStatusEl.textContent = `状态：冷却中（剩余 ${left}s）`;
        overdriveBtn.disabled = true;
        overdriveBtn.textContent = "冷却中...";
      } else {
        overdriveHintEl.textContent = `点击启动后 ${OVERDRIVE_DURATION_MS / 1000}s 内总 GPS x${OVERDRIVE_GPS_MULT}`;
        overdriveStatusEl.textContent = `状态：待机（可启动）`;
        overdriveBtn.disabled = state.gears < OVERDRIVE_COST_GEARS;
        overdriveBtn.textContent = `启动超载（消耗 ${OVERDRIVE_COST_GEARS} 齿轮）`;
      }

      renderMode();
      renderCategoryCollapse({ categoryCollapse: state.categoryCollapse });
      renderCategoryAlerts({
        activeOrder: state.activeOrder,
        orderProgress: getOrderProgress(state.activeOrder),
        achievements
      });
    };

    const tryAutoBuy = () => {
      // 优先购买升级，再购买建筑
      for (const upgrade of upgrades) {
        if (upgrade.purchased) continue;
        if (getUpgradeLockedReason(upgrade)) continue;
        if (state.gears >= upgrade.price) {
          buyUpgrade(upgrade.id);
          return;
        }
      }

      for (const building of [...buildings].reverse()) {
        if (!isBuildingUnlocked(building)) continue;
        const count = getAffordableCount(building, state.gears, "1");
        if (count > 0) {
          const prevMode = state.purchaseMode;
          state.purchaseMode = "1";
          buyBuilding(building.id);
          state.purchaseMode = prevMode;
          return;
        }
      }
    };

    const buySkill = (id) => {
      const skill = skills.find((s) => s.id === id);
      if (!skill) return;
      if (skill.level >= skill.maxLevel) return;
      if (state.researchPoints < skill.costRP) return;
      state.researchPoints -= skill.costRP;
      skill.level += 1;
      pushLog(`技能升级：${skill.name} Lv.${skill.level}`);
      saveGame();
      render();
    };

    const buyBuilding = (id) => {
      const building = buildings.find((b) => b.id === id);
      if (!building) return;
      if (!isBuildingUnlocked(building)) return;

      const count = getAffordableCount(building, state.gears, state.purchaseMode);
      if (count <= 0) return;

      const purchaseCount = state.purchaseMode === "max" ? count : Math.min(count, Number(state.purchaseMode) || 1);
      const cost = getPurchaseCost(building, purchaseCount);

      if (state.gears < cost) return;

      state.gears -= cost;
      building.owned += purchaseCount;
      pushLog(`购买 ${building.name} x${purchaseCount}`);
      saveGame();
      render();
    };

    const buyUpgrade = (id) => {
      const upgrade = upgrades.find((u) => u.id === id);
      if (!upgrade || upgrade.purchased) return;
      const lockedReason = getUpgradeLockedReason(upgrade);
      if (lockedReason) return;
      if (state.gears < upgrade.price) return;

      state.gears -= upgrade.price;
      upgrade.purchased = true;

      if (upgrade.type === "manual") state.manualPower += upgrade.value;
      if (upgrade.type === "gps") state.gpsMultiplier *= upgrade.value;
      pushLog(`研发升级：${upgrade.name}`);

      saveGame();
      render();
    };

    manualBtn.addEventListener("click", () => {
      state.comboStreak = Math.min(COMBO_MAX_STREAK, state.comboStreak + 1);
      state.comboTimer = COMBO_DECAY_SECONDS;

      const gain = getManualGain();
      state.gears += gain;
      state.lifetimeGears += gain;
      state.totalClicks += 1;
      if (state.totalClicks === 1) pushLog("首次手动生产");

      if (state.comboStreak === 10 || state.comboStreak === 25) {
        triggerPanelPulse(gamePanelEl);
        audioSystem.playSfx("order");
        pushLog(`连击加速：${state.comboStreak} 连击`);
      }

      emitFeedback(FEEDBACK_EVENTS.MANUAL_CLICK, { gain });
      saveGame();
      render();
    });

    buildingList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const id = target.dataset.buy;
      if (!id) return;
      buyBuilding(id);
    });

    upgradeList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const id = target.dataset.upgrade;
      if (!id) return;
      buyUpgrade(id);
    });

    skillList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const id = target.dataset.skillBuy;
      if (!id) return;
      buySkill(id);
    });

    specializationList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const id = target.dataset.specBuy;
      if (!id) return;
      buySpecialization(id);
    });

    prestigeBranchList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const id = target.dataset.branchBuy;
      if (!id) return;
      buyPrestigeBranch(id);
    });

    exportSaveBtn.addEventListener("click", () => {
      exportSave();
      render();
    });

    importSaveBtn.addEventListener("click", () => {
      importSave();
      saveGame();
    });

    bindPrimaryControls({
      controlsRoot: document.querySelector(".controls"),
      categoryGrid: document.querySelector('.category-grid'),
      onSetPurchaseMode: (mode) => {
        state.purchaseMode = mode;
        saveGame();
        render();
      },
      onSetSpeed: (speed) => {
        state.gameSpeed = speed;
        saveGame();
        render();
      },
      onToggleAutoBuy: () => {
        state.autoBuy = !state.autoBuy;
        pushLog(`自动购买已${state.autoBuy ? "开启" : "关闭"}`);
        saveGame();
        render();
      },
      onToggleAudio: () => {
        state.audioEnabled = !state.audioEnabled;
        if (state.audioEnabled) audioSystem.playSfx("click");
        pushLog(`音效已${state.audioEnabled ? "开启" : "关闭"}`);
        saveGame();
        render();
      },
      onToggleLowPerf: () => {
        state.lowPerfMode = !state.lowPerfMode;
        if (state.lowPerfMode) state.lowPerfAudioSafe = true;
        pushLog(`低性能模式已${state.lowPerfMode ? "开启" : "关闭"}`);
        saveGame();
        render();
      },
      onToggleLowPerfAudio: () => {
        state.lowPerfAudioSafe = !state.lowPerfAudioSafe;
        pushLog(`低性能音效保护已${state.lowPerfAudioSafe ? "开启" : "关闭"}`);
        saveGame();
        render();
      },
      onToggleDebugPanel: () => {
        state.debugPanelOpen = !state.debugPanelOpen;
        pushLog(`调试面板已${state.debugPanelOpen ? "开启" : "关闭"}`);
        saveGame();
        render();
      },
      onToggleCategory: (key) => {
        state.categoryCollapse[key] = !state.categoryCollapse[key];
        saveGame();
        renderCategoryCollapse({ categoryCollapse: state.categoryCollapse });
      }
    });

    debugAddGearsBtn.addEventListener("click", () => {
      if (!state.debugPanelOpen) return;
      state.gears += 10000;
      state.lifetimeGears += 10000;
      pushLog("[Debug] 注入 +10k 齿轮");
      saveGame();
      render();
    });

    debugAddRpBtn.addEventListener("click", () => {
      if (!state.debugPanelOpen) return;
      state.researchPoints += 5;
      pushLog("[Debug] 注入 +5 RP");
      saveGame();
      render();
    });

    debugSnapshotBtn.addEventListener("click", () => {
      if (!state.debugPanelOpen) return;
      const line = `[Debug快照] gears=${format(state.gears)} rp=${state.researchPoints} gps=${format(getTotalGPS())} lifetime=${format(state.lifetimeGears)} manualMult=${state.debugManualMult.toFixed(2)} gpsMult=${state.debugGpsMult.toFixed(2)}`;
      pushLog(line);
      saveGame();
      render();
    });

    debugManualMultBtn.addEventListener("click", () => {
      if (!state.debugPanelOpen) return;
      state.debugManualMult = state.debugManualMult >= 3 ? 1 : Math.min(3, +(state.debugManualMult + 0.5).toFixed(2));
      pushLog(`[Debug] 手动倍率调整为 x${state.debugManualMult.toFixed(2)}`);
      saveGame();
      render();
    });

    debugGpsMultBtn.addEventListener("click", () => {
      if (!state.debugPanelOpen) return;
      state.debugGpsMult = state.debugGpsMult >= 3 ? 1 : Math.min(3, +(state.debugGpsMult + 0.5).toFixed(2));
      pushLog(`[Debug] 产线倍率调整为 x${state.debugGpsMult.toFixed(2)}`);
      saveGame();
      render();
    });

    debugResetMultBtn.addEventListener("click", () => {
      if (!state.debugPanelOpen) return;
      state.debugManualMult = 1;
      state.debugGpsMult = 1;
      pushLog("[Debug] 已重置调试倍率到 x1.00");
      saveGame();
      render();
    });

    claimOfflineBtn.addEventListener("click", () => {
      if (state.pendingOfflineGears <= 0) return;
      state.gears += state.pendingOfflineGears;
      state.lifetimeGears += state.pendingOfflineGears;
      state.pendingOfflineGears = 0;
      saveGame();
      render();
    });

    overdriveBtn.addEventListener("click", () => {
      const nowMs = Date.now();
      if (state.lifetimeGears < OVERDRIVE_UNLOCK_LIFETIME_GEARS) return;
      if (state.gears < OVERDRIVE_COST_GEARS) return;
      if (isOverdriveActive(nowMs) || nowMs < state.overdriveCooldownUntil) return;
      state.gears -= OVERDRIVE_COST_GEARS;
      state.overdriveUntil = nowMs + OVERDRIVE_DURATION_MS;
      state.overdriveCooldownUntil = nowMs + OVERDRIVE_COOLDOWN_MS;
      state.overdriveActivations += 1;
      triggerButtonPop(overdriveBtn);
      triggerTypedPanelPulse("order", document.getElementById("overdrivePanel"));
      spawnFloatingGain(overdriveBtn, `GPS x${OVERDRIVE_GPS_MULT}`, "reward");
      pushLog(`[Overdrive] 启动成功：${OVERDRIVE_DURATION_MS / 1000}s 内总 GPS x${OVERDRIVE_GPS_MULT}`);
      audioSystem.playSfx("order");
      saveGame();
      render();
    });

    claimOrderBtn.addEventListener("click", () => {
      const order = state.activeOrder;
      if (!order) return;
      const progress = getOrderProgress(order);
      if (progress < order.target) return;
      grantReward(order.reward, `订单完成（${order.title}）`, "high");
      emitFeedback(FEEDBACK_EVENTS.ORDER_COMPLETE, { title: order.title });
      state.activeOrder = null;
      ensureOrder();
      saveGame();
      render();
    });

    rerollOrderBtn.addEventListener("click", () => {
      if (state.lifetimeGears < ORDER_UNLOCK_LIFETIME_GEARS) return;
      if (state.gears < ORDER_REROLL_COST) return;
      state.gears -= ORDER_REROLL_COST;
      createOrder();
      pushLog("已刷新生产订单");
      spawnFloatingGain(rerollOrderBtn, `-${ORDER_REROLL_COST} 齿轮`, "gear");
      triggerPanelPulse(document.getElementById("orderPanel"));
      triggerScreenShake(gamePanelEl, "order");
      audioSystem.playSfx("order");
      render();
    });
    const setFinanceStrategy = (strategyKey) => {
      if (!["conservative", "balanced", "aggressive"].includes(strategyKey)) return;
      if (state.lifetimeGears < FINANCE_UNLOCK_LIFETIME_GEARS) return;
      if (state.financeStrategy !== strategyKey) state.financeStrategySwitches += 1;
      state.financeStrategy = strategyKey;
      pushLog(`[Finance/策略] 切换为${FINANCE_STRATEGIES[strategyKey].label}`);
      triggerTypedPanelPulse("order", document.getElementById("financePanel"));
      saveGame();
      render();
    };

    financeStrategyConservativeBtn.addEventListener("click", () => setFinanceStrategy("conservative"));
    financeStrategyBalancedBtn.addEventListener("click", () => setFinanceStrategy("balanced"));
    financeStrategyAggressiveBtn.addEventListener("click", () => setFinanceStrategy("aggressive"));

    const runFinanceAutopilotStep = () => {
      if (!state.financeAutoPilot || state.lifetimeGears < FINANCE_UNLOCK_LIFETIME_GEARS) return;
      const nowMs = Date.now();
      const marketKey = getCurrentMarketKey();
      const strategy = state.financeStrategy;
      const mainlineGps = getTotalGPS();
      const cap = Math.max(FINANCE_MIN_CAP_GPS, mainlineGps * FINANCE_MAX_SHARE_OF_MAINLINE * getCurrentSeason().capMult * (1 - getAiLiquidityPressure() * 0.25));
      const financeIncome = getFinanceIncomePerSecond(mainlineGps);
      const capRatio = cap > 0 ? financeIncome / cap : 0;
      const investCooling = nowMs - state.financeLastInvestAt < FINANCE_COOLDOWN_MS;
      const withdrawCooling = nowMs - state.financeLastWithdrawAt < FINANCE_COOLDOWN_MS;

      if (marketKey === "panic" && !isHedgeActive(nowMs)) {
        const hedgeCost = Math.max(1, Math.floor(state.financeCapital * FINANCE_HEDGE_COST_RATIO));
        if (state.financeCapital >= hedgeCost) {
          state.financeCapital -= hedgeCost;
          state.financeHedgeUntil = nowMs + FINANCE_HEDGE_DURATION_MS;
          pushLog(`[Finance/半自动] 触发对冲，成本 ${format(hedgeCost)}`);
          return;
        }
      }

      if (marketKey === "overheat" && strategy !== "aggressive") {
        setFinanceStrategy("aggressive");
        pushLog("[Finance/半自动] 过热期切换激进策略");
        return;
      }
      if (marketKey === "pullback" && strategy === "aggressive") {
        setFinanceStrategy("balanced");
        pushLog("[Finance/半自动] 回调期回归平衡策略");
        return;
      }

      if (!investCooling && state.gears >= 100 && capRatio < 0.7) {
        const invest = Math.floor(state.gears * 0.1);
        if (invest >= 100) {
          state.gears -= invest;
          state.financeCapital += invest;
          state.financeLastInvestAt = nowMs;
          pushLog(`[Finance/半自动] 投入 ${format(invest)} 齿轮`);
          return;
        }
      }

      if (!withdrawCooling && state.financeCapital > 0 && capRatio > 0.92) {
        const withdraw = Math.floor(state.financeCapital * 0.25);
        if (withdraw > 0) {
          state.financeCapital -= withdraw;
          state.gears += withdraw;
          state.lifetimeGears += withdraw;
          state.financeLastWithdrawAt = nowMs;
          pushLog(`[Finance/半自动] 提取 ${format(withdraw)} 齿轮`);
        }
      }
    };

    financeAutoBtn.addEventListener("click", () => {
      if (state.lifetimeGears < FINANCE_UNLOCK_LIFETIME_GEARS) return;
      state.financeAutoPilot = !state.financeAutoPilot;
      pushLog(`[Finance/半自动] 已${state.financeAutoPilot ? "开启" : "关闭"}`);
      saveGame();
      render();
    });

    financeSettleBtn.addEventListener("click", () => {
      if (state.lifetimeGears < FINANCE_UNLOCK_LIFETIME_GEARS || state.financeCapital < 100) return;
      const riskBudget = getAssetRiskBudget();
      const score = Math.max(1, Math.floor((state.financeCapital * getFinanceApr()) / Math.max(0.6, riskBudget)));
      state.financeLeaderboard.push(score);
      state.financeLeaderboard = state.financeLeaderboard.sort((a,b) => b-a).slice(0,5);
      state.researchPoints += Math.max(1, Math.floor(score / 8000));
      state.financeSeasonIndex = (state.financeSeasonIndex + 1) % FINANCE_SEASONS.length;
      pushLog(`[Finance/赛季结算] 风险调整评分 ${score}`);
      triggerEventHighlight("order", `赛季结算评分 ${score}`);
      saveGame();
      render();
    });

    const rebalanceAssets = (target) => {
      const keys = ["bond", "equity", "derivative"];
      for (const k of keys) state.financeAssets[k] = Math.max(0.1, state.financeAssets[k] - 0.05);
      state.financeAssets[target] = Math.min(0.8, state.financeAssets[target] + 0.1);
      const sum = state.financeAssets.bond + state.financeAssets.equity + state.financeAssets.derivative;
      state.financeAssets.bond /= sum;
      state.financeAssets.equity /= sum;
      state.financeAssets.derivative /= sum;
      pushLog(`[Finance/资产] 调整至偏${target === "bond" ? "债券" : target === "equity" ? "股权" : "衍生"}`);
      saveGame();
      render();
    };

    financeAssetBondBtn.addEventListener("click", () => rebalanceAssets("bond"));
    financeAssetEquityBtn.addEventListener("click", () => rebalanceAssets("equity"));
    financeAssetDerivativeBtn.addEventListener("click", () => rebalanceAssets("derivative"));

    financeHedgeBtn.addEventListener("click", () => {
      if (state.lifetimeGears < FINANCE_UNLOCK_LIFETIME_GEARS) return;
      const nowMs = Date.now();
      if (isHedgeActive(nowMs)) return;
      const hedgeCost = Math.max(1, Math.floor(state.financeCapital * FINANCE_HEDGE_COST_RATIO));
      if (state.financeCapital < hedgeCost) return;
      state.financeCapital -= hedgeCost;
      state.financeHedgeUntil = nowMs + FINANCE_HEDGE_DURATION_MS;
      pushLog(`[Finance/对冲] 支付 ${format(hedgeCost)} 资金，12s 降波动`);
      triggerTypedPanelPulse("order", document.getElementById("financePanel"));
      audioSystem.playSfx("order");
      saveGame();
      render();
    });

    financeInvestBtn.addEventListener("click", () => {
      if (state.lifetimeGears < FINANCE_UNLOCK_LIFETIME_GEARS) return;
      const invest = Math.floor(state.gears * 0.1);
      if (invest < 100) return;
      state.gears -= invest;
      state.financeCapital += invest;
      triggerButtonPop(financeInvestBtn);
      triggerTypedPanelPulse("order", document.getElementById("financePanel"));
      spawnFloatingGain(financeInvestBtn, `-${format(invest)} 齿轮`, "gear");
      state.financeLastInvestAt = Date.now();
      pushLog(`[Finance/投入] ${format(invest)} 齿轮`);
      audioSystem.playSfx("click");
      saveGame();
      render();
    });

    financeWithdrawBtn.addEventListener("click", () => {
      if (state.lifetimeGears < FINANCE_UNLOCK_LIFETIME_GEARS) return;
      const withdraw = Math.floor(state.financeCapital * 0.25);
      if (withdraw <= 0) return;
      state.financeCapital -= withdraw;
      state.gears += withdraw;
      state.lifetimeGears += withdraw;
      triggerButtonPop(financeWithdrawBtn);
      spawnFloatingGain(financeWithdrawBtn, `+${format(withdraw)} 齿轮`, "gear");
      state.financeLastWithdrawAt = Date.now();
      pushLog(`[Finance/提取] ${format(withdraw)} 齿轮`);
      audioSystem.playSfx("reward");
      saveGame();
      render();
    });

    financeUpgradeBtn.addEventListener("click", () => {
      if (state.lifetimeGears < FINANCE_UNLOCK_LIFETIME_GEARS) return;
      const creditDiscount = Math.min(0.35, getFinanceCreditLevel() * 0.04);
      const cost = Math.max(1, Math.ceil((1 + state.financeTier) * (1 - creditDiscount)));
      if (state.financeTier >= 8 || state.researchPoints < cost) return;
      state.researchPoints -= cost;
      state.financeTier += 1;
      triggerEventHighlight("order", `风控升级 Lv.${state.financeTier}`);
      triggerTypedPanelPulse("order", document.getElementById("financePanel"));
      pushLog(`[Finance/升级] 风控 Lv.${state.financeTier}`);
      audioSystem.playSfx("order");
      saveGame();
      render();
    });

    prestigeBtn.addEventListener("click", () => {
      const gain = getPrestigeGain(state.lifetimeGears);
      if (gain <= 0) {
        window.alert("累计齿轮不足，无法获得研究点。继续扩张产线吧！");
        return;
      }
      const ok = window.confirm(`执行软重置可获得 ${gain} 研究点（RP），是否继续？`);
      if (!ok) return;

      state.researchPoints += gain;
      const retainedMeta = Math.max(1, Math.floor(state.financeTier / 2) + Math.floor(getFinanceCreditLevel() / 2));
      state.financeMetaPoints += retainedMeta;
      state.financeCreditBase = Math.max(0, Math.floor(getFinanceCreditLevel() * 0.5));
      state.financeLineage += Math.max(1, Math.floor(getFinanceCreditLevel() / 2));
      emitFeedback(FEEDBACK_EVENTS.PRESTIGE, { gain });
      pushLog(`执行 Prestige，获得 RP +${gain}（保留金融元进度 +${retainedMeta}，金融谱系 +${Math.max(1, Math.floor(getFinanceCreditLevel() / 2))}）`);
      resetRunState();
      saveGame();
      render();
    });

    resetSaveBtn.addEventListener("click", () => {
      const ok = window.confirm("确认重置所有进度吗？");
      if (!ok) return;
      localStorage.removeItem(SAVE_KEY);
      state.logs = ["[--:--:--] 执行硬重置"];
      resetRunState();
      state.researchPoints = 0;
      state.financeMetaPoints = 0;
      state.financeCreditBase = 0;
      state.prestigeBranches = { legacy_manual: 0, legacy_line: 0 };
      state.debugPanelOpen = false;
      state.debugManualMult = 1;
      state.debugGpsMult = 1;
      render();
    });

    for (const building of buildings) createBuildingRow(building);
    for (const upgrade of upgrades) createUpgradeRow(upgrade);
    for (const skill of skills) createSkillRow(skill);
    for (const spec of specializationUpgrades) createSpecializationRow(spec);
    for (const branch of PRESTIGE_BRANCHES) createPrestigeBranchRow(branch);
    for (const achievement of achievements) createAchievementRow(achievement);

    loadGame();

    let lastAutoSave = performance.now();
    let lastSimTimestamp = performance.now();

    const stepSimulation = (deltaSeconds) => {
      const rawDelta = Math.max(0, deltaSeconds);
      const frameDelta = Math.min(rawDelta, MAX_ACCUMULATED_SECONDS);
      state.accumulator += frameDelta;

      const gps = getTotalGPS();
      const strategyAdjustedGps = getMainlineGpsWithFinanceStrategy(gps);
      if (rawDelta > MAX_ACCUMULATED_SECONDS) {
        const overflowSeconds = rawDelta - MAX_ACCUMULATED_SECONDS;
        const overflowGain = (strategyAdjustedGps + getFinanceIncomePerSecond(strategyAdjustedGps)) * overflowSeconds * state.gameSpeed;
        state.gears += overflowGain;
        state.lifetimeGears += overflowGain;
      }

      while (state.accumulator >= FIXED_STEP) {
        const gain = strategyAdjustedGps * FIXED_STEP * state.gameSpeed;
        const financeGain = getFinanceIncomePerSecond(strategyAdjustedGps) * FIXED_STEP * state.gameSpeed;
        state.gears += gain + financeGain;
        state.lifetimeGears += gain + financeGain;
        state.accumulator -= FIXED_STEP;

        if (state.comboTimer > 0) {
          state.comboTimer = Math.max(0, state.comboTimer - FIXED_STEP * state.gameSpeed);
          if (state.comboTimer === 0 && state.comboStreak > 0) {
            state.comboStreak = 0;
          }
        }

        if (state.financeAutoPilot) {
          state.financeAutoAccumulator += FIXED_STEP * state.gameSpeed;
          if (state.financeAutoAccumulator >= 2) {
            state.financeAutoAccumulator = 0;
            runFinanceAutopilotStep();
          }
        }

        if (state.autoBuy) {
          state.autoBuyAccumulator += FIXED_STEP * state.gameSpeed;
          if (state.autoBuyAccumulator >= 0.5) {
            state.autoBuyAccumulator = 0;
            tryAutoBuy();
          }
        }
      }

      normalizeRuntimeState();
    };

    const simulationTimer = setInterval(() => {
      const now = performance.now();
      const deltaSeconds = (now - lastSimTimestamp) / 1000;
      lastSimTimestamp = now;
      stepSimulation(deltaSeconds);
    }, 1000 / TICK_RATE);

    window.addEventListener("beforeunload", () => {
      clearInterval(simulationTimer);
    });

    const tick = (now) => {
      state.lastTimestamp = now;

      if (now - lastAutoSave > 5000) {
        saveGame();
        lastAutoSave = now;
      }

      render();
      requestAnimationFrame(tick);
    };

    render();
    requestAnimationFrame(tick);
  

}
