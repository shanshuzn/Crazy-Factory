#!/usr/bin/env node

const { getBuildingPrice, getIndustryChainMultiplier } = require('./economy_pure');

const BUILDINGS = [
  { id: 'intern', basePrice: 15, dps: 1 },
  { id: 'conveyor', basePrice: 100, dps: 8 },
  { id: 'assembler', basePrice: 1100, dps: 47 }
];

const PROFILES = [
  { name: '均衡扩张', weights: { intern: 1.0, conveyor: 1.0, assembler: 1.0 } },
  { name: '前期物流优先', weights: { intern: 0.9, conveyor: 1.25, assembler: 0.9 } },
  { name: '高阶组装冲刺', weights: { intern: 0.85, conveyor: 1.0, assembler: 1.3 } }
];

const runOne = (profile) => {
  const state = { gears: 0, lifetime: 0, owned: { intern: 0, conveyor: 0, assembler: 0 } };
  const getPrice = (id) => {
    const b = BUILDINGS.find((x) => x.id === id);
    return getBuildingPrice(b.basePrice, state.owned[id], 1);
  };
  const getGps = () => {
    const base = BUILDINGS.reduce((sum, b) => sum + state.owned[b.id] * b.dps, 0);
    const chain = getIndustryChainMultiplier(state.owned.intern, state.owned.conveyor, state.owned.assembler);
    return base * chain;
  };
  const autoBuy = () => {
    let bought = true;
    while (bought) {
      bought = false;
      const ranked = BUILDINGS
        .map((b) => ({
          ...b,
          score: (b.dps / Math.max(1, getPrice(b.id))) * (profile.weights[b.id] || 1)
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
    const gain = getGps() + 1;
    state.gears += gain;
    state.lifetime += gain;
    autoBuy();
  }

  return {
    profile: profile.name,
    gears: Math.floor(state.gears),
    lifetime: Math.floor(state.lifetime),
    gps: Number(getGps().toFixed(2)),
    chain: Number(getIndustryChainMultiplier(state.owned.intern, state.owned.conveyor, state.owned.assembler).toFixed(2)),
    owned: state.owned
  };
};

const runs = PROFILES.map(runOne);
console.log('balance_runs_20m');
console.log(JSON.stringify(runs, null, 2));
