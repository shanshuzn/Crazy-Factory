#!/usr/bin/env node

const { getBuildingPrice, getIndustryChainMultiplier } = require('./economy_pure');

const BUILDINGS = [
  { id: 'intern', basePrice: 15, dps: 1 },
  { id: 'conveyor', basePrice: 100, dps: 8 },
  { id: 'assembler', basePrice: 1100, dps: 47 }
];

const state = { gears: 0, lifetime: 0, owned: { intern: 0, conveyor: 0, assembler: 0 } };
const logs = [];
let maxGps = 0;
let maxGears = 0;

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
    for (const b of [...BUILDINGS].reverse()) {
      const price = getPrice(b.id);
      if (state.gears >= price) {
        state.gears -= price;
        state.owned[b.id] += 1;
        bought = true;
      }
    }
  }
};

for (let sec = 1; sec <= 30 * 60; sec += 1) {
  const gps = getGps();
  const gain = gps + 1;
  state.gears += gain;
  state.lifetime += gain;
  autoBuy();

  if (!Number.isFinite(state.gears) || !Number.isFinite(state.lifetime)) {
    throw new Error(`non-finite state at sec=${sec}`);
  }

  maxGps = Math.max(maxGps, gps);
  maxGears = Math.max(maxGears, state.gears);

  if (sec % 300 === 0) {
    logs.push({
      sec,
      gears: Math.floor(state.gears),
      lifetime: Math.floor(state.lifetime),
      gps: Number(getGps().toFixed(2)),
      chain: Number(getIndustryChainMultiplier(state.owned.intern, state.owned.conveyor, state.owned.assembler).toFixed(2))
    });
  }
}

console.log('stability_30m');
console.log(JSON.stringify({
  peak: { maxGps: Number(maxGps.toFixed(2)), maxGears: Math.floor(maxGears) },
  end: {
    gears: Math.floor(state.gears),
    lifetime: Math.floor(state.lifetime),
    gps: Number(getGps().toFixed(2)),
    owned: state.owned
  },
  logs
}, null, 2));
