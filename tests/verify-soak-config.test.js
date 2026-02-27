const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = path.join('artifacts', 'test-soak-config');

test('verify_soak_thresholds honors configurable sample commands', () => {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  const env = {
    ...process.env,
    VERIFY_SOAK_PASS_CMD: 'node scripts/run_soak_check.js --seconds 30 --max-writes-std 3',
    VERIFY_SOAK_FAIL_CMD: 'node scripts/run_soak_check.js --seconds 10 --max-writes-std 1',
    VERIFY_SOAK_INVALID_CMD: 'node scripts/run_soak_check.js --bad-flag',
  };

  const result = spawnSync('bash', ['scripts/verify_soak_thresholds.sh', OUT_DIR], {
    env,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const passJson = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'pass.json'), 'utf8'));
  const failJson = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'fail.json'), 'utf8'));
  const invalidLog = fs.readFileSync(path.join(OUT_DIR, 'invalid.log'), 'utf8');

  assert.equal(passJson.durationSec, 30);
  assert.equal(passJson.thresholds.maxWritesStd, 3);
  assert.equal(passJson.checks.writesStdOk, true);

  assert.equal(failJson.durationSec, 10);
  assert.equal(failJson.thresholds.maxWritesStd, 1);
  assert.equal(failJson.checks.writesStdOk, false);

  assert.match(invalidLog, /未知参数: --bad-flag/);

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
});
