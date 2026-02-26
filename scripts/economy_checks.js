#!/usr/bin/env node

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const {
  ECONOMY_CONFIG,
  getEffectiveOwnedForPrice,
  getBuildingPrice,
  getPrestigeGain,
  getOfflineReward,
  getIndustryChainMultiplier
} = require('./economy_pure');

const COMBO_MAX_STREAK = 40;
const COMBO_BONUS_PER_STACK = 0.02;
const FX_MAX_FLOATING_GAINS = 18;
const FX_PRIORITY_SLOTS = 2;
const FINANCE_BASE_APR = 0.06;
const { OFFLINE_CAP_SECONDS, CHAIN_BONUS_PER_STAGE, CHAIN_MAX_STAGES } = ECONOMY_CONFIG;

const ORDER_TEMPLATES = [
  { key: 'clicks', minTier: 1, weight: 3 },
  { key: 'lifetime', minTier: 1, weight: 3 },
  { key: 'conveyor', minTier: 1, weight: 2 },
  { key: 'assembler', minTier: 2, weight: 1 },
  { key: 'intern', minTier: 3, weight: 2 },
  { key: 'rush_clicks', minTier: 2, weight: 2 },
  { key: 'hybrid_line', minTier: 3, weight: 2 },
  { key: 'all_in_prestige', minTier: 4, weight: 1 }
];

const getUnlockedTemplates = (tier) => ORDER_TEMPLATES.filter((t) => t.minTier <= tier);

const getResearchMultiplier = (rp) => 1 + rp * 0.1;

const getComboMultiplier = (streak) => 1 + Math.min(COMBO_MAX_STREAK, streak) * COMBO_BONUS_PER_STACK;
const getBuildingCostMultiplier = (costLevel) => Math.max(0.65, 1 - costLevel * 0.04);
const getBuildingOutputMultiplier = (outputLevel) => 1 + outputLevel * 0.2;
const shouldSpawnFloatingGain = (activeCount, priority = "normal") => {
  const hardCap = FX_MAX_FLOATING_GAINS + FX_PRIORITY_SLOTS;
  const normalCap = FX_MAX_FLOATING_GAINS;
  return priority === "high" ? activeCount < hardCap : activeCount < normalCap;
};

const getSafeAudioProfile = (profile, audioSafeMode) => ({
  f0: audioSafeMode ? Math.min(profile.f0, 700) : profile.f0,
  f1: audioSafeMode ? Math.min(profile.f1, 780) : profile.f1,
  t: audioSafeMode ? Math.min(profile.t, 0.07) : profile.t,
  osc: audioSafeMode ? "sine" : "triangle"
});


const getFinanceApr = (tier, totalClicks = 0) => {
  const cycleBoost = 0.03 * Math.sin(totalClicks / 45);
  return Math.max(0.01, FINANCE_BASE_APR + tier * 0.025 + cycleBoost);
};
const getFinanceIncomePerSecond = (capital, tier, totalClicks = 0) => capital * getFinanceApr(tier, totalClicks);

const migrateSaveData = (rawData) => {
  if (!rawData || typeof rawData !== 'object') return null;
  const data = { ...rawData };
  const version = Number(data.saveVersion) || 1;

  if (version < 2) {
    data.saveVersion = 2;
    if (data.activeOrder && typeof data.activeOrder === 'object') {
      const hasType = ['clicks', 'lifetime', 'building'].includes(data.activeOrder.type);
      const hasTarget = Number.isFinite(Number(data.activeOrder.target));
      if (!hasType || !hasTarget) data.activeOrder = null;
    }
  }

  if (!Number.isFinite(Number(data.saveVersion))) {
    data.saveVersion = 2;
  }
  return data;
};

const sanitizeImportPayload = (data) => {
  if (!data || typeof data !== 'object') return null;
  if (!Array.isArray(data.buildings) || !Array.isArray(data.upgrades)) return null;
  if (!Array.isArray(data.skills) || !Array.isArray(data.achievements)) return null;
  return data;
};

// price
assert(getBuildingPrice(15, 0) === 15, 'base price should be unchanged at owned=0');
assert(getBuildingPrice(15, 1) === 17, 'price growth step mismatch at owned=1');
assert(getBuildingPrice(100, 10, 0.9) > 0, 'discounted price should stay positive');
assert(getBuildingPrice(100, 120) < Math.floor(100 * Math.pow(ECONOMY_CONFIG.PRICE_GROWTH, 120)), 'mid-late curve should be softer than pure exponential');
assert(getBuildingPrice(100, 250) > getBuildingPrice(100, 120), 'price should remain monotonic even with softened curve');
assert(getBuildingPrice(100, 0, 0.8) < getBuildingPrice(100, 0, 1), 'discount multiplier should lower base price');

