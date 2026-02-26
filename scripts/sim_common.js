#!/usr/bin/env node

const { getBuildingPrice, getIndustryChainMultiplier } = require('./economy_pure');

const BUILDINGS = Object.freeze([
  { id: 'intern', basePrice: 15, dps: 1 },
  { id: 'conveyor', basePrice: 100, dps: 8 },
  { id: 'assembler', basePrice: 1100, dps: 47 }
]);

const createOwnedState = () => ({ intern: 0, conveyor: 0, assembler: 0 });

const getBuildingById = (id) => {
  const building = BUILDINGS.find((x) => x.id === id);
  if (!building) throw new Error(`Unknown building id: ${id}`);
  return building;
};

const getPrice = (owned, id, ownedOffset = 0) => {
  const b = getBuildingById(id);
  return getBuildingPrice(b.basePrice, (owned[id] || 0) + ownedOffset, 1);
};

const getChain = (owned) => getIndustryChainMultiplier(owned.intern || 0, owned.conveyor || 0, owned.assembler || 0);

const getGps = (owned) => {
  const base = BUILDINGS.reduce((sum, b) => sum + (owned[b.id] || 0) * b.dps, 0);
  return base * getChain(owned);
};

const autoBuyDescending = (state) => {
  let bought = true;
  while (bought) {
    bought = false;
    for (const b of [...BUILDINGS].reverse()) {
      const price = getPrice(state.owned, b.id);
      if (state.gears >= price) {
        state.gears -= price;
        state.owned[b.id] += 1;
        bought = true;
      }
    }
  }
};

module.exports = {
  BUILDINGS,
  createOwnedState,
  getPrice,
  getChain,
  getGps,
  autoBuyDescending
};
