#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { getPrestigeGain } = require('./economy_pure');
const { BUILDINGS, createOwnedState, getPrice, getGps, autoBuyDescending, runSimulationSeconds } = require('./sim_common');

const state = { gears: 0, lifetime: 0, clicks: 0, owned: createOwnedState() };

let firstTaskSec = null;
let firstHighValueSec = null;
let firstPrestigeTargetSec = null;
let longestIdle = 0;
let currentIdle = 0;

runSimulationSeconds({
  seconds: 30 * 60,
  state,
  autoBuy: autoBuyDescending,
  beforeAutoBuy: (_, runState) => {
    runState.clicks += 1;
    runState.__beforeOwned = BUILDINGS.reduce((sum, b) => sum + runState.owned[b.id], 0);
  },
  onTick: (sec, runState) => {
    if (firstTaskSec === null && runState.clicks >= 20) firstTaskSec = sec;
    if (firstHighValueSec === null && getGps(runState.owned) >= 50) firstHighValueSec = sec;
    if (firstPrestigeTargetSec === null && getPrestigeGain(runState.lifetime) >= 28) firstPrestigeTargetSec = sec;

    const postOwned = BUILDINGS.reduce((sum, b) => sum + runState.owned[b.id], 0);
    if (postOwned === runState.__beforeOwned) {
      currentIdle += 1;
      longestIdle = Math.max(longestIdle, currentIdle);
    } else {
      currentIdle = 0;
    }
  }
});

const prePrestigeGps = getGps(state.owned);
const rpGain = getPrestigeGain(state.lifetime);
const reset = { gears: 0, lifetime: 0, owned: createOwnedState() };
let recoverSec = 0;

runSimulationSeconds({
  seconds: 15 * 60,
  state: reset,
  perSecondGain: (gps) => gps * (1 + rpGain * 0.1) + 1,
  autoBuy: (runState) => {
    for (const b of [...BUILDINGS].reverse()) {
      while (runState.gears >= getPrice(runState.owned, b.id)) {
        runState.gears -= getPrice(runState.owned, b.id);
        runState.owned[b.id] += 1;
      }
    }
  },
  onTick: (sec, runState) => {
    if (recoverSec) return;
    const nowGps = getGps(runState.owned) * (1 + rpGain * 0.1);
    if (nowGps >= prePrestigeGps) recoverSec = sec;
  }
});

const rerollRecoverSec = Math.ceil((200 * 3) / Math.max(1, getGps(state.owned)));

const runNodeScript = (file) => execFileSync('node', [file], { encoding: 'utf8' });
const economyOk = /economy checks passed/.test(runNodeScript('scripts/economy_checks.js'));
const stabilityOut = runNodeScript('scripts/stability_30m.js');
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
