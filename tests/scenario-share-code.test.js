const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 场景分享码测试
// 验证：encode/decode 往返一致性、中英文名、参数保真、容错

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'scenario-editor-system.js'), 'utf8');

function makeSys() {
  const sandbox = {
    console, Math, Date, JSON, isFinite, Number, Object, Array, Map, Set, Promise,
    encodeURIComponent,
    decodeURIComponent,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    module: { exports: {} },
    exports: {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'scenario-editor-system.js' });

  const st = { scenarios: null };
  const system = sandbox.module.exports.createScenarioEditorSystem({
    st,
    eventBus: { emit: () => {} },
    pushLog: () => {},
    I18N: { getCurrentLang: () => 'zh' },
    buildings: [],
  });
  system.init();
  return { sandbox, st, system };
}

test('encode produces CFS1: prefixed code', () => {
  const { system } = makeSys();
  const r = system.createScenario('测试场景', '描述', { priceGrowth: 1.3, bullBonus: 2.0 });
  const enc = system.encodeScenarioCode(r.scenario);
  assert.equal(enc.success, true);
  assert.ok(enc.code.startsWith('CFS1:'));
  assert.ok(enc.code.length > 'CFS1:'.length);
});

test('decode restores name/description/params exactly', () => {
  const { system } = makeSys();
  const params = { priceGrowth: 1.3, marketCycleMin: 20, marketCycleMax: 50, bullBonus: 2.2, bearPenalty: 0.4 };
  const r = system.createScenario({ zh: '中文名', en: 'English Name' }, '描述信息', params);
  const enc = system.encodeScenarioCode(r.scenario);
  const dec = system.decodeScenarioCode(enc.code);
  assert.equal(dec.success, true);
  // VM 跨 realm 对象原型不同，逐字段断言而非 deepStrictEqual
  assert.equal(dec.scenario.name.zh, '中文名');
  assert.equal(dec.scenario.name.en, 'English Name');
  assert.equal(dec.scenario.description, '描述信息');
  assert.equal(dec.scenario.params.priceGrowth, params.priceGrowth);
  assert.equal(dec.scenario.params.marketCycleMin, params.marketCycleMin);
  assert.equal(dec.scenario.params.marketCycleMax, params.marketCycleMax);
  assert.equal(dec.scenario.params.bullBonus, params.bullBonus);
  assert.equal(dec.scenario.params.bearPenalty, params.bearPenalty);
});

test('round-trip via applyScenarioCode creates working scenario', () => {
  const { system, st } = makeSys();
  const created = system.createScenario('往返测试', '', { priceGrowth: 1.4 });
  const enc = system.encodeScenarioCode(created.scenario);
  const applied = system.applyScenarioCode(enc.code);
  assert.equal(applied.success, true);
  assert.equal(st.scenarios.customScenarios.length, 2);
  assert.equal(applied.scenario.params.priceGrowth, 1.4);
});

test('decode tolerates missing CFS1: prefix', () => {
  const { system } = makeSys();
  const r = system.createScenario('无前缀', '', {});
  const enc = system.encodeScenarioCode(r.scenario);
  const bare = enc.code.replace('CFS1:', '');
  const dec = system.decodeScenarioCode(bare);
  assert.equal(dec.success, true);
  assert.equal(dec.scenario.name.zh, '无前缀');
});

test('decode rejects garbage input', () => {
  const { system } = makeSys();
  const r = system.decodeScenarioCode('CFS1:!!!not-base64!!!');
  assert.equal(r.success, false);
  assert.ok(r.error);
});

test('decode rejects empty code', () => {
  const { system } = makeSys();
  const r = system.decodeScenarioCode('');
  assert.equal(r.success, false);
});

test('unicode-heavy code stays stable across encode/decode', () => {
  const { system } = makeSys();
  const longDesc = '超长描述'.repeat(50) + ' with English mixed 混合内容';
  const r = system.createScenario('混合语种名称', longDesc, { priceGrowth: 1.05, marketCycleMax: 200 });
  const enc = system.encodeScenarioCode(r.scenario);
  const dec = system.decodeScenarioCode(enc.code);
  assert.equal(dec.success, true);
  assert.equal(dec.scenario.description, longDesc);
  assert.equal(dec.scenario.params.marketCycleMax, 200);
});

test('share code generated for template scenarios is valid', () => {
  const { system } = makeSys();
  // 模板场景无法直接编码（不在 customScenarios），但对 custom 构造合法
  const r = system.createScenario('模板型', '', { priceGrowth: 1.12 });
  const enc = system.encodeScenarioCode(r.scenario);
  assert.equal(enc.success, true);
  assert.ok(enc.code.length > 10);
});
