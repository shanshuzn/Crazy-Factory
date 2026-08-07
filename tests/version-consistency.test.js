const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 版本一致性测试
// 守护：scripts/version.js（单一来源）与以下位置保持一致：
//  - version.json
//  - scripts/game.js（APP_VERSION）
//  - scripts/debug-system.js（面板版本显示）
//  - sw.js（CACHE_VERSION）
//  - site/index.html（badge 与 footer）
// 升级版本时若漏改任何一处，本测试将失败。

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('version.js is the single source of truth', () => {
  const src = read('scripts/version.js');
  assert.match(src, /CF_VERSION\s*=\s*'v[\d]+\.[\d]+\.[\d]+'/, 'CF_VERSION should be defined in version.js');
  assert.match(src, /CF_CHANGELOG\s*=/, 'CF_CHANGELOG should be defined');
});

test('version.js matches version.json', () => {
  const vjs = read('scripts/version.js');
  const version = vjs.match(/CF_VERSION\s*=\s*'([^']+)'/)[1];
  let raw = read('version.json');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const jsonVersion = JSON.parse(raw).version;
  assert.equal(version, jsonVersion, `version.js (${version}) should match version.json (${jsonVersion})`);
});

test('game.js APP_VERSION matches version.js', () => {
  const vjs = read('scripts/version.js');
  const version = vjs.match(/CF_VERSION\s*=\s*'([^']+)'/)[1];
  const game = read('scripts/game.js');
  // game.js 从 window.CF_VERSION 读取，但保留硬编码回退值，须与 CF_VERSION 一致
  const fallback = game.match(/window\.CF_VERSION\)\s*\|\|\s*'([^']+)'/);
  assert.ok(fallback, 'game.js should have a fallback version after window.CF_VERSION');
  assert.equal(fallback[1], version, `game.js fallback (${fallback[1]}) should match version.js (${version})`);
});

test('debug-system.js displays version from CF_VERSION (no hardcoded vX.Y.Z)', () => {
  const debug = read('scripts/debug-system.js');
  // 不应再出现硬编码的完整版本号（如 v2.15.0-debug）
  assert.ok(!/\bv\d+\.\d+\.\d+-debug\b/.test(debug), 'debug-system should not hardcode version');
  assert.ok(debug.includes('CF_VERSION'), 'debug-system should read from window.CF_VERSION');
});

test('sw.js CACHE_VERSION matches version.js', () => {
  const vjs = read('scripts/version.js');
  const version = vjs.match(/CF_VERSION\s*=\s*'([^']+)'/)[1];
  const sw = read('sw.js');
  const cache = sw.match(/CACHE_VERSION\s*=\s*'cf-([^']+)'/);
  assert.ok(cache, 'sw.js should define CACHE_VERSION with cf- prefix');
  assert.equal(cache[1], version, `sw.js cache (cf-${cache[1]}) should match version.js (${version})`);
});

test('site/index.html badge matches version.js', () => {
  const vjs = read('scripts/version.js');
  const version = vjs.match(/CF_VERSION\s*=\s*'([^']+)'/)[1];
  const site = read('site/index.html');
  const badge = site.match(/class="badge">v([\d]+\.[\d]+\.[\d]+)/);
  assert.ok(badge, 'site badge should have a version');
  assert.equal('v' + badge[1], version, `site badge (v${badge[1]}) should match version.js (${version})`);
});

test('site/index.html footer matches version.js', () => {
  const vjs = read('scripts/version.js');
  const version = vjs.match(/CF_VERSION\s*=\s*'([^']+)'/)[1];
  const site = read('site/index.html');
  const footer = site.match(/金融帝国 v([\d]+\.[\d]+\.[\d]+) \| MIT/);
  assert.ok(footer, 'site footer should have a version');
  assert.equal('v' + footer[1], version, `site footer (v${footer[1]}) should match version.js (${version})`);
});

test('CHANGELOG latest entry matches CF_VERSION', () => {
  const vjs = read('scripts/version.js');
  const version = vjs.match(/CF_VERSION\s*=\s*'([^']+)'/)[1];
  const firstEntry = vjs.match(/\{ version: '([^']+)', date: /);
  assert.ok(firstEntry, 'CHANGELOG should have entries');
  assert.equal(firstEntry[1], version, `CHANGELOG latest (${firstEntry[1]}) should match CF_VERSION (${version})`);
});

test('version.js is cached by sw.js', () => {
  const sw = read('sw.js');
  assert.ok(sw.includes('./scripts/version.js'), 'sw.js CORE_ASSETS should include version.js');
});

test('version.js is loaded before game.js in index.html', () => {
  const index = read('index.html');
  const versionPos = index.indexOf('scripts/version.js');
  const gamePos = index.indexOf('scripts/game.js');
  assert.ok(versionPos >= 0 && gamePos >= 0);
  assert.ok(versionPos < gamePos, 'version.js must load before game.js');
});
