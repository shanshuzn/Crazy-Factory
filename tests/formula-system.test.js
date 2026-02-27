const test = require('node:test');
const assert = require('node:assert/strict');

const GameFormulas = require('../scripts/formula-system.js');

test('building price formula grows with owned and offset', () => {
  const p0 = GameFormulas.calcBuildingPrice({ basePrice: 15, owned: 0, growth: 1.15, discount: 1 });
  const p1 = GameFormulas.calcBuildingPrice({ basePrice: 15, owned: 1, growth: 1.15, discount: 1 });
  const p10off = GameFormulas.calcBuildingPrice({ basePrice: 15, owned: 0, growth: 1.15, discount: 1, offset: 10 });
  assert.equal(p0, 15);
  assert.ok(p1 > p0);
  assert.ok(p10off > p1);
});

test('purchase cost equals incremental price sum', () => {
  const total = GameFormulas.calcPurchaseCost({ basePrice: 100, owned: 3, growth: 1.15, discount: 0.92, count: 5 });
  let manual = 0;
  for (let i = 0; i < 5; i++) {
    manual += GameFormulas.calcBuildingPrice({ basePrice: 100, owned: 3, growth: 1.15, discount: 0.92, offset: i });
  }
  assert.equal(total, manual);
});

test('affordable count works for modes and max path', () => {
  const config = { basePrice: 50, owned: 0, growth: 1.15, discount: 1 };
  const one = GameFormulas.calcAffordableCount({ ...config, budget: 49, mode: '1' });
  const ten = GameFormulas.calcAffordableCount({ ...config, budget: 10000, mode: '10' });
  const max = GameFormulas.calcAffordableCount({ ...config, budget: 10000, mode: 'max' });
  assert.equal(one, 0);
  assert.equal(ten, 10);
  assert.ok(max >= 10);
});

test('prestige and offline formulas clamp safely', () => {
  const p = GameFormulas.calcPrestigeGain({ lifetimeGears: 8000, divisor: 2000 });
  assert.equal(p, 2);

  const offline = GameFormulas.calcOfflineGain({ gps: 10, elapsedSec: 1000, capSec: 100 });
  assert.equal(offline, 1000);

  const offlineNeg = GameFormulas.calcOfflineGain({ gps: 10, elapsedSec: -5, capSec: 100 });
  assert.equal(offlineNeg, 0);
});
