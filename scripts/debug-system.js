// 调试系统工厂（?debug=1 启用）
// 为什么拆分：调试面板只服务开发期，不应污染正常 UI 与核心循环。
const createDebugSystem = ({ st, buildings, getGpsBreakdown, SAVE_KEY, fmt, getBudgetSplit, getRiskProfile }) => {
  let isEnabled = false;
  try {
    const qs = (window && window.location && window.location.search) || '';
    isEnabled = new URLSearchParams(qs).get('debug') === '1';
  } catch (e) { /* 非浏览器环境视为禁用 */ }
  if (!isEnabled) return { enabled: false, update: () => {} };

  const el = document.createElement('div');
  el.className = 'debug-panel';
  document.body.appendChild(el);

  // 折叠开关
  let collapsed = false;
  const toggle = document.createElement('button');
  toggle.className = 'debug-toggle';
  toggle.textContent = '−';
  toggle.title = '折叠/展开调试面板';
  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    el.classList.toggle('collapsed', collapsed);
    toggle.textContent = collapsed ? '+' : '−';
    if (collapsed) el.textContent = 'DBG';
  });
  el.appendChild(toggle);

  const heading = (t) => '\n—— ' + t + ' ——';
  const fmtV = (x) => (typeof x === 'number' ? (Math.abs(x) >= 1e6 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(2) : x.toLocaleString(undefined, { maximumFractionDigits: 2 })) : String(x));

  // 性能采样缓冲：FPS / Heap / 帧耗时，保留最近 120 帧
  const MAX = 120;
  const fpsBuf = new Array(MAX).fill(0);
  const msBuf = new Array(MAX).fill(0);
  let fpsIdx = 0;
  let frameCount = 0;
  let fpsAcc = 0;
  let fpsT0 = performance.now();
  let lastT = performance.now();
  let heapPeak = 0;
  let heapMin = Infinity;

  // 简单 ASCII 迷你趋势图
  const spark = (buf, h = 4) => {
    const w = 26;
    const data = buf.slice(-w);
    const mn = Math.min(...data);
    const mx = Math.max(...data);
    const rng = (mx - mn) || 1;
    const rows = [];
    for (let r = 0; r < h; r++) {
      const thr = mx - (rng * r) / h;
      let line = '';
      for (const v of data) line += v >= thr ? '█' : ' ';
      rows.push(line + ' ' + ((r === 0 ? mx : r === h - 1 ? mn : '').toFixed(0)));
    }
    return rows.join('\n');
  };

  const update = (dtSec = 0) => {
    // 帧统计
    const now = performance.now();
    frameCount++;
    fpsAcc += dtSec || (now - lastT) / 1000;
    lastT = now;
    if (fpsAcc >= 1) {
      fpsBuf[fpsIdx] = Math.round(frameCount / fpsAcc);
      msBuf[fpsIdx] = Math.round((fpsAcc * 1000) / frameCount * 10) / 10;
      fpsIdx = (fpsIdx + 1) % MAX;
      frameCount = 0;
      fpsAcc = 0;
    }

    // 内存
    let heapUsed = 0;
    let heapTotal = 0;
    if (window.performance && performance.memory) {
      heapUsed = performance.memory.usedJSHeapSize / 1048576;
      heapTotal = performance.memory.totalJSHeapSize / 1048576;
    }
    if (heapUsed > heapPeak) heapPeak = heapUsed;
    if (heapUsed > 0 && heapUsed < heapMin) heapMin = heapUsed;

    const gp = getGpsBreakdown();
    const f = gp.factors || {};
    const totalBuildings = buildings.reduce((sum, b) => sum + b.owned, 0);
    const maxBuildings = buildings.reduce((sum, b) => sum + b.maxOwned, 0);
    const ownedCount = buildings.filter((b) => b.owned > 0).length;
    const purchased = buildings.reduce((sum, b) => sum + b.totalBought, 0);
    const upgradesOwned = st.upgrades ? Object.keys(st.upgrades).filter((k) => st.upgrades[k]).length : 0;
    const achievementsUnlocked = st.achievements ? Object.keys(st.achievements).filter((k) => st.achievements[k]).length : 0;

    // 场景/资产配置/事件状态
    const scen = st.scenarios && st.scenarios.activeScenario
      ? (st.scenarios.activeScenario === 'custom' && st.scenarios.customScenarios.length
          ? 'custom:' + st.scenarios.customScenarios.length
          : st.scenarios.activeScenario)
      : '-';
    const risk = (getRiskProfile && getRiskProfile()) || st.assetAllocation?.riskProfile || '-';
    const alloc = st.assetAllocation?.allocation || {};
    const budget = (getBudgetSplit && typeof getBudgetSplit === 'function')
      ? getBudgetSplit(st.gears)
      : null;
    const eventCount = st.macroEvent ? Object.keys(st.macroEvent).length : 0;
    const lastEvent = st.macroEventId ? String(st.macroEventId) : '-';

    const hasTrend = Math.min(...fpsBuf) > 0;
    const lines = [
      `v2.11.0-debug  ${st.gears !== undefined ? 'gears:' + fmtV(st.gears) : ''}`,
      heading('CORE'),
      `baseGPS        ${fmtV(gp.baseGPS)}`,
      `finalMult      ${fmtV(gp.finalMult)}x`,
      `totalGPS       ${fmtV(gp.totalGPS)}`,
      `manualGain     ${fmtV(st.manualPower || 0)}`,
      `buildings      ${totalBuildings}/${maxBuildings} (${ownedCount} types)`,
      `bought total   ${fmtV(purchased)}`,
      `upgrades       ${upgradesOwned}`,
      `achievements   ${achievementsUnlocked}`,
      heading('MULT FACTORS'),
      `base gpsMult   ${fmtV(f.gpsMultiplier)}`,
      `research       ${fmtV(f.research)}`,
      `skillGPS       ${fmtV(f.skillGPS)}`,
      `market         ${fmtV(f.market)}`,
      `skillMastery   ${fmtV(f.skillMastery)}`,
      `synergy        ${fmtV(f.synergy)}`,
      `region         ${fmtV(f.region)}`,
      `crisis         ${fmtV(f.crisis)}`,
      `guild          ${fmtV(f.guild)}`,
      `boost          ${fmtV(f.boost)}`,
      `subscription   ${fmtV(f.subscription)}`,
      `riskVolatility ${fmtV(f.riskVolatility)}`,
      `productCheck   ${fmtV(f.productCheck)} (finalMult: ${fmtV(gp.finalMult)})`,
      heading('STATE'),
      `market         ${st.marketIsBull ? 'BULL' : 'BEAR'} cycle ${fmtV(st.marketTimer)}s`,
      `policyRate     ${fmtV(st.policyRate)}`,
      `macroEvent     ${lastEvent} (${eventCount})`,
      `scenario       ${scen}`,
      `riskProfile    ${risk}`,
      `allocation     B${Math.round((alloc.buildings || 0) * 100)}% U${Math.round((alloc.upgrades || 0) * 100)}% D${Math.round((alloc.derivativesMargin || 0) * 100)}%`,
      budget ? `budgetSplit    ${Math.round((budget.buildings || 0) * 100)}%/${Math.round((budget.upgrades || 0) * 100)}%/${Math.round((budget.margin || 0) * 100)}%` : '',
      heading('SAVE'),
      `autoSave key   ${SAVE_KEY}`,
      heading('PERF'),
      `fps            ${Math.max(...fpsBuf)} / avg ${Math.round(fpsBuf.reduce((a, v) => a + v, 0) / MAX)}`,
      `frame ms       ${Math.max(...msBuf)} / avg ${Math.round(msBuf.reduce((a, v) => a + v, 0) / MAX * 10) / 10}`,
      `heap used      ${heapUsed.toFixed(2)}MB (peak ${heapPeak.toFixed(2)}, min ${heapMin.toFixed(2)})`,
      `heap total     ${heapTotal.toFixed(2)}MB`,
      `timers active  ${(window.__timerManager ? window.__timerManager.getTasks().length : '-')}`,
      heading('TREND (FPS top 4)'),
    ];
    if (hasTrend) {
      lines.push(spark(fpsBuf));
    } else {
      lines.push('  <sampling...>');
    }
    if (!collapsed) {
      // 保留折叠按钮，仅更新内容区
      const body = document.createElement('div');
      body.className = 'debug-mono';
      body.textContent = lines.filter(Boolean).join('\n');
      if (el.children.length > 1) el.removeChild(el.lastChild);
      el.appendChild(body);
    }
  };

  return { enabled: true, update };
};
// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createDebugSystem };
}
