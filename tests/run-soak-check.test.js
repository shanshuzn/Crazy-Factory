const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

function runSoak(args) {
  const ret = spawnSync(process.execPath, ['scripts/run_soak_check.js', ...args], {
    encoding: 'utf8',
  });

  assert.match(ret.stdout, /SOAK_REPORT/);
  const lines = ret.stdout.trim().split('\n');
  const jsonText = lines.slice(1).join('\n');
  return {
    status: ret.status,
    report: JSON.parse(jsonText),
  };
}

test('soak check exits 0 when metrics satisfy thresholds', () => {
  const { status, report } = runSoak(['--seconds', '5', '--min-fps', '1', '--max-heap-mb', '1024', '--max-writes-std', '10']);
  assert.equal(status, 0);
  assert.equal(report.checks.fpsOk, true);
  assert.equal(report.checks.heapOk, true);
  assert.equal(report.checks.writesStdOk, true);
});

test('soak check exits non-zero when threshold check fails', () => {
  const { status, report } = runSoak(['--seconds', '5', '--max-heap-mb', '1']);
  assert.equal(status, 1);
  assert.equal(report.checks.heapOk, false);
});
