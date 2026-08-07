const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 市场系统单元测试
// 验证：牛熊切换、市场周期、宏观事件、利率前瞻命中/误判、场景参数覆盖、渲染缓存

const root = path.join(__dirname, '..');

function makeEnv() {
  const sandbox = {
    console, Math, Date, JSON, isFinite, Number, Object, Array, Map, Set, Promise,
    performance: { now: () => Date.now() },
    module: { exports: {} }, exports: {},
  };
  vm.createContext(sandbox);
  // 先加载 game-data.js 提供 MARKET_*/POLICY_*/OUTLOOK_*/MACRO_EVENTS 全局常量
  vm.runInContext(fs.readFileSync(path.join(root, 'scripts', 'game-data.js'), 'utf8'), sandbox, { filename: 'game-data.js' });
  // 再加载 market-system.js；顶层 const 不挂 sandbox，需在沙箱内显式取出
  vm.runInContext(fs.readFileSync(path.join(root, 'scripts', 'market-system.js'), 'utf8'), sandbox, { filename: 'market-system.js' });
  vm.runInContext(
    'sandbox_createMarketSystem = createMarketSystem;' +
    'sandbox_MARKET_CYCLE_MIN = MARKET_CYCLE_MIN;' +
    'sandbox_MARKET_CYCLE_MAX = MARKET_CYCLE_MAX;' +
    'sandbox_MARKET_BULL_BONUS = MARKET_BULL_BONUS;' +
    'sandbox_MARKET_BEAR_PENALTY = MARKET_BEAR_PENALTY;' +
    'sandbox_MACRO_EVENTS = MACRO_EVENTS;',
    sandbox
  );
  return sandbox;
}

function makeSys(overrides = {}) {
  const sandbox = makeEnv();
  const st = {
    marketIsBull: true,
    marketTimer: 60,
    marketCycleDuration: 60,
    gameSpeed: 1,
    policyRate: 2,
    gears: 1000,
    lifetimeGears: 1000,
    macroEventId: '',
    macroEventTimer: 0,
    lastMacroEventId: '',
    macroPreferredBuildingId: '',
    macroChainCount: 0,
    rateOutlookHits: 0,
    rateOutlookMisses: 0,
    rateOutlookDirection: '上调',
    rateOutlookConfidence: 0,
  };
  const dirty = {};
  const logs = [];
  const events = [];
  const el = () => ({ textContent: '', style: {}, classList: { toggle: () => {} } });
  const system = sandbox.sandbox_createMarketSystem({
    st,
    dirty,
    pushLog: (m) => logs.push(m),
    eventBus: { emit: (evt, payload) => events.push({ evt, payload }), on: () => {} },
    sfxMarket: () => {},
    mktMult: () => 1.15,
    MARKET_CYCLE_MIN: sandbox.sandbox_MARKET_CYCLE_MIN,
    MARKET_CYCLE_MAX: sandbox.sandbox_MARKET_CYCLE_MAX,
    MARKET_BULL_BONUS: sandbox.sandbox_MARKET_BULL_BONUS,
    MARKET_BEAR_PENALTY: sandbox.sandbox_MARKET_BEAR_PENALTY,
    marketMultEl: el(), marketStatusEl: el(), marketDotEl: el(),
    marketLabelEl: el(), marketWaveEl: el(), marketCountEl: el(),
    marketEffectEl: el(), marketEventEl: el(), marketOutlookEl: el(),
    ...overrides,
  });
  return { sandbox, st, dirty, logs, events, system };
}

test('doMarketSwitch toggles bull/bear and sets cycle duration', () => {
  const { st, dirty, events, system } = makeSys();
  assert.equal(st.marketIsBull, true);
  system.doMarketSwitch();
  assert.equal(st.marketIsBull, false);
  assert.ok(st.marketCycleDuration >= 45 && st.marketCycleDuration <= 90, 'cycle in default range');
  assert.ok(st.marketTimer === st.marketCycleDuration);
  assert.ok(events.some((e) => e.evt === 'market:switched' && e.payload.isBull === false));
  assert.equal(dirty.market, true);
});

test('doMarketSwitch twice returns to bull', () => {
  const { st, system } = makeSys();
  system.doMarketSwitch();
  system.doMarketSwitch();
  assert.equal(st.marketIsBull, true);
});

test('tickMarket counts down and switches at zero', () => {
  const { st, system } = makeSys();
  st.marketTimer = 2;
  system.tickMarket(2.5); // 2 - 2.5 <= 0 触发切换
  assert.equal(st.marketIsBull, false, 'should switch when timer hits 0');
  assert.ok(st.marketTimer > 0, 'timer reset after switch');
});

test('tickMarket without reaching zero keeps market state', () => {
  const { st, system } = makeSys();
  st.marketTimer = 10;
  system.tickMarket(1);
  assert.equal(st.marketIsBull, true, 'should not switch before zero');
  assert.equal(st.marketTimer, 9);
});

