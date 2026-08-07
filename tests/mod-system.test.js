const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Mod 系统测试
// 验证 createModSystem 的注册/生命周期钩子/启用禁用/事件订阅/持久化/面板渲染

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'mod-system.js'), 'utf8');

function makeSandbox() {
  const storage = {};
  const listeners = {};
  const sandbox = {
    console, Math, Date, JSON, isFinite, Number, Object, Array, Map, Set, Promise,
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = v; },
      removeItem: (k) => { delete storage[k]; },
    },
    _storage: storage,
    _listeners: listeners,
    module: { exports: {} },
    exports: {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'mod-system.js' });
  return sandbox;
}

function makeSys(sandbox, st) {
  const listeners = new Map();
  const eventBus = {
    on: (event, handler) => {
      const bucket = listeners.get(event) || [];
      bucket.push(handler);
      listeners.set(event, bucket);
    },
    emit: (event, payload) => {
      (listeners.get(event) || []).forEach((fn) => fn(payload));
      (listeners.get('*') || []).forEach((fn) => fn(event, payload));
    },
  };
  const logs = [];
  const system = sandbox.module.exports.createModSystem({
    st,
    eventBus,
    pushLog: (msg) => logs.push(msg),
  });
  return { system, eventBus, logs, listeners };
}

test('register adds mod and returns success', () => {
  const sandbox = makeSandbox();
  const st = { gears: 0 };
  const { system } = makeSys(sandbox, st);
  const r = system.register({ id: 'm1', name: 'Test Mod', version: '1.0.0', description: 'd' });
  assert.equal(r.success, true);
  assert.equal(system.getCount(), 1);
  const mods = system.getMods();
  assert.equal(mods[0].id, 'm1');
  assert.equal(mods[0].enabled, true);
});

test('register rejects duplicate ids', () => {
  const sandbox = makeSandbox();
  const { system } = makeSys(sandbox, {});
  system.register({ id: 'dup', name: 'a' });
  const r = system.register({ id: 'dup', name: 'b' });
  assert.equal(r.success, false);
  assert.ok(r.error.includes('duplicate'));
});

test('register requires id', () => {
  const sandbox = makeSandbox();
  const { system } = makeSys(sandbox, {});
  const r = system.register({ name: 'no id' });
  assert.equal(r.success, false);
  assert.ok(r.error.includes('id'));
});

test('onLoad is called on register', () => {
  const sandbox = makeSandbox();
  const st = { gears: 10 };
  const { system, logs } = makeSys(sandbox, st);
  let loaded = false;
  system.register({
    id: 'loader', name: 'L',
    onLoad(ctx) { loaded = true; ctx.log('hello'); assert.equal(ctx.st, st); },
  });
  assert.equal(loaded, true);
  assert.ok(logs.some((m) => m.includes('hello')));
});

test('onUpdate is called each frame', () => {
  const sandbox = makeSandbox();
  const st = { gears: 0 };
  const { system } = makeSys(sandbox, st);
  let updates = 0;
  system.register({
    id: 'updater', name: 'U',
    onUpdate(dt, ctx) { updates++; ctx.st.gears += dt; },
  });
  system.update(0.5);
  system.update(1.0);
  assert.equal(updates, 2);
  assert.ok(Math.abs(st.gears - 1.5) < 1e-9);
});

test('disabled mod does not run onUpdate', () => {
  const sandbox = makeSandbox();
  const { system } = makeSys(sandbox, {});
  let updates = 0;
  system.register({ id: 'd', name: 'D', onUpdate: () => { updates++; } });
  system.setEnabled('d', false);
  system.update(0.1);
  assert.equal(updates, 0);
  assert.equal(system.isEnabled('d'), false);
});

test('re-enable restarts mod and runs onLoad again', () => {
  const sandbox = makeSandbox();
  const { system } = makeSys(sandbox, {});
  let loads = 0;
  system.register({ id: 're', name: 'R', onLoad: () => { loads++; } });
  system.setEnabled('re', false);
  system.setEnabled('re', true);
  assert.equal(loads, 2);
  assert.equal(system.isEnabled('re'), true);
});

test('remove deletes mod entirely', () => {
  const sandbox = makeSandbox();
  const { system } = makeSys(sandbox, {});
  system.register({ id: 'rm', name: 'R' });
  const r = system.remove('rm');
  assert.equal(r.success, true);
  assert.equal(system.getCount(), 0);
  assert.equal(system.getMod('rm'), null);
});

test('onEvent receives game events via eventBus wildcard', () => {
  const sandbox = makeSandbox();
  const st = {};
  const { system, eventBus } = makeSys(sandbox, st);
  const received = [];
  system.register({
    id: 'ev', name: 'E',
    onEvent(name, payload, ctx) { received.push({ name, payload }); },
  });
  eventBus.emit('market:switched', { bull: true });
  eventBus.emit('building:purchased', { id: 'b1' });
  assert.equal(received.length, 2);
  assert.equal(received[0].name, 'market:switched');
  assert.equal(received[0].payload.bull, true);
  assert.equal(received[1].name, 'building:purchased');
  assert.equal(received[1].payload.id, 'b1');
});

test('enabled state persists to localStorage', () => {
  const sandbox = makeSandbox();
  const st = {};
  const { system } = makeSys(sandbox, st);
  system.register({ id: 'p1', name: 'P1' });
  system.register({ id: 'p2', name: 'P2' });
  system.setEnabled('p2', false);
  // 持久化键已写入，保存的是"已启用"的 id 列表
  assert.ok(sandbox._storage['cf_mods_v1']);
  const stored = JSON.parse(sandbox._storage['cf_mods_v1']);
  assert.deepEqual(stored, ['p1']);
});

test('renderPanel lists mods with toggle/remove actions', () => {
  const sandbox = makeSandbox();
  const { system } = makeSys(sandbox, {});
  system.register({ id: 'rp', name: 'Panel Mod', version: '2.0.0', description: 'desc' });
  const html = system.renderPanel('zh');
  assert.ok(html.includes('Mod 管理器'));
  assert.ok(html.includes('Panel Mod'));
  assert.ok(html.includes('data-mod-action="toggle"'));
  assert.ok(html.includes('data-mod-action="remove"'));
  assert.ok(html.includes('data-mod-id="rp"'));
});

test('bindEvents wires toggle and remove buttons', () => {
  const sandbox = makeSandbox();
  const { system } = makeSys(sandbox, {});

  // 轻量 DOM mock：每个按钮独立闭包持有自己的回调
  const makeBtn = (action, id) => {
    const b = { _cb: null };
    b.getAttribute = (a) => (a === 'data-mod-action' ? action : a === 'data-mod-id' ? id : null);
    b.addEventListener = (evt, fn) => { b._cb = fn; };
    return b;
  };

  const container = {
    _buttons: [],
    querySelectorAll: () => container._buttons,
    innerHTML: null,
    addEventListener: () => {},
  };

  system.register({ id: 't1', name: 'T1' });
  system.register({ id: 't2', name: 'T2' });

  // 模拟 toggle 按钮点击
  const toggleBtn = makeBtn('toggle', 't1');
  container._buttons = [toggleBtn];
  system.bindEvents(container);
  toggleBtn._cb();
  assert.equal(system.isEnabled('t1'), false);

  // 模拟 remove 按钮点击
  const removeBtn = makeBtn('remove', 't2');
  container._buttons = [removeBtn];
  system.bindEvents(container);
  removeBtn._cb();
  assert.equal(system.getCount(), 1);
});
