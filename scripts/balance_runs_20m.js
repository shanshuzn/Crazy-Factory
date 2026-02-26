#!/usr/bin/env node

const { getBuildingPrice, getIndustryChainMultiplier } = require('./economy_pure');

const BUILDINGS = [
  { id: 'intern', basePrice: 15, dps: 1 },
  { id: 'conveyor', basePrice: 100, dps: 8 },
  { id: 'assembler', basePrice: 1100, dps: 47 }
];

const FINANCE_PROFILES = [
  { name: '金融稳健', mode: 'conservative', financeAprMult: 0.9, mainlineMult: 1.08, investRatio: 0.08 },
  { name: '金融平衡', mode: 'balanced', financeAprMult: 1.0, mainlineMult: 1.0, investRatio: 0.1 },
  { name: '金融激进', mode: 'aggressive', financeAprMult: 1.22, mainlineMult: 0.92, investRatio: 0.12 }
];

const FINANCE_BASE_APR = 0.045;
const FINANCE_TIER_APR_BONUS = 0.018;
const FINANCE_CYCLE_AMPLITUDE = 0.02;
const FINANCE_MAX_SHARE_OF_MAINLINE = 0.3;
const FINANCE_MIN_CAP_GPS = 2;

const marketTimeline = ['stable', 'overheat', 'pullback', 'panic'];
const marketMods = {
  stable: { aprDelta: 0, cycleScale: 0.8 },
  overheat: { aprDelta: 0.018, cycleScale: 1.15 },
  pullback: { aprDelta: -0.012, cycleScale: 0.95 },
  panic: { aprDelta: -0.022, cycleScale: 0.7 }
};

const quantile = (arr, q) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
};

const runOne = (profile) => {
  const state = {
    gears: 0,
    lifetime: 0,
    totalClicks: 0,
    financeCapital: 0,
    financeTier: 0,
    owned: { intern: 0, conveyor: 0, assembler: 0 },
    financeSamples: []
  };

  const getPrice = (id) => {
    const b = BUILDINGS.find((x) => x.id === id);
    return getBuildingPrice(b.basePrice, state.owned[id], 1);
  };
  const getBaseGps = () => {
    const base = BUILDINGS.reduce((sum, b) => sum + state.owned[b.id] * b.dps, 0);
    const chain = getIndustryChainMultiplier(state.owned.intern, state.owned.conveyor, state.owned.assembler);
    return (base * chain + 1) * profile.mainlineMult;
  };
  const autoBuy = () => {
    let bought = true;
    while (bought) {
      bought = false;
      const ranked = BUILDINGS
        .map((b) => ({
          ...b,
          score: b.dps / Math.max(1, getPrice(b.id))
        }))
        .sort((a, b) => b.score - a.score);
      for (const b of ranked) {
        const price = getPrice(b.id);
        if (state.gears >= price) {
          state.gears -= price;
          state.owned[b.id] += 1;
          bought = true;
        }
      }
    }
  };

  for (let t = 0; t < 20 * 60; t += 1) {
    state.totalClicks += 1;
    const marketKey = marketTimeline[Math.floor(state.totalClicks / 75) % marketTimeline.length];
    const market = marketMods[marketKey];

    if (state.lifetime >= 1200) {
      if (t % 12 === 0 && state.financeTier < 4) state.financeTier += 1;
      if (t % 20 === 0) {
        const invest = Math.floor(state.gears * profile.investRatio);
        if (invest >= 100) {
          state.gears -= invest;
          state.financeCapital += invest;
        }
      }
      if (marketKey === 'panic' && state.financeCapital > 0 && t % 30 === 0) {
        state.financeCapital -= Math.max(1, Math.floor(state.financeCapital * 0.06));
      }
    }

    const baseGps = getBaseGps();
    const cycle = FINANCE_CYCLE_AMPLITUDE * Math.sin(state.totalClicks / 45) * market.cycleScale;
    const apr = Math.max(0.01, FINANCE_BASE_APR + state.financeTier * FINANCE_TIER_APR_BONUS + market.aprDelta + cycle) * profile.financeAprMult;
    const financeRaw = state.financeCapital * apr;
    const financeCap = Math.max(FINANCE_MIN_CAP_GPS, baseGps * FINANCE_MAX_SHARE_OF_MAINLINE);
    const financeGain = Math.min(financeRaw, financeCap);

    state.financeSamples.push(financeGain);

    const gain = baseGps + financeGain;
    state.gears += gain;
    state.lifetime += gain;
    autoBuy();
  }

  return {
    profile: profile.name,
    mode: profile.mode,
    gears: Math.floor(state.gears),
    lifetime: Math.floor(state.lifetime),
    gps: Number(getBaseGps().toFixed(2)),
    financeP50: Number(quantile(state.financeSamples, 0.5).toFixed(2)),
    financeP90: Number(quantile(state.financeSamples, 0.9).toFixed(2)),
    chain: Number(getIndustryChainMultiplier(state.owned.intern, state.owned.conveyor, state.owned.assembler).toFixed(2)),
    owned: state.owned
  };
};

const runs = FINANCE_PROFILES.map(runOne);
console.log('balance_runs_20m_finance_profiles');
console.log(JSON.stringify(runs, null, 2));
