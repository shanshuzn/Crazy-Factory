const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 危机系统测试
// 验证：危机数据初始化、触发、效果应用、恢复（等待/救助）、免疫期、历史、UI 渲染

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'crisis-system.js'), 'utf8');

function makeSys(overrides = {}) {
  const sandbox = {
    console, Math, Date, JSON, isFinite, Number, Object, Array, Map, Set, Promise,
    module: { exports: {} }, exports: {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'crisis-system.js' });

  const st = {
    money: 1e9,
    lifetimeGears: 1e9,
    perkCrispImmune: false,
    assetAllocation: { riskProfile: 'balanced' },
    crisis: null,
  };
  const events = [];
  const logs = [];
  const system = sandbox.module.exports.createCrisisSystem({
    st,
    eventBus: { emit: (evt, payload) => events.push({ evt, payload }), on: () => {} },
    buildings: [],
    pushLog: (m) => logs.push(m),
    I18N: { getCurrentLang: () => 'zh' },
    economy: {},
    ...overrides,
  });
  return { sandbox, st, events, logs, system };
}

test('init initializes crisis data', () => {
  const { st, system } = makeSys();
  system.init();
  assert.ok(st.crisis);
  assert.equal(st.crisis.active, null);
  assert.equal(st.crisis.history.length, 0);
  assert.equal(st.crisis.stats.totalCrises, 0);
});

test('init does not reset existing data', () => {
  const { st, system } = makeSys();
  system.init();
  st.crisis.stats.totalCrises = 3;
  system.init();
  assert.equal(st.crisis.stats.totalCrises, 3);
});

test('getAllCrisisTypes returns 5 crisis types', () => {
  const { system } = makeSys();
  const types = system.getAllCrisisTypes();
  assert.equal(types.length, 5);
  const ids = types.map((t) => t.id);
  assert.ok(ids.includes('financial_crisis'));
  assert.ok(ids.includes('pandemic'));
  assert.ok(ids.includes('cyber_attack'));
  assert.ok(ids.includes('trade_war'));
  assert.ok(ids.includes('inflation_spike'));
});

test('isCrisisActive false initially', () => {
  const { system } = makeSys();
  system.init();
  assert.equal(system.isCrisisActive(), false);
});

test('triggerCrisis activates crisis and emits event', () => {
  const { st, events, logs, system } = makeSys();
  system.init();
  const crisis = system.triggerCrisis('financial_crisis');
  assert.ok(crisis);
  assert.equal(st.crisis.active.id, 'financial_crisis');
  assert.equal(st.crisis.stats.totalCrises, 1);
  assert.ok(events.some((e) => e.evt === 'crisis:started'));
  assert.ok(logs.some((l) => l.includes('危机')));
});

test('triggerCrisis duration uses perk halving', () => {
  const { st, system } = makeSys();
  system.init();
  st.perkCrispImmune = true;
  const crisis = system.triggerCrisis('financial_crisis'); // 300s
  assert.ok(Math.abs((crisis.endsAt - crisis.startedAt) - 300 * 500) < 10, 'halved duration');
});

test('triggerCrisis without perk uses full duration', () => {
  const { st, system } = makeSys();
  system.init();
  const crisis = system.triggerCrisis('financial_crisis'); // 300s
  assert.ok(Math.abs((crisis.endsAt - crisis.startedAt) - 300 * 1000) < 10);
});

test('getActiveCrisis returns null when none', () => {
  const { system } = makeSys();
  system.init();
  assert.equal(system.getActiveCrisis(), null);
});

test('getCrisisEffects returns null when no crisis', () => {
  const { system } = makeSys();
  system.init();
  assert.equal(system.getCrisisEffects(), null);
});

test('getCrisisEffects returns effects during crisis', () => {
  const { st, system } = makeSys();
  system.init();
  system.triggerCrisis('financial_crisis');
  const effects = system.getCrisisEffects();
  assert.ok(effects);
  assert.equal(effects.gpsMultiplier, 0.5);
});

test('applyCrisisEffects drains money on inflation_spike', () => {
  const { st, system } = makeSys();
  system.init();
  st.money = 1000;
  system.triggerCrisis('inflation_spike'); // moneyDrainRate 0.01
  system.applyCrisisEffects();
  assert.ok(st.money < 1000, 'money should drain');
  assert.ok(st.money >= 0);
});

