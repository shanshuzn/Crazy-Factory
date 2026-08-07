const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 产业链联动系统测试
// 验证：上下游加成计算、全局加成、格式化、提示渲染、变化检测、init 安全

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'synergy-system.js'), 'utf8');

function makeSys(overrides = {}) {
  const sandbox = {
    console, Math, Date, JSON, isFinite, Number, Object, Array, Map, Set, Promise,
    module: { exports: {} }, exports: {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'synergy-system.js' });

  const buildings = [
    { id: 'farm', name: '农场', dps: 10, owned: 5, synergy: { upstream: [], downstream: ['mill'], bonusPerDownstream: 0.1, desc: '农场描述' } },
    { id: 'mill', name: '磨坊', dps: 20, owned: 3, synergy: { upstream: ['farm'], bonusPerUpstream: 0.15, downstream: ['bakery'], bonusPerDownstream: 0.1, desc: '磨坊描述' } },
    { id: 'bakery', name: '面包店', dps: 40, owned: 2, synergy: { upstream: ['mill'], bonusPerUpstream: 0.2, desc: '面包店描述' } },
    { id: 'mine', name: '矿场', dps: 50, owned: 1 }, // 无 synergy
  ];
  const st = {};
  const events = [];
  const logs = [];
  const system = sandbox.module.exports.createSynergySystem({
    buildings,
    st,
    eventBus: { emit: (evt, payload) => events.push({ evt, payload }) },
    pushLog: (m) => logs.push(m),
    I18N: { getCurrentLang: () => 'zh' },
    ...overrides,
  });
  return { sandbox, buildings, st, events, logs, system };
}

test('building without synergy returns neutral bonus', () => {
  const { system } = makeSys();
  const r = system.calculateBuildingSynergy({ id: 'x', dps: 10 });
  assert.equal(r.totalBonus, 1.0);
  assert.equal(r.upstreamBonus, 0);
  assert.equal(r.downstreamBonus, 0);
  assert.equal(r.details.length, 0);
});

test('downstream bonus counts owned downstream buildings', () => {
  const { buildings, system } = makeSys();
  // farm: 5 owned, downstream mill(3 owned) × 0.1 = 0.3
  const r = system.calculateBuildingSynergy(buildings[0]);
  assert.equal(r.downstreamBonus, 3 * 0.1);
  assert.equal(r.totalBonus, 1 + 0.3);
  assert.equal(r.details.length, 1);
  assert.equal(r.details[0].type, 'downstream');
});

test('upstream bonus counts owned upstream buildings', () => {
  const { buildings, system } = makeSys();
  // bakery: upstream mill(3 owned) × 0.2 = 0.6
  const r = system.calculateBuildingSynergy(buildings[2]);
  assert.equal(r.upstreamBonus, 3 * 0.2);
  assert.equal(r.totalBonus, 1 + 0.6);
});

test('both upstream and downstream bonuses combine', () => {
  const { buildings, system } = makeSys();
  // mill: upstream farm(5)×0.15=0.75 + downstream bakery(2)×0.1=0.2 => 1.95
  const r = system.calculateBuildingSynergy(buildings[1]);
  assert.ok(Math.abs(r.upstreamBonus - 0.75) < 1e-9);
  assert.ok(Math.abs(r.downstreamBonus - 0.2) < 1e-9);
  assert.ok(Math.abs(r.totalBonus - 1.95) < 1e-9);
  assert.equal(r.details.length, 2);
});

test('upstream building with 0 owned gives no bonus', () => {
  const { buildings, system } = makeSys();
  buildings[1].owned = 0; // mill 0 owned
  const r = system.calculateBuildingSynergy(buildings[2]); // bakery upstream mill
  assert.equal(r.upstreamBonus, 0);
  assert.equal(r.totalBonus, 1.0);
});

test('calculateGlobalSynergy computes weighted multiplier', () => {
  const { buildings, system } = makeSys();
  const g = system.calculateGlobalSynergy();
  // 手动计算：
  // farm: 5×10=50 ×1.3 = 65
  // mill: 3×20=60 ×1.95 = 117
  // bakery: 2×40=80 ×1.6 = 128
  // mine: 1×50=50 ×1.0 = 50
  const withSyn = 65 + 117 + 128 + 50;
  const without = 50 + 60 + 80 + 50;
  assert.ok(Math.abs(g.totalGPSWithSynergy - withSyn) < 1e-9);
  assert.ok(Math.abs(g.totalGPSWithoutSynergy - without) < 1e-9);
  assert.ok(Math.abs(g.globalMultiplier - withSyn / without) < 1e-9);
});

