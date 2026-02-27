const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('run_soak_check exits non-zero and prints help on unknown flag', () => {
  const result = spawnSync('node', ['scripts/run_soak_check.js', '--bad-flag'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const combined = `${result.stdout}\n${result.stderr}`;
  assert.match(combined, /未知参数: --bad-flag/);
  assert.match(combined, /用法:/);
  assert.match(combined, /--help/);
});
