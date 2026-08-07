const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = path.join('artifacts', 'test-soak-defaults');

// Windows 本机通常无 bash；该测试依赖 bash 脚本，仅在 bash 可用时执行（CI/Linux/macOS）
const bashCheck = spawnSync('bash', ['--version'], { encoding: 'utf8' });
const bashAvailable = bashCheck.status === 0;

test('verify_soak_thresholds default samples use 60s baseline', { skip: !bashAvailable && 'bash not available' }, () => {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  const result = spawnSync('bash', ['scripts/verify_soak_thresholds.sh', OUT_DIR], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const passJson = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'pass.json'), 'utf8'));
  const failJson = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'fail.json'), 'utf8'));

  assert.equal(passJson.durationSec, 60);
  assert.equal(failJson.durationSec, 60);
  assert.equal(passJson.thresholds.maxWritesStd, 3);
  assert.equal(failJson.thresholds.maxWritesStd, 1);

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
});
