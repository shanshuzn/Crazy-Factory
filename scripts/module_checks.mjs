import assert from 'node:assert/strict';
import { getCurrentPrice, getEffectiveOwnedForPrice, getPrestigeGain } from '../src/systems/economySystem.js';
import { createOrderFromTemplate, getOrderProgress, pickWeightedOrderTemplate } from '../src/systems/taskSystem.js';
import { createInitialState } from '../src/core/state.js';
import { createFeedbackBus } from '../src/fx/feedbackBus.js';

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
runTaskChecks();
runCoreChecks();

console.log('module checks passed');
