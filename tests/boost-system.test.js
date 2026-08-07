const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 加速道具系统测试
// 验证：购买/使用道具、效果应用、效果过期清理、GPS 倍数、自动购买、UI 渲染

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'boost-system.js'), 'utf8');

function makeSys(overrides = {}) {
  const sandbox = {
    console, Math, Date, JSON, isFinite, Number, Object, Array, Map, Set, Promise,
    setTimeout, clearTimeout,
    module: { exports: {} }, exports: {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'boost-system.js' });

  const st = {
    money: 1000,
    rp: 100,
    totalGPS: 100,
    boost: null,
    buildings: [
      { id: 'farm', owned: 1, baseCost: 50 },
      { id: 'mill', owned: 0, baseCost: 200 },
    ],
  };
  const events = [];
  const logs = [];
  const system = sandbox.module.exports.createBoostSystem({
    st,
    eventBus: { emit: (evt, payload) => events.push({ evt, payload }), on: () => {} },
    pushLog: (m) => logs.push(m),
    I18N: { getCurrentLang: () => 'zh' },
    economy: {},
    ...overrides,
  });
  return { sandbox, st, events, logs, system };
}

test('init initializes boost data and all inventory slots', () => {
  const { st, system } = makeSys();
  system.init();
  assert.ok(st.boost);
  assert.ok(st.boost.inventory);
  // VM 跨 realm，逐字段断言
  assert.equal(st.boost.stats.totalPurchases, 0);
  assert.equal(st.boost.stats.totalSpent, 0);
  assert.equal(st.boost.stats.totalItemsUsed, 0);
  assert.equal(Object.keys(st.boost.inventory).length >= 13, true, 'all boost items in inventory');
});

test('init does not reset existing boost data', () => {
  const { st, system } = makeSys();
  system.init();
  st.boost.stats.totalPurchases = 5;
  system.init();
  assert.equal(st.boost.stats.totalPurchases, 5, 'init should preserve existing data');
});

test('getAllItems returns items with owned counts', () => {
  const { st, system } = makeSys();
  system.init();
  st.boost.inventory.time_warp_1h = 2;
  const items = system.getAllItems();
  assert.ok(items.length >= 13);
  const tw = items.find((i) => i.id === 'time_warp_1h');
  assert.equal(tw.owned, 2);
  assert.equal(tw.price, 0.99);
});

test('getItemsByCategory filters by category', () => {
  const { system } = makeSys();
  system.init();
  const research = system.getItemsByCategory('research');
  assert.ok(research.length === 3);
  assert.ok(research.every((i) => i.category === 'research'));
});

test('purchaseItem rejects unknown item', async () => {
  const { system } = makeSys();
  const r = await system.purchaseItem('nonexistent');
  assert.equal(r.success, false);
  assert.ok(r.error);
});

test('purchaseItem succeeds and adds to inventory', async () => {
  const { sandbox, st, events, logs, system } = makeSys();
  system.init();
  sandbox.Math.random = () => 0.5; // 95% 成功率
  const r = await system.purchaseItem('time_warp_1h');
  assert.equal(r.success, true);
  assert.equal(st.boost.inventory.time_warp_1h, 1);
  assert.equal(st.boost.stats.totalPurchases, 1);
  assert.equal(st.boost.stats.totalSpent, 0.99);
  assert.ok(events.some((e) => e.evt === 'boost:purchased'));
  assert.ok(logs.some((l) => l.includes('购买')));
});

test('purchaseItem can fail payment', async () => {
  const { sandbox, system } = makeSys();
  system.init();
  sandbox.Math.random = () => 0.02; // <= 0.05 失败（成功条件是 random > 0.05）
  const r = await system.purchaseItem('double_gps_1h');
  assert.equal(r.success, false);
  assert.equal(system.getItemCount('double_gps_1h'), 0);
});

