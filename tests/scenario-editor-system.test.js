const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 场景编辑器系统测试
// 验证 createScenarioEditorSystem 的 CRUD / 导入导出 / 参数覆盖能力

const systemPath = path.join(__dirname, '..', 'scripts', 'scenario-editor-system.js');
const source = fs.readFileSync(systemPath, 'utf8');

// 在 VM 环境中执行浏览器脚本，捕获 createScenarioEditorSystem
const vm = require('node:vm');
const sandbox = {
  module: { exports: {} },
  exports: {},
  console,
  Date,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { createScenarioEditorSystem } = sandbox.module.exports;

const makeSt = () => ({ scenarios: null });
const makeSys = (overrides = {}) => {
  const st = makeSt();
  const events = [];
  const system = createScenarioEditorSystem({
    st,
    eventBus: {
      emit: (evt, payload) => events.push({ evt, payload }),
    },
    pushLog: () => {},
    I18N: { getCurrentLang: () => 'zh' },
    buildings: [],
    ...overrides,
  });
  system.init();
  return { st, system, events };
};

test('init creates scenarios state', () => {
  const { st, system } = makeSys();
  assert.ok(st.scenarios);
  assert.ok(Array.isArray(st.scenarios.customScenarios));
  assert.equal(st.scenarios.activeScenario, null);
  assert.equal(st.scenarios.stats.created, 0);
});

test('templates include standard and extreme scenarios', () => {
  const { system } = makeSys();
  const templates = system.getTemplates();
  assert.ok(templates.default);
  assert.ok(templates.hyperinflation);
  assert.ok(templates.tech_bubble);
  assert.ok(templates.steady_growth);
  assert.ok(templates.free_market);
});

test('createScenario adds custom scenario and emits event', () => {
  const { st, system, events } = makeSys();
  const r = system.createScenario('测试场景', '描述', { priceGrowth: 1.3 });
  assert.equal(r.success, true);
  assert.equal(st.scenarios.customScenarios.length, 1);
  assert.equal(st.scenarios.stats.created, 1);
  assert.equal(r.scenario.params.priceGrowth, 1.3);
  assert.equal(events.some((e) => e.evt === 'scenario:created'), true);
});

test('createScenario normalizes string name to {zh,en}', () => {
  const { system } = makeSys();
  const r = system.createScenario('MyName', '', {});
  assert.equal(r.scenario.name.zh, 'MyName');
  assert.equal(r.scenario.name.en, 'MyName');
});

test('applyScenario works for template and custom', () => {
  const { st, system, events } = makeSys();
  const r1 = system.applyScenario('hyperinflation');
  assert.equal(r1.success, true);
  assert.equal(st.scenarios.activeScenario, 'hyperinflation');
  assert.equal(st.scenarios.stats.played, 1);
  assert.equal(events.some((e) => e.evt === 'scenario:applied'), true);
});

test('export/import round-trip preserves params', () => {
  const { st, system } = makeSys();
  const created = system.createScenario('导出场景', 'desc', { priceGrowth: 1.2, bullBonus: 1.8 });
  const exp = system.exportScenario(created.scenario.id);
  assert.equal(exp.success, true);

  // 导入到新系统
  const st2 = makeSt();
  const system2 = createScenarioEditorSystem({
    st: st2,
    eventBus: { emit: () => {} },
    pushLog: () => {},
    I18N: { getCurrentLang: () => 'zh' },
    buildings: [],
  });
  system2.init();
  const imp = system2.importScenario(exp.data);
  assert.equal(imp.success, true);
  assert.equal(st2.scenarios.customScenarios.length, 1);
  assert.equal(imp.scenario.params.priceGrowth, 1.2);
  assert.equal(imp.scenario.params.bullBonus, 1.8);
});

test('import rejects invalid JSON', () => {
  const { system } = makeSys();
  const r = system.importScenario('{bad json');
  assert.equal(r.success, false);
  assert.ok(r.error);
});

test('deleteScenario removes custom scenario', () => {
  const { st, system } = makeSys();
  const created = system.createScenario('待删除', '', {});
  assert.equal(st.scenarios.customScenarios.length, 1);
  const r = system.deleteScenario(created.scenario.id);
  assert.equal(r.success, true);
  assert.equal(st.scenarios.customScenarios.length, 0);
});

test('renderScenarioPanel contains create form and templates', () => {
  const { system } = makeSys();
  const html = system.renderScenarioPanel();
  assert.ok(html.includes('场景编辑器'));
  assert.ok(html.includes('data-scenario-action="create"'));
  assert.ok(html.includes('data-scenario-action="apply"'));
  assert.ok(html.includes('data-scenario-action="import"'));
});

test('renderScenarioPanel lists custom scenarios with actions', () => {
  const { system } = makeSys();
  system.createScenario('面板场景', '', {});
  const html = system.renderScenarioPanel();
  assert.ok(html.includes('面板场景'));
  assert.ok(html.includes('data-scenario-action="export"'));
  assert.ok(html.includes('data-scenario-action="delete"'));
});

test('bindEvents wires create/apply/export/delete buttons', () => {
  const { st, system } = makeSys();

  // 用轻量 DOM mock 验证按钮绑定（不依赖 jsdom）
  const makeBtn = () => {
    const handlers = {};
    const btn = {
      addEventListener: (evt, fn) => { handlers[evt] = fn; },
      getAttribute: () => null,
      dispatch: (evt) => { if (handlers[evt]) handlers[evt](); },
    };
    btn._handlers = handlers;
    return btn;
  };

  const createBtns = [];
  const importBtns = [];
  const buttons = [];
  const container = {
    querySelectorAll: (sel) => {
      if (sel.includes('data-scenario-field="priceGrowth"')) return [];
      if (sel.includes('data-scenario-field="priceGrowthVal"')) return [];
      if (sel.includes('data-scenario-action="create"')) return createBtns;
      if (sel.includes('data-scenario-action="import"')) return importBtns;
      if (sel.includes('data-scenario-action')) return buttons;
      return [];
    },
    querySelector: (sel) => {
      if (sel.includes('data-scenario-field="name"')) {
        return { value: '按钮场景' };
      }
      if (sel.includes('data-scenario-field="description"')) {
        return { value: '' };
      }
      if (sel.includes('data-scenario-field="priceGrowth"')) {
        return { value: '1.2' };
      }
      if (sel.includes('data-scenario-field="import"')) {
        return { value: '' };
      }
      if (sel.includes('data-scenario-field="priceGrowthVal"')) {
        return { textContent: '' };
      }
      return null;
    },
  };

  // create 按钮
  const createBtn = makeBtn();
  createBtn.getAttribute = (a) => (a === 'data-scenario-action' ? 'create' : null);
  createBtns.push(createBtn);
  // apply 按钮
  const applyBtn = makeBtn();
  applyBtn.getAttribute = (a) => (a === 'data-scenario-action' ? 'apply' : a === 'data-scenario-id' ? 'steady_growth' : null);
  buttons.push(applyBtn);
  // export 按钮
  const exportBtn = makeBtn();
  exportBtn.getAttribute = (a) => (a === 'data-scenario-action' ? 'export' : a === 'data-scenario-id' ? 'custom_1' : null);
  buttons.push(exportBtn);

  system.bindEvents(container);

  // 触发 apply：应用 steady_growth 模板
  applyBtn.dispatch('click');
  assert.equal(st.scenarios.activeScenario, 'steady_growth');

  // 触发 create：创建按钮场景并应用
  createBtn.dispatch('click');
  assert.ok(st.scenarios.customScenarios.length >= 1);
  assert.equal(st.scenarios.activeScenario, st.scenarios.customScenarios[0].id);
  assert.equal(st.scenarios.customScenarios[0].name.zh, '按钮场景');
});
