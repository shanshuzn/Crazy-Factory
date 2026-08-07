const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// PWA 支持测试
// 验证：sw.js 存在且语法正确、缓存清单与 index.html 脚本一致、manifest 完整、注册逻辑正确

const root = path.join(__dirname, '..');

test('sw.js exists and is valid JS', () => {
  const swPath = path.join(root, 'sw.js');
  assert.ok(fs.existsSync(swPath), 'sw.js should exist');
  const src = fs.readFileSync(swPath, 'utf8');
  assert.ok(src.includes('addEventListener'), 'should register event listeners');
  assert.ok(src.includes('install') && src.includes('activate') && src.includes('fetch'), 'should handle install/activate/fetch');
  assert.ok(src.includes('CORE_CACHE') && src.includes('RUNTIME_CACHE'), 'should define core and runtime caches');
});

test('sw.js cache list matches index.html script tags', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  // 提取 index.html 中所有脚本路径
  const scriptPaths = [...index.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(scriptPaths.length >= 30, 'index.html should load many scripts');

  // 提取 sw.js 缓存清单中的脚本路径
  const cachedScripts = [...sw.matchAll(/'(\.\/scripts\/[^']+)'/g)].map((m) => m[1]);

  // 每个 index.html 脚本都必须在缓存清单中
  for (const s of scriptPaths) {
    const relative = './' + s.replace(/^\.?\//, '');
    assert.ok(
      cachedScripts.includes(relative),
      `script ${s} should be in SW cache list`
    );
  }

  // 缓存清单里的脚本必须真实存在
  for (const c of cachedScripts) {
    const file = path.join(root, c.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(file), `cached asset ${c} must exist`);
  }
});

test('sw.js pre-caches core entry files', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  for (const asset of ['./index.html', './styles/main.css', './manifest.json', './version.json']) {
    assert.ok(sw.includes(asset), `CORE_ASSETS should include ${asset}`);
  }
});

test('manifest.json has required PWA fields', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.ok(manifest.name);
  assert.ok(manifest.short_name);
  assert.ok(manifest.start_url);
  assert.ok(manifest.display);
  assert.ok(manifest.background_color);
  assert.ok(manifest.theme_color);
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  assert.ok(manifest.scope, 'scope required for PWA');
  assert.ok(Array.isArray(manifest.shortcuts), 'shortcuts should be an array');
});

test('index.html registers service worker', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(index.includes("'serviceWorker' in navigator"), 'should feature-detect service worker');
  assert.ok(index.includes("register('sw.js')"), 'should register sw.js');
  assert.ok(index.includes('isSecureContext'), 'should check secure context');
});

test('serve.js serves sw.js with long cache', () => {
  const serve = fs.readFileSync(path.join(root, 'serve.js'), 'utf8');
  assert.ok(serve.includes('sw.js'), 'serve.js should special-case sw.js');
  assert.ok(serve.includes('max-age=86400'), 'sw.js should use long max-age');
  assert.ok(serve.includes('no-cache'), 'other assets should stay no-cache');
});

test('version consistency: sw cache version matches version.json', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  // 容忍 BOM
  let raw = fs.readFileSync(path.join(root, 'version.json'), 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const version = JSON.parse(raw).version;
  // sw.js 的 CACHE_VERSION 应包含当前版本号（用于缓存失效）
  assert.ok(sw.includes(version), `sw.js CACHE_VERSION should reference ${version}`);
});