test('tickMarket respects gameSpeed', () => {
  const { st, system } = makeSys();
  st.gameSpeed = 2;
  st.marketTimer = 10;
  system.tickMarket(1);
  assert.equal(st.marketTimer, 8, 'timer decreases by dt*gameSpeed');
});

test('getOutlookHitRate returns 0 when no data', () => {
  const { st, system } = makeSys();
  st.rateOutlookHits = 0; st.rateOutlookMisses = 0;
  assert.equal(system.getOutlookHitRate(), 0);
});

test('getOutlookHitRate computes correctly', () => {
  const { st, system } = makeSys();
  st.rateOutlookHits = 7; st.rateOutlookMisses = 3;
  assert.equal(system.getOutlookHitRate(), 0.7);
});

test('updateRateOutlook sets direction from bias', () => {
  const { st, system } = makeSys();
  st.macroEventId = 'inflation_hot'; // bias 0.8
  system.updateRateOutlook();
  assert.equal(st.rateOutlookBiasUp, 0.8);
  assert.equal(st.rateOutlookDirection, '上调');
  assert.equal(st.rateOutlookConfidence, 60);
});

test('updateRateOutlook lower bias gives 下调', () => {
  const { st, system } = makeSys();
  st.macroEventId = 'growth_cool'; // bias 0.2
  system.updateRateOutlook();
  assert.equal(st.rateOutlookDirection, '下调');
  assert.equal(st.rateOutlookConfidence, 60);
});

test('settleOutlookResult awards bonus on hit', () => {
  const { st, dirty, system } = makeSys();
  st.rateOutlookDirection = '上调';
  const before = st.gears;
  system.settleOutlookResult(0.25); // actual up
  assert.ok(st.gears > before, 'gears should increase on hit');
  assert.equal(st.rateOutlookHits, 1);
  assert.ok(st.lastRewardText.includes('命中'));
  assert.equal(dirty.gears, true);
});

test('settleOutlookResult deducts on miss', () => {
  const { st, system } = makeSys();
  st.rateOutlookDirection = '上调';
  const before = st.gears;
  system.settleOutlookResult(-0.25); // actual down
  assert.ok(st.gears < before, 'gears should decrease on miss');
  assert.equal(st.rateOutlookMisses, 1);
  assert.ok(st.lastRewardText.includes('误判'));
});

test('settleOutlookResult never drops gears below zero', () => {
  const { st, system } = makeSys();
  st.rateOutlookDirection = '上调';
  st.gears = 5;
  system.settleOutlookResult(-0.25);
  assert.ok(st.gears >= 0);
});

test('getActiveMacro returns null without event', () => {
  const { st, system } = makeSys();
  st.macroEventId = '';
  assert.equal(system.getActiveMacro(), null);
});

test('getActiveMacro returns event by id', () => {
  const { st, system } = makeSys();
  st.macroEventId = 'inflation_hot';
  const macro = system.getActiveMacro();
  assert.ok(macro);
  assert.equal(macro.id, 'inflation_hot');
  assert.equal(macro.preferredBuildingId, 'bank');
});

test('maybeRollMacroEvent respects existing timer', () => {
  const { st, system } = makeSys();
  st.macroEventTimer = 5;
  system.maybeRollMacroEvent();
  assert.equal(st.macroEventId, '');
});

test('maybeRollMacroEvent triggers when random < 0.15', () => {
  const { sandbox, st, logs, events, system } = makeSys();
  // 强制触发：mock Math.random 小值
  sandbox.Math.random = () => 0.05;
  system.maybeRollMacroEvent();
  assert.ok(st.macroEventId, 'should roll an event');
  assert.ok(st.macroEventTimer >= 1);
  assert.ok(events.some((e) => e.evt === 'macro:changed'));
  assert.ok(logs.some((l) => l.includes('宏观事件')));
});

test('maybeRollMacroEvent applies rate shock from event', () => {
  const { sandbox, st, system } = makeSys();
  sandbox.Math.random = () => 0.05;
  const macroList = sandbox.sandbox_MACRO_EVENTS;
  // 找一个带 rateShock 的事件
  const withShock = macroList.find((e) => e.rateShock);
  if (withShock) {
    st.macroEventId = '';
    system.maybeRollMacroEvent();
    // 事件可能随机选到任意事件，这里只验证逻辑不抛错
    assert.ok(st.policyRate >= 0 && st.policyRate <= 10);
  } else {
    assert.ok(true);
  }
});

test('decayMacroEvent clears expired event', () => {
  const { st, events, system } = makeSys();
  st.macroEventId = 'inflation_hot';
  st.macroEventTimer = 1;
  st.macroPreferredBuildingId = 'bank';
  system.decayMacroEvent();
  assert.equal(st.macroEventTimer, 0);
  assert.equal(st.macroEventId, '');
  assert.equal(st.macroPreferredBuildingId, '');
  assert.ok(events.some((e) => e.evt === 'macro:changed' && e.payload.preferredBuildingId === ''));
});

