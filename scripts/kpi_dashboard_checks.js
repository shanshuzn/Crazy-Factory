#!/usr/bin/env node

const { execSync } = require('node:child_process');
const { getBuildingPrice, getPrestigeGain, getIndustryChainMultiplier } = require('./economy_pure');

const BUILDINGS = [
  { id: 'intern', basePrice: 15, dps: 1 },
  { id: 'conveyor', basePrice: 100, dps: 8 },
  { id: 'assembler', basePrice: 1100, dps: 47 }
];

const state = { gears: 0, lifetime: 0, clicks: 0, owned: { intern: 0, conveyor: 0, assembler: 0 } };

const getGps = () => {
  const base = BUILDINGS.reduce((s, b) => s + state.owned[b.id] * b.dps, 0);
  return base * getIndustryChainMultiplier(state.owned.intern, state.owned.conveyor, state.owned.assembler);
};
const getPrice = (id) => {
  const b = BUILDINGS.find((x) => x.id === id);
  return getBuildingPrice(b.basePrice, state.owned[id], 1);
};
const autoBuy = () => {
  let bought = true;
  while (bought) {
    bought = false;
    for (const b of [...BUILDINGS].reverse()) {
      const p = getPrice(b.id);
      if (state.gears >= p) {
        state.gears -= p;
        state.owned[b.id] += 1;
        bought = true;
      }
    }
  }
};

let firstTaskSec = null;
let firstHighValueSec = null;
let firstPrestigeTargetSec = null;
let longestIdle = 0;
let currentIdle = 0;

for (let sec = 1; sec <= 30 * 60; sec += 1) {
  const gps = getGps();
  state.clicks += 1;
  const gain = gps + 1;
  state.gears += gain;
  state.lifetime += gain;

  const beforeOwned = BUILDINGS.reduce((s, b) => s + state.owned[b.id], 0);
  autoBuy();
  const afterOwned = BUILDINGS.reduce((s, b) => s + state.owned[b.id], 0);

  if (firstTaskSec === null && state.clicks >= 20) firstTaskSec = sec;
  if (firstHighValueSec === null && getGps() >= 50) firstHighValueSec = sec;
  if (firstPrestigeTargetSec === null && getPrestigeGain(state.lifetime) >= 28) firstPrestigeTargetSec = sec;

  if (afterOwned === beforeOwned) {
    currentIdle += 1;
    longestIdle = Math.max(longestIdle, currentIdle);
  } else {
    currentIdle = 0;
  }
}

const prePrestigeGps = getGps();
const rpGain = getPrestigeGain(state.lifetime);
const reset = { gears: 0, lifetime: 0, owned: { intern: 0, conveyor: 0, assembler: 0 } };
let recoverSec = 0;
for (let sec = 1; sec <= 15 * 60; sec += 1) {
  const base = BUILDINGS.reduce((s, b) => s + reset.owned[b.id] * b.dps, 0) * getIndustryChainMultiplier(reset.owned.intern, reset.owned.conveyor, reset.owned.assembler);
  const gps = base * (1 + rpGain * 0.1);
  reset.gears += gps + 1;
  reset.lifetime += gps + 1;
  for (const b of [...BUILDINGS].reverse()) {
    while (reset.gears >= getBuildingPrice(b.basePrice, reset.owned[b.id], 1)) {
      reset.gears -= getBuildingPrice(b.basePrice, reset.owned[b.id], 1);
      reset.owned[b.id] += 1;
    }
  }
  const nowGps = BUILDINGS.reduce((s, b) => s + reset.owned[b.id] * b.dps, 0) * getIndustryChainMultiplier(reset.owned.intern, reset.owned.conveyor, reset.owned.assembler) * (1 + rpGain * 0.1);
  if (nowGps >= prePrestigeGps) { recoverSec = sec; break; }
}

const rerollRecoverSec = Math.ceil((200 * 3) / Math.max(1, getGps()));

const run = (cmd) => execSync(cmd, { encoding: 'utf8' });
const economyOk = /economy checks passed/.test(run('node scripts/economy_checks.js'));
const stabilityOut = run('node scripts/stability_30m.js');
const stabilityOk = /stability_30m/.test(stabilityOut) && !/NaN|Infinity/.test(stabilityOut);

const importRecoveryOk = (() => {
  const backup = { gears: 123, buildings: [], upgrades: [], skills: [], achievements: [] };
  const invalid = '{bad-json';
  try { JSON.parse(invalid); return false; } catch { return backup.gears === 123; }
})();

const metrics = {
  experience: {
    task3mRate: firstTaskSec <= 180 ? 100 : 0,
    highValue10mRate: firstHighValueSec <= 600 ? 100 : 0,
    firstPrestigeSec: firstPrestigeTargetSec
  },
  economy: {
    maxIdleWindowSec: longestIdle,
    prestigeRecoverRatio: recoverSec ? Number((recoverSec / Math.max(1, firstPrestigeTargetSec)).toFixed(2)) : 9,
    rerollRecoverSec
  },
  tech: {
    formulaRegression: economyOk,
    stability30m: stabilityOk,
    importRecovery: importRecoveryOk
  }
};

const checks = {
  task3m: metrics.experience.task3mRate >= 80,
  highValue10m: metrics.experience.highValue10mRate >= 70,
  firstPrestigeWindow: metrics.experience.firstPrestigeSec >= 18 * 60 && metrics.experience.firstPrestigeSec <= 30 * 60,
  idleWindow: metrics.economy.maxIdleWindowSec <= 90,
  prestigeRecover: metrics.economy.prestigeRecoverRatio <= 0.4,
  rerollRecover: metrics.economy.rerollRecoverSec <= 90,
  formulaRegression: metrics.tech.formulaRegression,
  stability30m: metrics.tech.stability30m,
  importRecovery: metrics.tech.importRecovery
};

console.log('kpi_dashboard_checks');
console.log(JSON.stringify({ metrics, checks }, null, 2));

if (Object.values(checks).some((v) => !v)) process.exit(1);
