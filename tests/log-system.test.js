const test = require('node:test');
const assert = require('node:assert/strict');

const { createLogSystem } = require('../scripts/log-system.js');

test('log system trims to cap and inserts trim notice once', () => {
  const st = { logs: [], logTrimNotified: false };
  const dirty = { logs: false };
  let t = 0;
  const { pushLog } = createLogSystem({
    st,
    dirty,
    LOG_CAP: 3,
    getNowTag: () => `[T${++t}]`,
  });

  pushLog('A');
  pushLog('B');
  pushLog('C');
  pushLog('D');

  assert.equal(st.logs.length, 3);
  assert.equal(st.logTrimNotified, true);
  assert.equal(
    st.logs[0],
    '[T4] （系统）日志已达上限 3 条，较早记录已裁剪',
  );
  assert.equal(st.logs[1], '[T4] D');
  assert.equal(st.logs[2], '[T3] C');
  assert.equal(dirty.logs, true);

  pushLog('E');
  assert.equal(st.logs.length, 3);
  assert.equal(st.logs.filter((l) => l.includes('日志已达上限')).length, 1);
  assert.equal(st.logs[0], '[T5] E');
});
