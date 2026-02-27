const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = path.join('artifacts', 'test-soak-fallback');

test('verify_soak_thresholds supports node fallback extraction', () => {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  const result = spawnSync('bash', ['scripts/verify_soak_thresholds.sh', OUT_DIR], {
    env: { ...process.env, VERIFY_SOAK_DISABLE_PYTHON: '1' },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(fs.existsSync(path.join(OUT_DIR, 'pass.json')));
  assert.ok(fs.existsSync(path.join(OUT_DIR, 'fail.json')));
  assert.ok(fs.existsSync(path.join(OUT_DIR, 'invalid.log')));

  const passJson = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'pass.json'), 'utf8'));
  const failJson = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'fail.json'), 'utf8'));

  assert.equal(passJson.checks.writesStdOk, true);
  assert.equal(failJson.checks.writesStdOk, false);

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
});
