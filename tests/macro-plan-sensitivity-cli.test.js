const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('run_macro_plan_sensitivity_scan outputs matrix and safe zone', () => {
  const result = spawnSync('node', [
    'scripts/run_macro_plan_sensitivity_scan.js',
    '--switches', '120',
    '--seed', '7',
    '--bonus-set', '0.08,0.12',
    '--cost-set', '0.01,0.02',
    '--no-archive',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.totalCombos, 4);
  assert.equal(report.records.length, 4);
  assert.ok(report.passCount >= 1);
  assert.ok(Array.isArray(report.safeZone.preferredBonus));
  assert.ok(Array.isArray(report.safeZone.planSwitchCost));
});

test('run_macro_plan_sensitivity_scan exits non-zero on unknown flag', () => {
  const result = spawnSync('node', ['scripts/run_macro_plan_sensitivity_scan.js', '--bad-flag'], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /未知参数/);
  assert.match(result.stderr, /用法/);
});

test('run_macro_plan_sensitivity_scan ci-summary returns first failing combo when present', () => {
  const result = spawnSync('node', [
    'scripts/run_macro_plan_sensitivity_scan.js',
    '--switches', '200',
    '--seed', '42',
    '--bonus-set', '0.16',
    '--cost-set', '0.01',
    '--no-archive',
    '--ci-summary',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.totalCombos, 1);
  assert.equal(report.failCount, 1);
  assert.ok(report.firstFailingCombo);
  assert.equal(report.firstFailingCombo.passed, false);
});

test('run_macro_plan_sensitivity_scan writes archive and emits trend diff against previous run', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'macro-scan-'));
  const archiveFile = path.join(tmpDir, 'latest.json');

  const first = spawnSync('node', [
    'scripts/run_macro_plan_sensitivity_scan.js',
    '--switches', '120',
    '--seed', '7',
    '--bonus-set', '0.08,0.12',
    '--cost-set', '0.01,0.02',
    '--archive-file', archiveFile,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(fs.existsSync(archiveFile), true);

  const second = spawnSync('node', [
    'scripts/run_macro_plan_sensitivity_scan.js',
    '--switches', '120',
    '--seed', '7',
    '--bonus-set', '0.08',
    '--cost-set', '0.01',
    '--archive-file', archiveFile,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(second.status, 0, second.stderr || second.stdout);
  const report = JSON.parse(second.stdout);
  assert.equal(typeof report.trendDiff.previousPassCount, 'number');
  assert.equal(typeof report.trendDiff.passCountDelta, 'number');
});