// multipliers
assert(getResearchMultiplier(0) === 1, 'rp 0 multiplier should be 1');
assert(getResearchMultiplier(5) === 1.5, 'rp 5 multiplier should be 1.5');
assert(getComboMultiplier(0) === 1, 'combo at 0 should not buff');
assert(getComboMultiplier(10) === 1.2, 'combo 10 should be +20%');
assert(getComboMultiplier(999) === 1 + COMBO_MAX_STREAK * COMBO_BONUS_PER_STACK, 'combo multiplier should clamp');
assert(getBuildingCostMultiplier(0) === 1, 'building cost multiplier base should be 1');
assert(getBuildingCostMultiplier(5) === 0.8, 'building cost multiplier level 5 should be 0.8');
assert(getBuildingCostMultiplier(999) === 0.65, 'building cost multiplier should clamp');
assert(getBuildingOutputMultiplier(3) === 1.6, 'building output multiplier level 3 should be 1.6');
assert(shouldSpawnFloatingGain(0) === true, 'floating gain should spawn when queue is empty');
assert(shouldSpawnFloatingGain(FX_MAX_FLOATING_GAINS) === false, 'normal floating gain should stop at cap');
assert(shouldSpawnFloatingGain(FX_MAX_FLOATING_GAINS, 'high') === true, 'high priority gain should use reserved slots');
assert(shouldSpawnFloatingGain(FX_MAX_FLOATING_GAINS + FX_PRIORITY_SLOTS, 'high') === false, 'high priority gain should respect hard cap');
const safeAudio = getSafeAudioProfile({ f0: 900, f1: 1200, t: 0.1 }, true);
assert(safeAudio.f1 <= 780, 'low-perf audio safe mode should clamp high frequency');
assert(safeAudio.osc === 'sine', 'low-perf audio safe mode should use sine oscillator');



// industrial chain
assert(getIndustryChainMultiplier(0, 0, 0) === 1, 'chain multiplier should start at 1');
assert(getIndustryChainMultiplier(40, 20, 10) > 1, 'balanced chain should provide bonus');
assert(getIndustryChainMultiplier(120, 0, 0) === 1, 'single-line stacking should not gain chain bonus');
assert(getIndustryChainMultiplier(200, 100, 50) <= 1 + CHAIN_MAX_STAGES * CHAIN_BONUS_PER_STAGE, 'chain bonus should respect cap');

// finance
assert(getFinanceApr(0, 0) >= 0.01, 'finance apr should have lower bound');
assert(getFinanceApr(5, 0) > getFinanceApr(0, 0), 'finance apr should grow with risk-control tier');
assert(getFinanceIncomePerSecond(1000, 2, 120) > 0, 'finance income should be positive when capital exists');
assert(getFinanceIncomePerSecond(0, 8, 9999) === 0, 'finance income should be zero with no capital');

// prestige
assert(getPrestigeGain(0) === 0, 'prestige gain at zero should be 0');
assert(getPrestigeGain(2000) === 1, 'prestige gain at 2000 should be 1');
assert(getPrestigeGain(2_000_000) > Math.floor(Math.sqrt(2_000_000 / 2000)), 'late prestige should include bonus gain');

// offline cap
const reward = getOfflineReward(10, OFFLINE_CAP_SECONDS + 600);
assert(reward === 10 * OFFLINE_CAP_SECONDS, 'offline reward must be capped at 8h');
assert(getOfflineReward(50, 0) === 0, 'offline reward should be zero for no elapsed time');

// migration
const migrated = migrateSaveData({ gears: 10, activeOrder: { type: 'unknown', target: 10 } });
assert(migrated.saveVersion === 2, 'saveVersion should migrate to 2');
assert(migrated.activeOrder === null, 'invalid order should be nulled during migration');
const migratedValidOrder = migrateSaveData({ saveVersion: 1, activeOrder: { type: 'clicks', target: 30 } });
assert(migratedValidOrder.activeOrder.type === 'clicks', 'valid legacy order should be preserved during migration');
assert(migrateSaveData(null) === null, 'null save should return null');
assert(migrateSaveData({ saveVersion: 'NaN', activeOrder: null }).saveVersion === 2, 'invalid saveVersion should fallback to 2');

// import sanitize
const payloadOk = sanitizeImportPayload({ buildings: [], upgrades: [], skills: [], achievements: [] });
assert(payloadOk !== null, 'sanitize should pass valid minimal payload');
assert(sanitizeImportPayload({ buildings: [], upgrades: [] }) === null, 'sanitize should reject payload missing skills/achievements');
assert(sanitizeImportPayload('bad') === null, 'sanitize should reject non-object payload');



// order template unlock
assert(getUnlockedTemplates(1).length === 3, 'tier1 should unlock 3 templates');
assert(getUnlockedTemplates(2).some((t) => t.key === 'rush_clicks'), 'tier2 should unlock rush clicks template');
assert(getUnlockedTemplates(3).some((t) => t.key === 'hybrid_line'), 'tier3 should unlock hybrid line template');
assert(getUnlockedTemplates(4).some((t) => t.key === 'all_in_prestige'), 'tier4 should unlock high-risk prestige template');
assert(getUnlockedTemplates(4).length === 8, 'tier4 should unlock all templates');
console.log('economy checks passed');
