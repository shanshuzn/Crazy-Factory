const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 场景市场测试
// 验证：精选场景库完整性、应用市场场景、收藏/取消收藏、面板渲染

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'scenario-editor-system.js'), 'utf8');

function makeSys() {
  const sandbox = {
    console, Math, Date, JSON, isFinite, Number, Object, Array, Map, Set, Promise,
    encodeURIComponent, decodeURIComponent,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    module: { exports: {} }, exports: {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'scenario-editor-system.js' });

  const st = { scenarios: null };
  const events = [];
  const system = sandbox.module.exports.createScenarioEditorSystem({
    st,
    eventBus: { emit: (evt, payload) => events.push({ evt, payload }) },
    pushLog: () => {},
    I18N: { getCurrentLang: () => 'zh' },
    buildings: [],
  });
  system.init();
  return { sandbox, st, system, events };
}

test('marketplace has 8 featured scenarios', () => {
  const { system } = makeSys();
  const market = system.getMarketplace();
  assert.equal(market.length, 8);
  const ids = market.map((m) => m.id);
  for (const id of ['great_depression', 'golden_age', 'supply_crisis', 'digital_revolution', 'slow_burn', 'black_swan', 'easy_money', 'frozen_market']) {
    assert.ok(ids.includes(id), `should include ${id}`);
  }
});

test('marketplace scenarios have valid params', () => {
  const { system } = makeSys();
  for (const m of system.getMarketplace()) {
    assert.ok(m.params.priceGrowth > 0, `${m.id} priceGrowth`);
    assert.ok(m.params.marketCycleMin > 0 && m.params.marketCycleMax > m.params.marketCycleMin, `${m.id} cycle`);
    assert.ok(m.params.bullBonus >= 1, `${m.id} bullBonus`);
    assert.ok(m.params.bearPenalty > 0 && m.params.bearPenalty <= 1, `${m.id} bearPenalty`);
    assert.ok(m.difficulty >= 1 && m.difficulty <= 5, `${m.id} difficulty`);
    assert.ok(Array.isArray(m.tags) && m.tags.length > 0, `${m.id} tags`);
  }
});

test('applying a marketplace scenario activates it', () => {
  const { st, system, events } = makeSys();
  const r = system.applyScenario('black_swan');
  assert.equal(r.success, true);
  assert.equal(st.scenarios.activeScenario, 'black_swan');
  assert.equal(st.scenarios.stats.played, 1);
  assert.ok(events.some((e) => e.evt === 'scenario:applied'));
});

test('getActiveScenario resolves marketplace scenario', () => {
  const { system } = makeSys();
  system.applyScenario('golden_age');
  const active = system.getActiveScenario();
  assert.ok(active);
  assert.equal(active.id, 'golden_age');
  assert.ok(active.params);
});

test('toggleFavorite adds and removes scenario', () => {
  const { system, events } = makeSys();
  assert.equal(system.isFavorite('slow_burn'), false);
  const r1 = system.toggleFavorite('slow_burn');
  assert.equal(r1.favorited, true);
  assert.equal(system.isFavorite('slow_burn'), true);
  const r2 = system.toggleFavorite('slow_burn');
  assert.equal(r2.favorited, false);
  assert.equal(system.isFavorite('slow_burn'), false);
  assert.ok(events.some((e) => e.evt === 'scenario:favoritesChanged'));
});

test('favorites are stored in st.scenarios.favorites', () => {
  const { st, system } = makeSys();
  system.toggleFavorite('easy_money');
  assert.equal(st.scenarios.favorites.length, 1);
  assert.equal(st.scenarios.favorites[0], 'easy_money');
});

test('renderScenarioPanel includes marketplace section', () => {
  const { system } = makeSys();
  const html = system.renderScenarioPanel('zh');
  assert.ok(html.includes('场景市场'));
  assert.ok(html.includes('大萧条'));
  assert.ok(html.includes('data-scenario-action="favorite"'));
  assert.ok(html.includes('data-scenario-action="apply"'));
});

test('renderScenarioPanel shows favorites section after favoriting', () => {
  const { system } = makeSys();
  system.toggleFavorite('frozen_market');
  const html = system.renderScenarioPanel('zh');
  assert.ok(html.includes('收藏夹'));
  assert.ok(html.includes('data-scenario-action="unfavorite"'));
});

test('favorites section hidden when empty', () => {
  const { system } = makeSys();
  const html = system.renderScenarioPanel('zh');
  assert.ok(!html.includes('收藏夹'));
});

test('marketplace apply/render survive unicode and i18n', () => {
  const sandbox = {
    console, Math, Date, JSON, isFinite, Number, Object, Array, Map, Set, Promise,
    encodeURIComponent, decodeURIComponent,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    module: { exports: {} }, exports: {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'scenario-editor-system.js' });
  const st = { scenarios: null };
  const system = sandbox.module.exports.createScenarioEditorSystem({
    st,
    eventBus: { emit: () => {} },
    pushLog: () => {},
    I18N: { getCurrentLang: () => 'en' },
    buildings: [],
  });
  system.init();
  system.applyScenario('supply_crisis');
  const html = system.renderScenarioPanel();
  assert.ok(html.includes('Supply Chain Crisis'));
});
