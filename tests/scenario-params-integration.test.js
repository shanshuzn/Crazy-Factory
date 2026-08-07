const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 场景参数集成测试
// 验证：场景应用 → 经济价格增长变化 → 市场周期参数变化
// 以及存档恢复后场景参数重新应用

const root = path.join(__dirname, '..');

// ── 构建浏览器模拟环境 ──
function makeSandbox() {
  const localStorageData = {};
  const sandbox = {
    console,
    Math,
    Date,
    JSON,
    isFinite,
    Number,
    Object,
    Array,
    Map,
    Set,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: { now: () => Date.now() },
    requestIdleCallback: () => {},
    localStorage: {
      getItem: (k) => localStorageData[k] || null,
      setItem: (k, v) => { localStorageData[k] = v; },
      removeItem: (k) => { delete localStorageData[k]; },
    },
    WebSocket: class { constructor() { this.readyState = 3; } close() {} },
  };
  sandbox.window = sandbox;
  sandbox.window.__timerManager = { schedule: () => {}, cancel: () => {}, getTasks: () => [] };
  sandbox.window.location = { search: '', reload: () => {} };
  sandbox.window.scheduler = undefined;
  sandbox.document = {
    getElementById: () => null,
    querySelector: () => null,
    createElement: () => ({ style: {}, appendChild: () => {}, addEventListener: () => {} }),
    addEventListener: () => {},
    body: { appendChild: () => {}, addEventListener: () => {} },
    head: { appendChild: () => {} },
  };
  sandbox.URLSearchParams = class { constructor() {} get() { return null; } };
  sandbox.fetch = async () => ({ ok: true, json: async () => ({ version: 'v2.9.0' }) });
  sandbox.navigator = { clipboard: undefined };
  vm.createContext(sandbox);
  return sandbox;
}

function loadAll(sandbox) {
  const scripts = [
    'game-data.js', 'formula-system.js', 'log-system.js', 'skill-system.js',
    'economy-system.js', 'market-system.js', 'event-system.js', 'feedback-system.js',
    'save-system.js', 'loop-system.js', 'render-system.js', 'debug-system.js',
    'update-detection-system.js', 'tutorial-system.js', 'daily-quest-system.js',
    'analytics-system.js', 'leaderboard-system.js', 'invite-system.js', 'synergy-system.js',
    'derivatives-system.js', 'global-market-system.js', 'crisis-system.js',
    'asset-allocation-system.js', 'guild-system.js', 'boost-system.js', 'treasury-system.js',
    'subscription-system.js', 'i18n.js', 'game-bridge.js', 'timer-manager.js',
    'scenario-editor-system.js',
  ];
  for (const s of scripts) {
    vm.runInContext(fs.readFileSync(path.join(root, 'scripts', s), 'utf8'), sandbox, { filename: s });
  }
}

function runInSandbox(sandbox, code) {
  return vm.runInContext(code, sandbox);
}

