#!/usr/bin/env node

// 15 分钟基线仿真：用于记录“经济参数改动前后”的可对比快照。
// 设计为纯计算脚本（无 DOM / 无随机），便于 CI 或本地快速重复。

const PRICE_GROWTH = 1.15;
const PRICE_CURVE_MID_START = 40;
const PRICE_CURVE_LATE_START = 100;
const PRICE_CURVE_MID_FACTOR = 0.82;
const PRICE_CURVE_LATE_FACTOR = 0.68;
const CHAIN_BONUS_PER_STAGE = 0.08;
const CHAIN_MAX_STAGES = 10;

const BUILDINGS = [
  { id: 'intern', basePrice: 15, dps: 1 },
  { id: 'conveyor', basePrice: 100, dps: 8 },
  { id: 'assembler', basePrice: 1100, dps: 47 }
];

const SIM_SECONDS = 15 * 60;
const STEP = 1; // 1s 固定步长，和主游戏 fixed-step 思路保持一致

const state = {
  gears: 0,
  lifetimeGears: 0,
  owned: Object.fromEntries(BUILDINGS.map((b) => [b.id, 0])),
  timeline: []
};

const getEffectiveOwnedForPrice = (owned) => {
  if (owned <= PRICE_CURVE_MID_START) return owned;
  if (owned <= PRICE_CURVE_LATE_START) {
    return PRICE_CURVE_MID_START + (owned - PRICE_CURVE_MID_START) * PRICE_CURVE_MID_FACTOR;
  }
  const midSegment = (PRICE_CURVE_LATE_START - PRICE_CURVE_MID_START) * PRICE_CURVE_MID_FACTOR;
  const lateSegment = (owned - PRICE_CURVE_LATE_START) * PRICE_CURVE_LATE_FACTOR;
  return PRICE_CURVE_MID_START + midSegment + lateSegment;
};

const getPrice = (buildingId, ownedOffset = 0) => {
  const b = BUILDINGS.find((it) => it.id === buildingId);
  const effectiveOwned = getEffectiveOwnedForPrice(state.owned[buildingId] + ownedOffset);
  return Math.floor(b.basePrice * Math.pow(PRICE_GROWTH, effectiveOwned));
};

const getIndustryChainMultiplier = () => {
  const internOwned = state.owned.intern || 0;
  const conveyorOwned = state.owned.conveyor || 0;
  const assemblerOwned = state.owned.assembler || 0;
  const chainStage = Math.min(internOwned / 20, conveyorOwned / 10, assemblerOwned / 5);
  const clampedStage = Math.max(0, Math.min(CHAIN_MAX_STAGES, chainStage));
  const imbalance = Math.max(0, (Math.max(internOwned, conveyorOwned, assemblerOwned) - Math.min(internOwned, conveyorOwned, assemblerOwned)) / 120);
  return Math.max(1, 1 + clampedStage * CHAIN_BONUS_PER_STAGE - imbalance * 0.06);
};

const getGps = () => BUILDINGS.reduce((sum, b) => sum + state.owned[b.id] * b.dps, 0) * getIndustryChainMultiplier();

const tryAutoBuy = () => {
  // 贪心：优先买“单位价格产出比”更高的建筑，得到一个稳定可复现的 baseline。
  const ranked = BUILDINGS
    .map((b) => ({ b, price: getPrice(b.id), ratio: b.dps / Math.max(1, getPrice(b.id)) }))
    .sort((a, z) => z.ratio - a.ratio);

  let purchased = true;
  while (purchased) {
    purchased = false;
    for (const row of ranked) {
      const price = getPrice(row.b.id);
      if (state.gears >= price) {
        state.gears -= price;
        state.owned[row.b.id] += 1;
        purchased = true;
      }
    }
  }
};

for (let t = 1; t <= SIM_SECONDS; t += STEP) {
  const gps = getGps();
  const gain = gps * STEP + 1; // baseline 假设：玩家每秒约 1 次手动点击
  state.gears += gain;
  state.lifetimeGears += gain;
  tryAutoBuy();

  if (t % 180 === 0 || t === SIM_SECONDS) {
    state.timeline.push({
      atSec: t,
      gears: Math.floor(state.gears),
      lifetimeGears: Math.floor(state.lifetimeGears),
      gps: Number(getGps().toFixed(2)),
      owned: { ...state.owned }
    });
  }
}

console.log('baseline_15m snapshot');
console.log(JSON.stringify({
  simSeconds: SIM_SECONDS,
  stepSeconds: STEP,
  end: {
    gears: Math.floor(state.gears),
    lifetimeGears: Math.floor(state.lifetimeGears),
    gps: Number(getGps().toFixed(2)),
    owned: state.owned
  },
  timeline: state.timeline
}, null, 2));