test('calculateGlobalSynergy returns 1.0 multiplier when no production', () => {
  const { buildings, system } = makeSys();
  buildings.forEach((b) => { b.owned = 0; });
  const g = system.calculateGlobalSynergy();
  assert.equal(g.globalMultiplier, 1.0);
  assert.equal(g.totalGPSWithSynergy, 0);
});

test('getBuildingSynergyInfo returns null for unknown building', () => {
  const { system } = makeSys();
  assert.equal(system.getBuildingSynergyInfo('nonexistent'), null);
});

test('getBuildingSynergyInfo returns synergy for valid building', () => {
  const { buildings, system } = makeSys();
  const info = system.getBuildingSynergyInfo('mill');
  assert.ok(info);
  assert.ok(info.totalBonus > 1);
});

test('formatSynergyBonus formats percent', () => {
  const { system } = makeSys();
  assert.equal(system.formatSynergyBonus(1.0), '0%');
  assert.equal(system.formatSynergyBonus(1.5), '+50%');
  assert.equal(system.formatSynergyBonus(2.0), '+100%');
  // 负加成（如危机减免）当前实现显示为 0%（percent>0 才加 +）
  assert.equal(system.formatSynergyBonus(0.9), '0%');
});

test('renderSynergyTooltip returns empty for unknown building', () => {
  const { system } = makeSys();
  assert.equal(system.renderSynergyTooltip('nope'), '');
});

test('renderSynergyTooltip includes chain details', () => {
  const { system } = makeSys();
  const html = system.renderSynergyTooltip('mill');
  assert.ok(html.includes('产业链联动'));
  assert.ok(html.includes('上游加成'));
  assert.ok(html.includes('总加成'));
  assert.ok(html.includes('磨坊描述'));
});

test('renderSynergyTooltip en language', () => {
  const { system } = makeSys({ I18N: { getCurrentLang: () => 'en' } });
  const html = system.renderSynergyTooltip('mill');
  assert.ok(html.includes('Industry Chain'));
  assert.ok(html.includes('From upstream'));
});

test('renderGlobalSynergyPanel shows multiplier and bonus', () => {
  const { system } = makeSys();
  const html = system.renderGlobalSynergyPanel();
  assert.ok(html.includes('产业链总览'));
  assert.ok(html.includes('全局加成倍率'));
  assert.ok(html.includes('x'));
});

test('checkSynergyChanges detects increases and emits event', () => {
  const { buildings, events, system } = makeSys();
  // 首次调用记录初始状态
  system.checkSynergyChanges();
  assert.equal(events.length, 0, 'initial check should not emit');
  // 增加一个 upstream building，触发加成提升
  buildings[0].owned = 6; // farm 5 -> 6，磨坊 upstream 加成提升
  const changed = system.checkSynergyChanges();
  assert.equal(changed, true);
  assert.ok(events.some((e) => e.evt === 'synergy:activated'));
});

test('checkSynergyChanges no event when stable', () => {
  const { events, system } = makeSys();
  system.checkSynergyChanges();
  const before = events.length;
  system.checkSynergyChanges(); // 状态未变
  assert.equal(events.length, before);
});

test('init schedules check without window.timerManager', () => {
  const { system } = makeSys();
  // init 在无 window.__timerManager 时不抛错
  assert.doesNotThrow(() => system.init());
});

test('init schedules with timerManager', () => {
  const { sandbox, system } = makeSys();
  let scheduled = false;
  sandbox.window.__timerManager = { schedule: () => { scheduled = true; } };
  system.init();
  assert.equal(scheduled, true);
});

test('getLang falls back to zh without I18N', () => {
  const sandbox = {
    console, Math, Date, JSON, isFinite, Number, Object, Array, Map, Set, Promise,
    module: { exports: {} }, exports: {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'synergy-system.js' });
  const system = sandbox.module.exports.createSynergySystem({
    buildings: [{ id: 'a', dps: 1, owned: 1, synergy: { upstream: [], bonusPerUpstream: 0 } }],
    st: {}, eventBus: null, pushLog: () => {}, // I18N 缺失
  });
  const html = system.renderSynergyTooltip('a');
  assert.ok(html.includes('产业链联动')); // 回退中文
});
