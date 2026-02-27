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
  tryAutoBuy,
  saveGame,
  render,
  onAfterFrame = null,
}) => {
  let lastSave = performance.now();

  const tick = (now) => {
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
          tryAutoBuy();
        }
      }
    }

    dirty.gears = dirty.market = true;
    if (now - lastSave > SAVE_INTERVAL) {
      saveGame();
      lastSave = now;
    }

    render();
    if (onAfterFrame) onAfterFrame(dt);
    requestAnimationFrame(tick);
  };

  const startLoop = () => {
    render(true);
    requestAnimationFrame(tick);
  };

  return { startLoop };
};
