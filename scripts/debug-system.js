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
  `;
  document.body.appendChild(panel);

  const gpsEl = panel.querySelector('#debugGps');
  const marketEl = panel.querySelector('#debugMarket');
  const saveEl = panel.querySelector('#debugSave');
  const perfEl = panel.querySelector('#debugPerf');

  let frameCount = 0;
  let frameAccum = 0;

  const update = (dtSec = 0) => {
    const gp = getGpsBreakdown();
    const totalBuildings = buildings.reduce((sum, b) => sum + b.owned, 0);
    const saveRaw = localStorage.getItem(SAVE_KEY) || '';
    const saveBytes = new Blob([saveRaw]).size;

    gpsEl.textContent = `GPS base ${fmt(gp.baseGPS)} | mul x${gp.finalMult.toFixed(2)} | total ${fmt(gp.totalGPS)} | bld ${totalBuildings}`;
    marketEl.textContent = `Market ${st.marketIsBull ? 'BULL' : 'BEAR'} | timer ${Math.max(0, st.marketTimer).toFixed(1)}s | cycle ${st.marketCycleDuration.toFixed(1)}s`;
    saveEl.textContent = `Save key ${SAVE_KEY} | size ${(saveBytes / 1024).toFixed(2)} KB | logs ${st.logs.length}`;

    frameCount += 1;
    frameAccum += dtSec;
    if (frameAccum >= 0.5) {
      const fps = frameCount / frameAccum;
      perfEl.textContent = `FPS ${fps.toFixed(1)} | speed x${st.gameSpeed} | auto ${st.autoBuy ? 'on' : 'off'}`;
      frameCount = 0;
      frameAccum = 0;
    }
  };

  return { enabled: true, update };
};