test('applyCrisisEffects conservative profile reduces drain', () => {
  const { st, system } = makeSys();
  system.init();
  st.assetAllocation.riskProfile = 'conservative';
  st.money = 1000;
  system.triggerCrisis('inflation_spike');
  system.applyCrisisEffects();
  const afterConservative = st.money;
  // 对比非保守
  st.assetAllocation.riskProfile = 'balanced';
  st.money = 1000;
  const crisis2 = system.triggerCrisis('inflation_spike');
  system.applyCrisisEffects();
  assert.ok(afterConservative > st.money, 'conservative should drain less');
});

test('applyCrisisEffects no-op without active crisis', () => {
  const { st, system } = makeSys();
  system.init();
  assert.doesNotThrow(() => system.applyCrisisEffects());
  assert.equal(st.money, 1e9);
});

test('recoverCrisis via wait', () => {
  const { st, events, logs, system } = makeSys();
  system.init();
  system.triggerCrisis('cyber_attack');
  const r = system.recoverCrisis('wait');
  assert.equal(r.success, true);
  assert.equal(st.crisis.active, null);
  assert.equal(st.crisis.stats.survivedCrises, 1);
  assert.equal(st.crisis.history.length, 1);
  assert.equal(st.crisis.history[0].recoveryMethod, 'wait');
  assert.ok(st.crisis.immuneUntil > Date.now());
  assert.ok(events.some((e) => e.evt === 'crisis:ended'));
});

test('recoverCrisis via bailout deducts cost', () => {
  const { st, system } = makeSys();
  system.init();
  st.lifetimeGears = 1e7; // cost = max(1e7, 1e7*0.03=3e5) = 1e7
  st.money = 1e9; // 足够支付
  system.triggerCrisis('cyber_attack');
  const before = st.money;
  const r = system.recoverCrisis('bailout');
  assert.equal(r.success, true);
  assert.ok(st.money < before, 'money deducted');
  assert.ok(Math.abs(before - st.money - 1e7) < 1, 'deducted exactly 1e7');
  assert.equal(st.crisis.stats.bailedOutCrises, 1);
  assert.ok(Math.abs(st.crisis.stats.totalLoss - 1e7) < 1);
});

test('recoverCrisis bailout fails with insufficient funds', () => {
  const { st, system } = makeSys();
  system.init();
  st.money = 1;
  system.triggerCrisis('cyber_attack');
  const r = system.recoverCrisis('bailout');
  assert.equal(r.success, false);
  assert.ok(r.error.includes('资金不足'));
  assert.ok(st.crisis.active !== null, 'crisis should remain when bailout fails');
});

test('recoverCrisis no active crisis', () => {
  const { system } = makeSys();
  system.init();
  const r = system.recoverCrisis('wait');
  assert.equal(r.success, false);
  assert.ok(r.error.includes('无活跃危机'));
});

test('recoverCrisis sets 30min immune period', () => {
  const { st, system } = makeSys();
  system.init();
  system.triggerCrisis('trade_war');
  const now = Date.now();
  system.recoverCrisis('wait');
  assert.ok(st.crisis.immuneUntil - now >= 30 * 60 * 1000 - 10);
});

test('checkCrisisTrigger blocked by active crisis', () => {
  const { st, system } = makeSys();
  system.init();
  system.triggerCrisis('financial_crisis');
  assert.equal(system.checkCrisisTrigger(), false);
});

test('checkCrisisTrigger blocked by immune period', () => {
  const { st, system } = makeSys();
  system.init();
  st.crisis.immuneUntil = Date.now() + 100000;
  assert.equal(system.checkCrisisTrigger(), false);
});

test('checkCrisisTrigger respects minMoney', () => {
  const { st, system } = makeSys();
  system.init();
  st.money = 100; // 低于所有 minMoney
  st.crisis.immuneUntil = 0;
  assert.equal(system.checkCrisisTrigger(), false);
});

test('checkCrisisTrigger triggers crisis when random hits', () => {
  const { sandbox, st, system } = makeSys();
  system.init();
  st.crisis.immuneUntil = 0;
  st.money = 1e9; // 满足所有触发条件
  sandbox.Math.random = () => 0; // 保证 < secondProb
  const r = system.checkCrisisTrigger();
  assert.equal(r, true);
  assert.ok(st.crisis.active);
  assert.equal(st.crisis.stats.totalCrises, 1);
});