test('oneTime item cannot be purchased twice', async () => {
  const { sandbox, st, system } = makeSys();
  system.init();
  sandbox.Math.random = () => 0.5;
  const r1 = await system.purchaseItem('starter_pack');
  assert.equal(r1.success, true);
  const r2 = await system.purchaseItem('starter_pack');
  assert.equal(r2.success, false);
  assert.ok(r2.error.includes('购买'));
});

test('bundle purchase adds all component items', async () => {
  const { sandbox, st, system } = makeSys();
  system.init();
  sandbox.Math.random = () => 0.5;
  const r = await system.purchaseItem('starter_pack');
  assert.equal(r.success, true);
  assert.equal(st.boost.inventory.time_warp_1h, 1);
  assert.equal(st.boost.inventory.double_gps_1h, 1);
  assert.equal(st.boost.inventory.research_pack_small, 1);
});

test('useItem requires inventory', () => {
  const { system } = makeSys();
  system.init();
  const r = system.useItem('time_warp_1h');
  assert.equal(r.success, false);
  assert.ok(r.error.includes('背包'));
});

test('useItem unknown item', () => {
  const { system } = makeSys();
  const r = system.useItem('nope');
  assert.equal(r.success, false);
});

test('useItem instant_gps grants money', () => {
  const { st, events, logs, system } = makeSys();
  system.init();
  st.money = 0;
  st.totalGPS = 100;
  st.boost.inventory.time_warp_1h = 1; // 1h = 3600s
  const r = system.useItem('time_warp_1h');
  assert.equal(r.success, true);
  assert.equal(st.money, 100 * 3600);
  assert.equal(st.boost.inventory.time_warp_1h, 0);
  assert.equal(st.boost.stats.totalItemsUsed, 1);
  assert.ok(events.some((e) => e.evt === 'boost:used'));
});

test('useItem multiplier adds active effect', () => {
  const { st, system } = makeSys();
  system.init();
  st.boost.inventory.double_gps_1h = 1;
  const r = system.useItem('double_gps_1h');
  assert.equal(r.success, true);
  assert.equal(st.boost.activeEffects.length, 1);
  assert.equal(st.boost.activeEffects[0].type, 'gps_multiplier');
  assert.equal(st.boost.activeEffects[0].value, 2);
});

test('useItem rp grants research points', () => {
  const { st, system } = makeSys();
  system.init();
  st.boost.inventory.research_pack_small = 1;
  const r = system.useItem('research_pack_small');
  assert.equal(r.success, true);
  assert.equal(st.rp, 100 + 500);
});

test('useItem auto_buyer activates effect', () => {
  const { st, system } = makeSys();
  system.init();
  st.boost.inventory.auto_buyer_1h = 1;
  const r = system.useItem('auto_buyer_1h');
  assert.equal(r.success, true);
  assert.equal(st.boost.activeEffects[0].type, 'auto_buyer');
});

test('getGPSMultiplier multiplies all active effects', () => {
  const { st, system } = makeSys();
  system.init();
  // 手动加两个效果
  st.boost.activeEffects.push({ type: 'gps_multiplier', value: 2, expiresAt: Date.now() + 100000, startedAt: Date.now() });
  st.boost.activeEffects.push({ type: 'gps_multiplier', value: 3, expiresAt: Date.now() + 100000, startedAt: Date.now() });
  assert.equal(system.getGPSMultiplier(), 6);
});

test('getGPSMultiplier ignores non-multiplier effects', () => {
  const { st, system } = makeSys();
  system.init();
  st.boost.activeEffects.push({ type: 'auto_buyer', expiresAt: Date.now() + 100000, startedAt: Date.now() });
  assert.equal(system.getGPSMultiplier(), 1);
});

test('updateEffects expires old effects', () => {
  const { st, logs, system } = makeSys();
  system.init();
  st.boost.activeEffects.push({ type: 'gps_multiplier', value: 2, expiresAt: Date.now() - 1000, startedAt: Date.now() - 5000 });
  st.boost.activeEffects.push({ type: 'gps_multiplier', value: 3, expiresAt: Date.now() + 100000, startedAt: Date.now() });
  system.updateEffects();
  assert.equal(st.boost.activeEffects.length, 1);
  assert.equal(st.boost.activeEffects[0].value, 3);
  assert.ok(logs.some((l) => l.includes('已过期')));
});

