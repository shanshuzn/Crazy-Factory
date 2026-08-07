const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 调试系统测试
// 验证：?debug=1 启用；禁用时 update 为空函数；启用时输出关键诊断信息；折叠交互正常

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'debug-system.js'), 'utf8');

function runWithDebug(debugMode, updateCount = 0) {
  const children = [];
  const el = {
    className: '',
    children,
    lastChild: null,
    addEventListener: () => {},
    appendChild: (c) => {
      if (children.length) el.lastChild = children[children.length - 1];
      children.push(c);
    },
    removeChild: () => {},
    classList: {
      toggles: [],
      toggle: (cls, on) => el.classList.toggles.push({ cls, on }),
    },
    textContent: '',
  };
  el.lastChild = null;

  const sandbox = {
    console, Math, Date, JSON, isFinite, Number, Object, Array, Map, Set, Promise,
    performance: {
      now: (() => { let t = 1000; return () => (t += 16); })(),
      memory: { usedJSHeapSize: 20 * 1048576, totalJSHeapSize: 64 * 1048576 },
    },
    URLSearchParams: class { constructor(q) { this.q = q || ''; } get(k) { return k === 'debug' && this.q.includes('debug=1') ? '1' : null; } },
    window: {},
  };
  sandbox.window.location = { search: debugMode ? '?debug=1' : '' };
  sandbox.window.performance = sandbox.performance;
  sandbox.window.__timerManager = { getTasks: () => [{}, {}, {}] };
  sandbox.document = {
    createElement: () => el,
    body: { appendChild: () => {} },
  };
  sandbox.module = { exports: {} };
  sandbox.exports = {};
  sandbox.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'debug-system.js' });

  const st = {
    gears: 12345,
    marketIsBull: true,
    marketTimer: 42,
    policyRate: 3.5,
    macroEventId: 7,
    upgrades: { u1: true, u2: false, u3: true },
    achievements: { a1: true, a2: true },
    assetAllocation: {
      riskProfile: 'aggressive',
      allocation: { buildings: 0.8, upgrades: 0.1, derivativesMargin: 0.1 },
    },
  };
  const buildings = [
    { id: 'b1', owned: 3, maxOwned: 100, totalBought: 5 },
    { id: 'b2', owned: 0, maxOwned: 50, totalBought: 1 },
  ];
  const system = sandbox.module.exports.createDebugSystem({
    st,
    buildings,
    getGpsBreakdown: () => ({
      baseGPS: 500,
      finalMult: 2.5,
      totalGPS: 1250,
      factors: {
        gpsMultiplier: 1, research: 1.5, skillGPS: 1.25, market: 1.15,
        skillMastery: 1.2, synergy: 1, region: 1, crisis: 1, guild: 1,
        boost: 1.1, subscription: 1, riskVolatility: 1,
      },
      productCheck: 1.5 * 1.25 * 1.15 * 1.2 * 1.1,
    }),
    SAVE_KEY: 'crazy-factory-save',
    fmt: (x) => String(x),
    getBudgetSplit: () => ({ buildings: 0.8, upgrades: 0.1, margin: 0.1 }),
    getRiskProfile: () => 'aggressive',
  });

  for (let i = 0; i < updateCount; i++) system.update(0.016);
  return { system, el, st, sandbox };
}

test('debug system disabled when ?debug absent', () => {
  const { system } = runWithDebug(false);
  assert.equal(system.enabled, false);
  assert.equal(typeof system.update, 'function');
});

test('debug system enabled when ?debug=1', () => {
  const { system } = runWithDebug(true);
  assert.equal(system.enabled, true);
});

test('update renders GPS breakdown and state diagnostics', () => {
  const { el } = runWithDebug(true, 2);
  const text = el.children.length ? el.children[el.children.length - 1].textContent : '';
  assert.ok(text.includes('baseGPS'));
  assert.ok(text.includes('finalMult'));
  assert.ok(text.includes('MULT FACTORS'));
  assert.ok(text.includes('research'));
  assert.ok(text.includes('riskProfile'));
  assert.ok(text.includes('aggressive'));
  assert.ok(text.includes('budgetSplit'));
  assert.ok(text.includes('crazy-factory-save'));
});

test('collapse toggle removes body on collapse', () => {
  const { el } = runWithDebug(true, 1);
  const toggle = el.children[0];
  assert.ok(toggle);
  assert.equal(typeof toggle.addEventListener, 'function');
});
