const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Task 4.3: 存档往返测试
// 验证 save-system.js 的存档白名单包含所有子系统状态

const saveSystemPath = path.join(__dirname, '..', 'scripts', 'save-system.js');
const source = fs.readFileSync(saveSystemPath, 'utf8');

// 需要持久化的子系统状态
const REQUIRED_SUBSYSTEMS = [
  'derivatives',
  'crisis',
  'guild',
  'boost',
  'subscription',
  'globalMarket',
  'assetAllocation',  // v1.0 资产配置系统
  'scenarios',        // UGC 场景编辑器
];

test('_TOP_LEVEL_FIELDS includes all subsystem states', () => {
  // 提取 _TOP_LEVEL_FIELDS 数组内容
  const match = source.match(/const _TOP_LEVEL_FIELDS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, '_TOP_LEVEL_FIELDS should be defined');

  const fieldsStr = match[1];
  for (const subsystem of REQUIRED_SUBSYSTEMS) {
    assert.ok(
      fieldsStr.includes(`'${subsystem}'`) || fieldsStr.includes(`"${subsystem}"`),
      `_TOP_LEVEL_FIELDS should include '${subsystem}'`
    );
  }
});

test('_makeFullSaveData includes all subsystem states', () => {
  // 提取 _makeFullSaveData 函数体
  const match = source.match(/const _makeFullSaveData\s*=\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\);/);
  assert.ok(match, '_makeFullSaveData should be defined');

  const bodyStr = match[1];
  for (const subsystem of REQUIRED_SUBSYSTEMS) {
    assert.ok(
      bodyStr.includes(`${subsystem}:`),
      `_makeFullSaveData should include '${subsystem}:' field`
    );
  }
});

test('_fastHash keys include all subsystem states', () => {
  // 提取 _fastHash 的 keys 数组
  const match = source.match(/const keys\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, 'keys array should be defined in _fastHash');

  const keysStr = match[1];
  for (const subsystem of REQUIRED_SUBSYSTEMS) {
    assert.ok(
      keysStr.includes(`'${subsystem}'`) || keysStr.includes(`"${subsystem}"`),
      `_fastHash keys should include '${subsystem}'`
    );
  }
});

test('loadGame restores all subsystem states with null safety', () => {
  // 提取 loadGame 函数体
  const match = source.match(/const loadGame\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s{4}\};/);
  assert.ok(match, 'loadGame should be defined');

  const bodyStr = match[1];
  for (const subsystem of REQUIRED_SUBSYSTEMS) {
    // 检查条件恢复模式: if(d.xxx && typeof d.xxx === "object")
    const pattern = new RegExp(`if\\s*\\(\\s*d\\.${subsystem}`);
    assert.ok(
      pattern.test(bodyStr),
      `loadGame should have conditional restoration for '${subsystem}'`
    );
  }
});

test('subsystem restoration uses spread merge pattern', () => {
  // 验证恢复逻辑使用 {...st.xxx, ...d.xxx} 模式（保留默认值）
  for (const subsystem of REQUIRED_SUBSYSTEMS) {
    const pattern = new RegExp(`st\\.${subsystem}\\s*=\\s*\\{[^}]*\\.\\.\\.\\s*st\\.${subsystem}[^}]*\\.\\.\\.\\s*d\\.${subsystem}`);
    assert.ok(
      pattern.test(source),
      `loadGame should use spread merge for '${subsystem}': {...st.${subsystem}, ...d.${subsystem}}`
    );
  }
});
