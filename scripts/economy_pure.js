#!/usr/bin/env node

const ECONOMY_CONFIG = Object.freeze({
  PRICE_GROWTH: 1.15,
  PRICE_CURVE_MID_START: 40,
  PRICE_CURVE_LATE_START: 100,
  PRICE_CURVE_MID_FACTOR: 0.82,
  PRICE_CURVE_LATE_FACTOR: 0.68,
  PRESTIGE_BASE_DIVISOR: 2000,
  PRESTIGE_LATE_BONUS_START: 2_000_000,
  PRESTIGE_LATE_BONUS_STEP: 2_000_000,
  OFFLINE_CAP_SECONDS: 8 * 60 * 60,
  CHAIN_BONUS_PER_STAGE: 0.08,
  CHAIN_MAX_STAGES: 10
});

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const getEffectiveOwnedForPrice = (owned, cfg = ECONOMY_CONFIG) => {
  if (owned <= cfg.PRICE_CURVE_MID_START) return owned;
  if (owned <= cfg.PRICE_CURVE_LATE_START) {
    return cfg.PRICE_CURVE_MID_START + (owned - cfg.PRICE_CURVE_MID_START) * cfg.PRICE_CURVE_MID_FACTOR;
  }
  const midSegment = (cfg.PRICE_CURVE_LATE_START - cfg.PRICE_CURVE_MID_START) * cfg.PRICE_CURVE_MID_FACTOR;
  const lateSegment = (owned - cfg.PRICE_CURVE_LATE_START) * cfg.PRICE_CURVE_LATE_FACTOR;
  return cfg.PRICE_CURVE_MID_START + midSegment + lateSegment;
};

const getBuildingPrice = (basePrice, owned, discountMultiplier = 1, cfg = ECONOMY_CONFIG) => {
  const effectiveOwned = getEffectiveOwnedForPrice(owned, cfg);
  return Math.floor(basePrice * Math.pow(cfg.PRICE_GROWTH, effectiveOwned) * discountMultiplier);
};

const getPrestigeGain = (lifetimeGears, cfg = ECONOMY_CONFIG) => {
  const base = Math.floor(Math.sqrt(lifetimeGears / cfg.PRESTIGE_BASE_DIVISOR));
  if (lifetimeGears < cfg.PRESTIGE_LATE_BONUS_START) return base;
  const lateBonus = Math.floor((lifetimeGears - cfg.PRESTIGE_LATE_BONUS_START) / cfg.PRESTIGE_LATE_BONUS_STEP) + 1;
  return base + lateBonus;
};

const getOfflineReward = (gps, elapsedSeconds, cfg = ECONOMY_CONFIG) => {
  const sec = clamp(elapsedSeconds, 0, cfg.OFFLINE_CAP_SECONDS);
  return gps * sec;
};

const getIndustryChainMultiplier = (internOwned, conveyorOwned, assemblerOwned, cfg = ECONOMY_CONFIG) => {
  const chainStage = Math.min(internOwned / 20, conveyorOwned / 10, assemblerOwned / 5);
  const clampedStage = clamp(chainStage, 0, cfg.CHAIN_MAX_STAGES);
  const imbalance = Math.max(0, (Math.max(internOwned, conveyorOwned, assemblerOwned) - Math.min(internOwned, conveyorOwned, assemblerOwned)) / 120);
  const synergy = 1 + clampedStage * cfg.CHAIN_BONUS_PER_STAGE;
  return Math.max(1, synergy - imbalance * 0.06);
};

module.exports = {
  ECONOMY_CONFIG,
  getEffectiveOwnedForPrice,
  getBuildingPrice,
  getPrestigeGain,
  getOfflineReward,
  getIndustryChainMultiplier
};