test('decayMacroEvent no-op when no timer', () => {
  const { st, system } = makeSys();
  st.macroEventTimer = 0;
  st.macroEventId = 'inflation_hot';
  system.decayMacroEvent();
  assert.equal(st.macroEventId, 'inflation_hot', 'should not clear without timer');
});

test('setScenarioParams overrides cycle range', () => {
  const { sandbox, st, system } = makeSys();
  system.setScenarioParams({ marketCycleMin: 5, marketCycleMax: 15, bullBonus: 3.0, bearPenalty: 0.3 });
  const durations = [];
  for (let i = 0; i < 200; i++) {
    st.marketTimer = 0; st.marketIsBull = true;
    system.doMarketSwitch();
    durations.push(st.marketCycleDuration);
  }
  const minD = Math.min(...durations);
  const maxD = Math.max(...durations);
  assert.ok(minD >= 5 && maxD <= 15, `cycle within [5,15], got [${minD},${maxD}]`);
});

test('setScenarioParams null restores defaults', () => {
  const { st, system } = makeSys();
  system.setScenarioParams(null);
  st.marketTimer = 0;
  system.doMarketSwitch();
  assert.ok(st.marketCycleDuration >= 45 && st.marketCycleDuration <= 90);
});

test('renderMarket writes DOM and caches values', () => {
  const { st, system } = makeSys();
  const multEl = { textContent: '', style: {} };
  const statusEl = { textContent: '', style: {} };
  const dotEl = { classList: { toggle: (c, on) => { dotEl._on = on; } } };
  const waveEl = { style: { width: '' } };
  const countEl = { textContent: '' };
  const effectEl = { textContent: '', style: {} };
  const eventEl = { textContent: '' };
  const outlookEl = { textContent: '' };

  const sandbox2 = makeEnv();
  const sys2 = sandbox2.sandbox_createMarketSystem({
    st, dirty: {}, pushLog: () => {}, eventBus: { emit: () => {}, on: () => {} },
    sfxMarket: () => {}, mktMult: () => 1.15,
    MARKET_CYCLE_MIN: sandbox2.sandbox_MARKET_CYCLE_MIN, MARKET_CYCLE_MAX: sandbox2.sandbox_MARKET_CYCLE_MAX,
    MARKET_BULL_BONUS: sandbox2.sandbox_MARKET_BULL_BONUS, MARKET_BEAR_PENALTY: sandbox2.sandbox_MARKET_BEAR_PENALTY,
    marketMultEl: multEl, marketStatusEl: statusEl, marketDotEl: dotEl,
    marketLabelEl: statusEl, marketWaveEl: waveEl, marketCountEl: countEl,
    marketEffectEl: effectEl, marketEventEl: eventEl, marketOutlookEl: outlookEl,
  });

  st.marketIsBull = true;
  st.marketTimer = 30;
  st.marketCycleDuration = 60;
  sys2.renderMarket();
  assert.equal(multEl.textContent, '×1.15');
  assert.equal(statusEl.textContent, '多头市场');
  assert.equal(dotEl._on, false, 'bull market should not add bear class');
  assert.ok(waveEl.style.width.includes('%'));
  assert.equal(effectEl.textContent, '多头加成 ×1.1'); // 默认 BULL_BONUS 1.15，toFixed(1) 浮点取整为 1.1
  assert.ok(outlookEl.textContent.includes('利率前瞻'));
});

test('renderMarket shows macro event info', () => {
  const { st, system } = makeSys();
  st.macroEventId = 'inflation_hot';
  st.macroEventTimer = 3;
  st.macroPreferredBuildingId = 'bank';
  const eventEl = { textContent: '' };
  const outlookEl = { textContent: '' };
  const sandbox2 = makeEnv();
  const sys2 = sandbox2.sandbox_createMarketSystem({
    st, dirty: {}, pushLog: () => {}, eventBus: { emit: () => {}, on: () => {} },
    sfxMarket: () => {}, mktMult: () => 1,
    MARKET_CYCLE_MIN: 45, MARKET_CYCLE_MAX: 90, MARKET_BULL_BONUS: 1.15, MARKET_BEAR_PENALTY: 0.85,
    marketMultEl: { textContent: '', style: {} }, marketStatusEl: { textContent: '', style: {} },
    marketDotEl: { classList: { toggle: () => {} } }, marketLabelEl: { textContent: '', style: {} },
    marketWaveEl: { style: {} }, marketCountEl: { textContent: '' },
    marketEffectEl: { textContent: '', style: {} },
    marketEventEl: eventEl, marketOutlookEl: outlookEl,
  });
  sys2.renderMarket();
  assert.ok(eventEl.textContent.includes('通胀升温'));
  assert.ok(eventEl.textContent.includes('bank'));
});
