const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// GPS 分解测试
// 验证 getGpsBreakdown 返回 12 项乘数分解且 productCheck 与 finalMult 一致

const root = path.join(__dirname, '..');

function makeSandbox() {
  const sandbox = {
    console, Math, Date, JSON, isFinite, Number, Object, Array, Map, Set, Promise,
    performance: { now: () => Date.now() },
  };
  vm.createContext(sandbox);
  return sandbox;
}

function loadCore(sandbox) {
  for (const s of ['game-data.js', 'formula-system.js', 'skill-system.js', 'economy-system.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'scripts', s), 'utf8'), sandbox, { filename: s });
  }
}

const CODE = `
(function () {
  const out = { steps: [] };
  const st = { scenarioParams: null, marketIsBull: true, gpsMultiplier: 1.0, researchPoints: 0 };
  const buildings = [
    { id: 'b1', basePrice: 100, dps: 10, owned: 3, maxOwned: 100 },
    { id: 'b2', basePrice: 500, dps: 40, owned: 1, maxOwned: 50 },
  ];
  const economy = createEconomySystem({
    st,
    buildings,
    upgrades: [], skills: [], bldBoost: {},
    PRICE_GROWTH: PRICE_GROWTH,
    MARKET_BULL_BONUS: MARKET_BULL_BONUS,
    MARKET_BEAR_PENALTY: MARKET_BEAR_PENALTY,
    SKILL_MASTERY_BONUS: SKILL_MASTERY_BONUS,
    MACRO_PREFERRED_BONUS: MACRO_PREFERRED_BONUS,
    dirty: {}, buildingViewMap: new Map(), pushLog: () => {}, saveGame: () => {},
    fmt: (x) => String(x), sfxBuy: () => {}, sfxUpgrade: () => {}, applyUpgradeEffect: () => {},
  });

  const g = economy.getGpsBreakdown();
  out.steps.push(['returns 12 factors', Object.keys(g.factors).length === 12]);
  out.steps.push(['baseGPS positive', g.baseGPS > 0]);
  out.steps.push(['finalMult positive', g.finalMult > 0]);
  out.steps.push(['totalGPS = base*mult', Math.abs(g.totalGPS - g.baseGPS * g.finalMult) < 1e-9]);

  // productCheck 应该等于各乘数之积，且与 finalMult 一致（未启用任何修饰时）
  out.steps.push(['productCheck equals finalMult (default)', Math.abs(g.productCheck - g.finalMult) < 1e-6]);

  // marketIsBull=true 时 market 因子 = MARKET_BULL_BONUS * (1 + market_sense*0.1)，但 skills 为空 -> lv=0 -> = BULL_BONUS
  out.steps.push(['market factor = bullBonus', Math.abs(g.factors.market - MARKET_BULL_BONUS) < 1e-9]);

  // 切换熊市并失效缓存
  st.marketIsBull = false;
  economy.invalidateGPSMult();
  const g2 = economy.getGpsBreakdown();
  out.steps.push(['market factor = bearPenalty', Math.abs(g2.factors.market - MARKET_BEAR_PENALTY) < 1e-9]);
  out.steps.push(['productCheck still matches finalMult', Math.abs(g2.productCheck - g2.finalMult) < 1e-6]);

  // 场景覆盖 bullBonus
  st.marketIsBull = true;
  economy.setScenarioParams({ bullBonus: 2.0 });
  const g3 = economy.getGpsBreakdown();
  out.steps.push(['scenario overrides market factor', Math.abs(g3.factors.market - 2.0) < 1e-9]);
  out.steps.push(['productCheck matches with override', Math.abs(g3.productCheck - g3.finalMult) < 1e-6]);

  // 重置场景后回到默认
  economy.setScenarioParams(null);
  const g4 = economy.getGpsBreakdown();
  out.steps.push(['reset restores default market factor', Math.abs(g4.factors.market - MARKET_BULL_BONUS) < 1e-9]);

  return out;
})();
`;

test('getGpsBreakdown exposes 12 factors with consistent product', () => {
  const sandbox = makeSandbox();
  loadCore(sandbox);
  const result = vm.runInContext(CODE, sandbox);
  for (const [name, pass] of result.steps) {
    assert.ok(pass, `FAIL: ${name}`);
  }
});
