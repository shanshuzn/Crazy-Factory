const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('run_macro_plan_sensitivity_scan outputs matrix and safe zone', () => {
  const result = spawnSync('node', [
    'scripts/run_macro_plan_sensitivity_scan.js',
    '--switches', '120',
    '--seed', '7',
    '--bonus-set', '0.08,0.12',
    '--cost-set', '0.01,0.02',
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
    '--ci-summary',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.totalCombos, 1);
  assert.equal(report.failCount, 1);
  assert.ok(report.firstFailingCombo);
  assert.equal(report.firstFailingCombo.passed, false);
});