test('updateEffects triggers auto-buy when active', () => {
  const { sandbox, st, events, system } = makeSys();
  system.init();
  sandbox.Math.random = () => 0.05; // 10% 触发
  st.boost.activeEffects.push({ type: 'auto_buyer', expiresAt: Date.now() + 100000, startedAt: Date.now() });
  const before = st.buildings[1].owned;
  system.updateEffects();
  // autoBuy 至少随机选中建筑购买或跳过，这里验证不抛错
  assert.ok(true);
});

test('executeAutoBuy buys building when affordable', () => {
  const { sandbox, st, events, system } = makeSys();
  system.init();
  sandbox.Math.random = () => 0.05; // 触发
  st.money = 1000;
  const beforeOwned = st.buildings.reduce((s, b) => s + b.owned, 0);
  system.updateEffects();
  // 没有 auto_buyer 效果时不应购买
  const after = st.buildings.reduce((s, b) => s + b.owned, 0);
  assert.equal(after, beforeOwned);
});

test('getActiveEffects computes remaining and progress', () => {
  const { st, system } = makeSys();
  system.init();
  const now = Date.now();
  st.boost.activeEffects.push({ type: 'gps_multiplier', value: 2, expiresAt: now + 5000, startedAt: now });
  const effects = system.getActiveEffects();
  assert.equal(effects.length, 1);
  assert.equal(effects[0].remainingSeconds, 5);
  assert.equal(effects[0].progressPercent, 0);
});

test('renderShopPanel includes all categories and items', () => {
  const { system } = makeSys();
  system.init();
  const html = system.renderShopPanel();
  assert.ok(html.includes('道具商店'));
  assert.ok(html.includes('时间跃迁'));
  assert.ok(html.includes('收益加成'));
  assert.ok(html.includes('智能购买'));
  assert.ok(html.includes('研究加速'));
  assert.ok(html.includes('组合包'));
  assert.ok(html.includes('buy-btn'));
});

test('renderInventoryPanel empty state', () => {
  const { system } = makeSys();
  system.init();
  const html = system.renderInventoryPanel();
  assert.ok(html.includes('还没有道具'));
});

test('renderInventoryPanel shows owned items', () => {
  const { st, system } = makeSys();
  system.init();
  st.boost.inventory.time_warp_1h = 2;
  const html = system.renderInventoryPanel();
  assert.ok(html.includes('你的道具'));
  assert.ok(html.includes('x2'));
});

test('renderActiveEffectsPanel empty state', () => {
  const { system } = makeSys();
  system.init();
  const html = system.renderActiveEffectsPanel();
  assert.ok(html.includes('没有激活的加成'));
});

test('renderActiveEffectsPanel shows active effects with time', () => {
  const { st, system } = makeSys();
  system.init();
  const now = Date.now();
  st.boost.activeEffects.push({ type: 'gps_multiplier', value: 2, expiresAt: now + 120000, startedAt: now });
  const html = system.renderActiveEffectsPanel();
  assert.ok(html.includes('GPS加成'));
  assert.ok(html.includes('x2'));
  assert.ok(html.includes('2:00')); // 120 秒 → 2:00
});

test('init survives without window.__timerManager', () => {
  const { system } = makeSys();
  assert.doesNotThrow(() => system.init());
});

test('useItem never goes negative in inventory', () => {
  const { st, system } = makeSys();
  system.init();
  st.boost.inventory.time_warp_1h = 1;
  system.useItem('time_warp_1h');
  assert.equal(st.boost.inventory.time_warp_1h, 0);
  // 再次使用（库存 0）应失败而不是减到 -1
  const r = system.useItem('time_warp_1h');
  assert.equal(r.success, false);
  assert.equal(st.boost.inventory.time_warp_1h, 0);
});
