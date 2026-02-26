import assert from 'node:assert/strict';
import { getCurrentPrice, getEffectiveOwnedForPrice, getPrestigeGain } from '../src/systems/economySystem.js';
import { createOrderFromTemplate, getOrderProgress, pickWeightedOrderTemplate } from '../src/systems/taskSystem.js';
import { createSfxGate } from '../src/systems/audioSystem.js';
import { createInitialState } from '../src/core/state.js';
import { createFeedbackBus } from '../src/fx/feedbackBus.js';
import { migrateSaveData } from '../src/core/saveMigrations.js';
import { attachGameFeelHandlers } from '../src/fx/gameFeelSystem.js';
import { FEEDBACK_EVENTS } from '../src/fx/events.js';

function runEconomyChecks() {
  const curve = { midStart: 40, lateStart: 100, midFactor: 0.82, lateFactor: 0.68 };
  assert.equal(getEffectiveOwnedForPrice(20, curve), 20);
  assert.equal(getEffectiveOwnedForPrice(60, curve), 56.4);
  assert.ok(Math.abs(getEffectiveOwnedForPrice(120, curve) - 102.8) < 1e-9);

  const p0 = getCurrentPrice({
    basePrice: 100,
    owned: 10,
    growth: 1.15,
    discountMultiplier: 1,
    curve
  });
  const p1 = getCurrentPrice({
    basePrice: 100,
    owned: 11,
    growth: 1.15,
    discountMultiplier: 1,
    curve
  });
  assert.ok(p1 > p0);

  assert.equal(getPrestigeGain(1000, { baseDivisor: 2000, lateBonusStart: 2_000_000, lateBonusStep: 2_000_000 }), 0);
  assert.equal(getPrestigeGain(2_000_000, { baseDivisor: 2000, lateBonusStart: 2_000_000, lateBonusStep: 2_000_000 }), 32);
}


function runAudioGateChecks() {
  const gate = createSfxGate();
  assert.equal(gate.canPlay('click', 1000, false), true);
  assert.equal(gate.canPlay('click', 1010, false), false);
  assert.equal(gate.canPlay('click', 1030, false), true);

  assert.equal(gate.canPlay('reward', 2000, true), true);
  assert.equal(gate.canPlay('reward', 2070, true), false);
  assert.equal(gate.canPlay('reward', 2130, true), true);
}

function runTaskChecks() {
  const templates = [
    { key: 'a', weight: 1, preferredMarket: 'stable' },
    { key: 'b', weight: 2, preferredMarket: 'panic' }
  ];
  const selected = pickWeightedOrderTemplate(templates, 'stable', () => 0);
  assert.equal(selected.key, 'a');

  const order = createOrderFromTemplate({
    template: { key: 'click', type: 'clicks', title: 't', desc: 'd' },
    tier: 2,
    timestamp: 123,
    rewardScale: 1,
    targetScale: 1,
    runtimeSnapshot: { totalClicks: 10, lifetimeGears: 0, buildingOwnedById: {} }
  });
  assert.equal(order.type, 'clicks');
  assert.equal(order.startValue, 10);

  const progress = getOrderProgress(order, { totalClicks: 25, lifetimeGears: 0, buildingOwnedById: {} });
  assert.equal(progress, 15);
}


function runMigrationChecks() {
  const v1 = migrateSaveData({ saveVersion: 1, activeOrder: { type: 'oops', target: 'x' } }, 4);
  assert.equal(v1.saveVersion, 4);
  assert.equal(v1.activeOrder, null);

  const v2 = migrateSaveData({ saveVersion: 2 }, 4);
  assert.deepEqual(v2.prestigeBranches, { legacy_manual: 0, legacy_line: 0 });

  const v3 = migrateSaveData({ saveVersion: 3, financeAssets: null }, 4);
  assert.equal(v3.saveVersion, 4);
  assert.equal(typeof v3.financeAssets, 'object');
}


function runGameFeelChecks() {
  const feedbackBus = createFeedbackBus();
  const calls = [];

  const mk = (name) => (...args) => calls.push([name, ...args]);
  const manualBtn = { id: 'manual' };
  const gamePanelEl = { id: 'game' };
  const orderPanelEl = { id: 'order' };

  attachGameFeelHandlers({
    feedbackBus,
    manualBtn,
    gamePanelEl,
    orderPanelEl,
    format: (n) => String(n),
    triggerButtonPop: mk('btnPop'),
    spawnFloatingGain: mk('float'),
    triggerPanelPulse: mk('panelPulse'),
    triggerEventHighlight: mk('highlight'),
    triggerScreenShake: mk('shake'),
    playSfx: mk('sfx')
  });

  feedbackBus.emit(FEEDBACK_EVENTS.MANUAL_CLICK, { gain: 12 });
  feedbackBus.emit(FEEDBACK_EVENTS.BIG_REWARD, { text: '+1 RP', kind: 'rp', priority: 'high', anchorEl: gamePanelEl });
  feedbackBus.emit(FEEDBACK_EVENTS.TASK_COMPLETE, { title: '任务A' });
  feedbackBus.emit(FEEDBACK_EVENTS.ORDER_COMPLETE, { title: '订单B' });
  feedbackBus.emit(FEEDBACK_EVENTS.PRESTIGE, { gain: 3 });

  assert.ok(calls.some((c) => c[0] === 'btnPop'));
  assert.ok(calls.some((c) => c[0] === 'float' && String(c[2]).includes('12')));
  assert.ok(calls.some((c) => c[0] === 'highlight' && String(c[2]).includes('任务完成')));
  assert.ok(calls.some((c) => c[0] === 'highlight' && String(c[2]).includes('订单达成')));
  assert.ok(calls.some((c) => c[0] === 'highlight' && String(c[2]).includes('Prestige +3')));
}

function runCoreChecks() {
  const state = createInitialState({
    audioEnabledDefault: true,
    defaultFinanceAssets: { bond: 0.34, equity: 0.33, derivative: 0.33 }
  });
  assert.equal(state.gears, 0);
  assert.equal(state.audioEnabled, true);
  assert.equal(state.financeAssets.bond, 0.34);

  const bus = createFeedbackBus();
  let called = 0;
  const off = bus.on('evt', (p) => { called += p; });
  bus.emit('evt', 2);
  off();
  bus.emit('evt', 2);
  assert.equal(called, 2);
}

runEconomyChecks();
runAudioGateChecks();
runTaskChecks();
runMigrationChecks();
runGameFeelChecks();
runCoreChecks();

console.log('module checks passed');
