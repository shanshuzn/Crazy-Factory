// 主循环系统工厂
// 为什么拆分：固定步长推进是性能敏感路径，单独模块便于后续做调速/性能巡检。
const createLoopSystem = ({
  st,
  dirty,
  MAX_ACCUMULATED_SECS,
  FIXED_STEP,
  SAVE_INTERVAL,
  getTotalGPS,
  tickMarket,
  tickEvent,
  tryAutoBuy,
  saveGame,
  render,
  onAfterFrame = null,
}) => {
  let lastSave = performance.now();
  let _rafId = null; // RAF handle for cleanup
  let _isRunning = false;

  const tick = (now) => {
    if (!_isRunning) return;
    const dt = Math.min((now - st.lastTimestamp) / 1000, MAX_ACCUMULATED_SECS);
    st.rafTickCount = (st.rafTickCount || 0) + 1;
    if (!st.rafWindowStart) st.rafWindowStart = Date.now();
    st.lastTimestamp = now;
    st.accumulator += dt;

    const gps = getTotalGPS();
    while (st.accumulator >= FIXED_STEP) {
      const gain = gps * FIXED_STEP * st.gameSpeed;
      st.gears += gain;
      st.lifetimeGears += gain;
      st.accumulator -= FIXED_STEP;
      tickMarket(FIXED_STEP);
      if (tickEvent) tickEvent(FIXED_STEP);

      if (st.marketMomentumTimer > 0) {
        st.marketMomentumTimer = Math.max(0, st.marketMomentumTimer - FIXED_STEP * st.gameSpeed);
        if (st.marketMomentumTimer <= 0 && st.marketMomentum > 0) {
          st.marketMomentum = 0;
          dirty.market = true;
        }
      }

      if (st.autoBuy) {
        st.autoBuyAccumulator += FIXED_STEP * st.gameSpeed;
        if (st.autoBuyAccumulator >= 0.5) {
          st.autoBuyAccumulator = 0;
          // 如果有资产配置系统，传入预算分配；否则回退到无参数调用
          const budgetSplit = (getBudgetSplit && typeof getBudgetSplit === 'function')
            ? getBudgetSplit(st.gears)
            : null;
          tryAutoBuy(budgetSplit);
        }
      }
    }

    dirty.gears = true;

    // 驱动统一定时管理器（所有面板刷新由 RAF 统一调度，不再有独立 setInterval）
    if (window.__timerManager) window.__timerManager.tick(now);

    if (now - lastSave > SAVE_INTERVAL) {
      saveGame();
      lastSave = now;
    }

    render();
    if (onAfterFrame) onAfterFrame(dt);
    _rafId = requestAnimationFrame(tick);
  };

  const startLoop = () => {
    _isRunning = true;
    render(true);
    _rafId = requestAnimationFrame(tick);
  };

  // 停止循环：用于 visibilitychange 暂停或页面卸载
  const stopLoop = () => {
    _isRunning = false;
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
  };

  // Tab 可见性处理：切后台暂停 RAF 循环
  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopLoop();
    } else {
      // 恢复：重置时间戳避免 dt 过大，并重启循环
      st.lastTimestamp = performance.now();
      st.accumulator = 0;
      if (!_isRunning) startLoop();
    }
  };

  return { startLoop, stopLoop, handleVisibilityChange };
};
