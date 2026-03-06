const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('run_macro_plan_regression_check outputs gate and comparison JSON', () => {
  const result = spawnSync('node', ['scripts/run_macro_plan_regression_check.js', '--switches', '80', '--seed', '7', '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.switches, 80);
  assert.equal(report.seed, 7);
  assert.ok(report.comparison.withPlan.returnPerSwitch > 0);
  assert.ok(report.comparison.withoutPlan.returnPerSwitch > 0);
  assert.equal(typeof report.comparison.liftPerSwitch, 'number');
  assert.equal(typeof report.comparison.volatilityRatio, 'number');
  assert.equal(typeof report.thresholdGate.passed, 'boolean');
});

test('run_macro_plan_regression_check exits non-zero on unknown flag', () => {
  const result = spawnSync('node', ['scripts/run_macro_plan_regression_check.js', '--bad-flag'], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /未知参数/);
  assert.match(result.stderr, /用法/);
});
