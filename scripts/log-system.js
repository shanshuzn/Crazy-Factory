// 日志系统（纯函数注入时间源）
(function initLogSystem(globalScope) {
  const createLogSystem = ({ st, dirty, LOG_CAP, getNowTag }) => {
    const nowTag = () => (typeof getNowTag === 'function'
      ? getNowTag()
      : `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}]`);

    const pushLog = (msg) => {
      const tag = nowTag();
      st.logs.unshift(`${tag} ${msg}`);
      if (st.logs.length > LOG_CAP) {
        st.logs = st.logs.slice(0, LOG_CAP);
        if (!st.logTrimNotified) {
          st.logs.unshift(`${tag} （系统）日志已达上限 ${LOG_CAP} 条，较早记录已裁剪`);
          st.logs = st.logs.slice(0, LOG_CAP);
          st.logTrimNotified = true;
        }
      }
      dirty.logs = true;
    };

    return { pushLog };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { createLogSystem };
  if (globalScope) globalScope.createLogSystem = createLogSystem;
})(typeof globalThis !== 'undefined' ? globalThis : window);
