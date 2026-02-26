#!/usr/bin/env node

const { createOwnedState, getGps, getChain, autoBuyDescending, runSimulationSeconds } = require('./sim_common');

const state = { gears: 0, lifetime: 0, owned: createOwnedState() };
const logs = [];
let maxGps = 0;
let maxGears = 0;

runSimulationSeconds({
  seconds: 30 * 60,
  state,
  autoBuy: autoBuyDescending,
  onTick: (sec) => {
    if (!Number.isFinite(state.gears) || !Number.isFinite(state.lifetime)) {
      throw new Error(`non-finite state at sec=${sec}`);
    }

    const nowGps = getGps(state.owned);
    maxGps = Math.max(maxGps, nowGps);
    maxGears = Math.max(maxGears, state.gears);

    if (sec % 300 === 0) {
      logs.push({
        sec,
        gears: Math.floor(state.gears),
        lifetime: Math.floor(state.lifetime),
        gps: Number(nowGps.toFixed(2)),
        chain: Number(getChain(state.owned).toFixed(2))
      });
    }
  }
});

console.log('stability_30m');
console.log(JSON.stringify({
  peak: { maxGps: Number(maxGps.toFixed(2)), maxGears: Math.floor(maxGears) },
  end: {
    gears: Math.floor(state.gears),
    lifetime: Math.floor(state.lifetime),
    gps: Number(getGps(state.owned).toFixed(2)),
    owned: state.owned
  },
  logs
}, null, 2));
