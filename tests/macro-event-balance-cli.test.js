const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('run_macro_event_balance_check prints JSON report with stable seed', () => {
  const result = spawnSync('node', ['scripts/run_macro_event_balance_check.js', '--switches', '40', '--seed', '7', '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.switches, 40);
  assert.equal(report.seed, 7);
  assert.ok(report.totalEventTriggers >= 0);
  assert.ok(report.outlookHitRate >= 0 && report.outlookHitRate <= 1);
  assert.ok(Object.hasOwn(report.eventBreakdown, 'inflation_hot'));
  assert.ok(Object.hasOwn(report.eventBreakdown, 'growth_cool'));
  assert.equal(typeof report.chainTriggers, 'number');
  assert.ok(report.preferredBreakdown && Object.hasOwn(report.preferredBreakdown, 'bank'));
  assert.equal(typeof report.netDeltaPerSwitch, 'number');
  assert.equal(typeof report.netDeltaStdPerSwitch, 'number');
  assert.ok(report.params && report.params.rewardBase > 0);
});

test('run_macro_event_balance_check exits non-zero on unknown flag', () => {
  const result = spawnSync('node', ['scripts/run_macro_event_balance_check.js', '--bad-flag'], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /未知参数/);
  assert.match(result.stderr, /用法/);
});