test('update resolves expired crisis', () => {
  const { st, system } = makeSys();
  system.init();
  system.triggerCrisis('cyber_attack');
  st.crisis.active.endsAt = Date.now() - 100; // 已过期
  system.update();
  assert.equal(st.crisis.active, null);
  assert.equal(st.crisis.stats.survivedCrises, 1);
});

test('update no-op without active crisis and no trigger', () => {
  const { st, system } = makeSys();
  system.init();
  st.crisis.immuneUntil = Date.now() + 100000; // 免疫中
  system.update();
  assert.equal(st.crisis.active, null);
});

test('getCrisisInfo returns details with bailout cost', () => {
  const { st, system } = makeSys();
  system.init();
  st.lifetimeGears = 1e7;
  system.triggerCrisis('trade_war'); // cost = max(2e6, 1e7*0.04=4e5) = 2e6
  const info = system.getCrisisInfo();
  assert.ok(info);
  assert.equal(info.id, 'trade_war');
  assert.equal(info.remainingSeconds >= 0, true);
  assert.equal(info.canAffordBailout, true);
  assert.equal(info.bailoutCost, 2e6);
});

test('getCrisisInfo conservative reduces bailout cost', () => {
  const { st, system } = makeSys();
  system.init();
  st.lifetimeGears = 1e7;
  st.assetAllocation.riskProfile = 'conservative';
  system.triggerCrisis('trade_war'); // cost 2e6 * 0.7 = 1.4e6
  const info = system.getCrisisInfo();
  assert.ok(Math.abs(info.bailoutCost - 1.4e6) < 1e-6);
});

test('getCrisisHistory returns recorded history', () => {
  const { st, system } = makeSys();
  system.init();
  system.triggerCrisis('pandemic');
  system.recoverCrisis('wait');
  system.triggerCrisis('cyber_attack');
  system.recoverCrisis('bailout');
  const history = system.getCrisisHistory();
  assert.equal(history.length, 2);
  assert.equal(history[0].recoveryMethod, 'wait');
  assert.equal(history[1].recoveryMethod, 'bailout');
});

test('getStats returns stats object', () => {
  const { system } = makeSys();
  system.init();
  const stats = system.getStats();
  assert.equal(stats.totalCrises, 0);
  assert.equal(stats.survivedCrises, 0);
  assert.equal(stats.bailedOutCrises, 0);
});

test('renderCrisisPanel safe state shows no crisis', () => {
  const { system } = makeSys();
  system.init();
  const html = system.renderCrisisPanel();
  assert.ok(html.includes('无活跃危机'));
  assert.ok(html.includes('已度过'));
});

test('renderCrisisPanel shows immune timer', () => {
  const { st, system } = makeSys();
  system.init();
  st.crisis.immuneUntil = Date.now() + 5000;
  const html = system.renderCrisisPanel();
  assert.ok(html.includes('免疫'));
});

test('renderCrisisPanel active state shows crisis details', () => {
  const { st, system } = makeSys();
  system.init();
  system.triggerCrisis('financial_crisis');
  const html = system.renderCrisisPanel();
  assert.ok(html.includes('金融危机'));
  assert.ok(html.includes('市场崩溃'));
  assert.ok(html.includes('bailout-btn'));
  assert.ok(html.includes('政府救助'));
});

test('renderCrisisPanel en language', () => {
  const { st, system } = makeSys({ I18N: { getCurrentLang: () => 'en' } });
  system.init();
  system.triggerCrisis('financial_crisis');
  const html = system.renderCrisisPanel();
  assert.ok(html.includes('Financial Crisis'));
  assert.ok(html.includes('Government Bailout'));
});

test('renderCrisisHistory empty', () => {
  const { system } = makeSys();
  system.init();
  const html = system.renderCrisisHistory();
  assert.ok(html.includes('最近危机'));
  assert.ok(html.includes('无记录'));
});

test('renderCrisisHistory lists recent crises', () => {
  const { st, system } = makeSys();
  system.init();
  system.triggerCrisis('financial_crisis');
  system.recoverCrisis('wait');
  const html = system.renderCrisisHistory();
  assert.ok(html.includes('金融危机'));
  assert.ok(html.includes('history-item'));
});

test('init survives without window.__timerManager', () => {
  const { system } = makeSys();
  assert.doesNotThrow(() => system.init());
});

test('init schedules update with timerManager', () => {
  const { sandbox, system } = makeSys();
  let scheduled = false;
  sandbox.window.__timerManager = { schedule: () => { scheduled = true; } };
  system.init();
  assert.equal(scheduled, true);
});