// 核心验证逻辑（在沙箱内执行）
const INTEGRATION_CODE = `
(function () {
  const out = { steps: [] };

  // 1. 场景创建/导入导出
  const st = { scenarios: null };
  const scenSystem = createScenarioEditorSystem({
    st, eventBus: { emit: () => {}, on: () => {} }, pushLog: () => {},
    I18N: { getCurrentLang: () => 'zh' }, buildings: [],
  });
  scenSystem.init();
  const r = scenSystem.createScenario('测试', '', { priceGrowth: 1.3 });
  out.steps.push(['createScenario', r.success && st.scenarios.customScenarios.length === 1]);
  const exp = scenSystem.exportScenario(r.scenario.id);
  const st2 = { scenarios: null };
  const scen2 = createScenarioEditorSystem({
    st: st2, eventBus: { emit: () => {}, on: () => {} }, pushLog: () => {},
    I18N: { getCurrentLang: () => 'zh' }, buildings: [],
  });
  scen2.init();
  const imp = scen2.importScenario(exp.data);
  out.steps.push(['export/import round-trip', imp.success && imp.scenario.params.priceGrowth === 1.3]);

  // 2. 经济系统场景参数
  const eSt = { scenarioParams: null, marketIsBull: true };
  const economy = createEconomySystem({
    st: eSt,
    buildings: [{ id: 'test_bld', basePrice: 100, dps: 10, owned: 3 }],
    upgrades: [], skills: [], bldBoost: {},
    PRICE_GROWTH: PRICE_GROWTH,
    MARKET_BULL_BONUS: MARKET_BULL_BONUS,
    MARKET_BEAR_PENALTY: MARKET_BEAR_PENALTY,
    SKILL_MASTERY_BONUS: SKILL_MASTERY_BONUS,
    MACRO_PREFERRED_BONUS: MACRO_PREFERRED_BONUS,
    dirty: {}, buildingViewMap: new Map(), pushLog: () => {}, saveGame: () => {},
    fmt: (x) => String(x), sfxBuy: () => {}, sfxUpgrade: () => {}, applyUpgradeEffect: () => {},
  });
  const b = { id: 'test_bld', basePrice: 100, dps: 10, owned: 3 };
  const priceBefore = economy.price(b);
  economy.setScenarioParams({ priceGrowth: 1.25, bullBonus: 2.0, bearPenalty: 0.5 });
  const priceAfter = economy.price(b);
  const expectedBefore = Math.floor(100 * Math.pow(PRICE_GROWTH, 3));
  const expectedAfter = Math.floor(100 * Math.pow(1.25, 3));
  out.steps.push(['economy price growth override', priceBefore === expectedBefore && priceAfter === expectedAfter && priceAfter > priceBefore]);
  out.steps.push(['economy st.scenarioParams set', eSt.scenarioParams && eSt.scenarioParams.priceGrowth === 1.25]);
  economy.setScenarioParams(null);
  out.steps.push(['economy reset to default', economy.price(b) === expectedBefore]);
  economy.setScenarioParams(); // 无参数调用不应抛错
  out.steps.push(['economy null/empty params safe', true]);

  // 3. 市场系统场景参数
  const mSt = { scenarioParams: null, marketIsBull: true, marketTimer: 0, marketCycleDuration: 0 };
  const market = createMarketSystem({
    st: mSt, dirty: {}, pushLog: () => {}, eventBus: { emit: () => {}, on: () => {} },
    sfxMarket: () => {}, mktMult: () => 1,
    MARKET_CYCLE_MIN: MARKET_CYCLE_MIN, MARKET_CYCLE_MAX: MARKET_CYCLE_MAX,
    MARKET_BULL_BONUS: MARKET_BULL_BONUS, MARKET_BEAR_PENALTY: MARKET_BEAR_PENALTY,
    POLICY_RATE_MIN: POLICY_RATE_MIN, POLICY_RATE_MAX: POLICY_RATE_MAX,
    OUTLOOK_REWARD_BASE: OUTLOOK_REWARD_BASE, OUTLOOK_REWARD_RATE_SCALE: OUTLOOK_REWARD_RATE_SCALE,
    OUTLOOK_PENALTY_BASE: OUTLOOK_PENALTY_BASE, OUTLOOK_PENALTY_RATE_SCALE: OUTLOOK_PENALTY_RATE_SCALE,
    OUTLOOK_PENALTY_GEAR_RATIO: OUTLOOK_PENALTY_GEAR_RATIO,
    MACRO_EVENTS: MACRO_EVENTS, POLICY_GUIDANCE_BASE_BIAS: POLICY_GUIDANCE_BASE_BIAS,
    marketMultEl: null, marketStatusEl: null, marketDotEl: null, marketLabelEl: null,
    marketWaveEl: null, marketCountEl: null, marketEffectEl: null, marketEventEl: null, marketOutlookEl: null,
  });
  market.setScenarioParams({ marketCycleMin: 5, marketCycleMax: 15, bullBonus: 3.0, bearPenalty: 0.3 });
  const durations = [];
  for (let i = 0; i < 200; i++) {
    mSt.marketTimer = 0; mSt.marketIsBull = true;
    market.doMarketSwitch();
    durations.push(mSt.marketCycleDuration);
  }
  const minD = Math.min.apply(null, durations);
  const maxD = Math.max.apply(null, durations);
  out.steps.push(['market cycle override [5,15]', minD >= 5 && maxD <= 15]);
  market.setScenarioParams(null);
  mSt.marketTimer = 0;
  market.doMarketSwitch();
  out.steps.push(['market reset to default', mSt.marketCycleDuration >= MARKET_CYCLE_MIN && mSt.marketCycleDuration <= MARKET_CYCLE_MAX]);
  market.setScenarioParams(); // 无参数调用不应抛错
  out.steps.push(['market null/empty params safe', true]);

  return out;
})();
`;

test('scenario params integrate with economy and market systems', () => {
  const sandbox = makeSandbox();
  loadAll(sandbox);
  const result = runInSandbox(sandbox, INTEGRATION_CODE);
  for (const [name, pass] of result.steps) {
    assert.ok(pass, `FAIL: ${name}`);
  }
});
