// 市场系统工厂
// 为什么拆分：市场波动是独立状态机，单独维护可避免主循环文件持续膨胀。
const createMarketSystem = ({
  st,
  dirty,
  pushLog,
  eventBus,
  sfxMarket,
  mktMult,
  MARKET_CYCLE_MIN,
  MARKET_CYCLE_MAX,
  MARKET_BULL_BONUS,
  MARKET_BEAR_PENALTY,
  POLICY_RATE_MIN,
  POLICY_RATE_MAX,
  marketMultEl,
  marketStatusEl,
  marketDotEl,
  marketLabelEl,
  marketWaveEl,
  marketCountEl,
  marketEffectEl,
}) => {
  const doMarketSwitch = () => {
    st.marketIsBull = !st.marketIsBull;
    st.marketCycleDuration = MARKET_CYCLE_MIN + Math.random() * (MARKET_CYCLE_MAX - MARKET_CYCLE_MIN);
    st.marketTimer = st.marketCycleDuration;
    const rateStep = (Math.random() < 0.5 ? -0.25 : 0.25);
    st.policyRate = Math.max(POLICY_RATE_MIN, Math.min(POLICY_RATE_MAX, (st.policyRate || 0) + rateStep));
    const label = st.marketIsBull ? '📈 多头行情爆发！' : '📉 空头来袭，注意风控';
    pushLog(`${label}（政策利率 ${st.policyRate.toFixed(2)}%）`);
    st.lastRewardText = `${label}｜政策利率 ${st.policyRate.toFixed(2)}%`;
    sfxMarket(st.marketIsBull);
    dirty.market = true;
    dirty.logs = true;
    eventBus.emit('market:switched', { isBull: st.marketIsBull });
  };

  const tickMarket = (dt) => {
    const policyVol = 1 + (st.policyRate || 0) * 0.03;
    st.marketTimer -= dt * st.gameSpeed * policyVol;
    if (st.marketTimer <= 0) doMarketSwitch();
  };

  const renderMarket = () => {
    const bull = st.marketIsBull;
    const mult = mktMult();
    marketMultEl.textContent = `×${mult.toFixed(2)}`;
    marketMultEl.style.color = bull ? 'var(--bull)' : 'var(--bear)';
    marketStatusEl.textContent = bull ? '多头市场' : '空头市场';
    marketStatusEl.style.color = bull ? 'var(--bull)' : 'var(--bear)';
    marketDotEl.classList.toggle('bear', !bull);
    marketLabelEl.textContent = bull ? '多头市场' : '空头市场';
    marketLabelEl.style.color = bull ? 'var(--bull)' : 'var(--bear)';

    const pct = bull
      ? 50 + (1 - st.marketTimer / st.marketCycleDuration) * 50
      : (st.marketTimer / st.marketCycleDuration) * 50;
    marketWaveEl.style.width = `${Math.max(5, Math.min(95, pct))}%`;
    marketCountEl.textContent = `切换：${Math.ceil(st.marketTimer)}s`;
    marketEffectEl.textContent = bull
      ? `多头加成 ×${MARKET_BULL_BONUS.toFixed(1)}｜利率 ${st.policyRate.toFixed(2)}%`
      : `空头折损 ×${MARKET_BEAR_PENALTY.toFixed(1)}｜利率 ${st.policyRate.toFixed(2)}%`;
    marketEffectEl.style.color = bull ? 'var(--bull)' : 'var(--bear)';
  };

  return { doMarketSwitch, tickMarket, renderMarket };
};
