// 调试系统工厂（?debug=1 启用）
// 为什么拆分：调试面板只服务开发期，不应污染正常 UI 与核心循环。
const createDebugSystem = ({ st, buildings, getGpsBreakdown, SAVE_KEY, fmt }) => {
  const isEnabled = new URLSearchParams(window.location.search).get('debug') === '1';
  if (!isEnabled) return { enabled: false, update: () => {} };

  const panel = document.createElement('aside');
  panel.id = 'debugPanel';
  panel.innerHTML = `
    <div class="debug-title">DEBUG PANEL</div>
    <div id="debugGps"></div>
    <div id="debugMarket"></div>
    <div id="debugSave"></div>
    <div id="debugPerf"></div>
    <div id="debugRaf"></div>
    <div id="debugMem"></div>
  `;
  document.body.appendChild(panel);

  const gpsEl = panel.querySelector('#debugGps');
  const marketEl = panel.querySelector('#debugMarket');
  const saveEl = panel.querySelector('#debugSave');
  const perfEl = panel.querySelector('#debugPerf');
  const rafEl = panel.querySelector('#debugRaf');
  const memEl = panel.querySelector('#debugMem');

  let frameCount = 0;
  let frameAccum = 0;

  const update = (dtSec = 0) => {
    const gp = getGpsBreakdown();
    const totalBuildings = buildings.reduce((sum, b) => sum + b.owned, 0);
    const saveRaw = localStorage.getItem(SAVE_KEY) || '';
    const saveBytes = new Blob([saveRaw]).size;

    gpsEl.textContent = `GPS base ${fmt(gp.baseGPS)} | mul x${gp.finalMult.toFixed(2)} | total ${fmt(gp.totalGPS)} | bld ${totalBuildings}`;
    marketEl.textContent = `Market ${st.marketIsBull ? 'BULL' : 'BEAR'} | timer ${Math.max(0, st.marketTimer).toFixed(1)}s | cycle ${st.marketCycleDuration.toFixed(1)}s`;
    const now = Date.now();
    if (!st.saveWriteWindowStart) st.saveWriteWindowStart = now;
    const elapsedMin = Math.max(1/60, (now - st.saveWriteWindowStart) / 60000);
    const writesPerMin = (st.saveWriteCount || 0) / elapsedMin;
    const lastSaveAgo = st.lastSaveAt ? ((now - st.lastSaveAt) / 1000).toFixed(1) : '-';
    saveEl.textContent = `Save key ${SAVE_KEY} | size ${(saveBytes / 1024).toFixed(2)} KB | writes/min ${writesPerMin.toFixed(1)} | last ${lastSaveAgo}s`;
    const rafElapsed = Math.max(1/60, (now - (st.rafWindowStart || now)) / 1000);
    const rafPerSec = (st.rafTickCount || 0) / rafElapsed;
    const rafState = rafPerSec > 90 ? 'WARN' : 'OK';
    rafEl.textContent = `RAF ${rafPerSec.toFixed(1)}/s | ${rafState}`;

    frameCount += 1;
    frameAccum += dtSec;
    if (frameAccum >= 0.5) {
      const fps = frameCount / frameAccum;
      perfEl.textContent = `FPS ${fps.toFixed(1)} | speed x${st.gameSpeed} | auto ${st.autoBuy ? 'on' : 'off'}`;
      frameCount = 0;
      frameAccum = 0;
    }

    const heap = performance && performance.memory ? performance.memory.usedJSHeapSize : 0;
    memEl.textContent = heap ? `Heap ${(heap / 1024 / 1024).toFixed(1)} MB` : 'Heap n/a (browser restricted)';
  };

  return { enabled: true, update };
};
