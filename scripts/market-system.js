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
  OUTLOOK_REWARD_BASE,
  OUTLOOK_REWARD_RATE_SCALE,
  OUTLOOK_PENALTY_BASE,
  OUTLOOK_PENALTY_RATE_SCALE,
  OUTLOOK_PENALTY_GEAR_RATIO,
  MACRO_EVENTS,
  POLICY_GUIDANCE_BASE_BIAS,
  marketMultEl,
  marketStatusEl,
  marketDotEl,
  marketLabelEl,
  marketWaveEl,
  marketCountEl,
  marketEffectEl,
  marketEventEl,
  marketOutlookEl,
}) => {
  const clampRate = (x) => Math.max(POLICY_RATE_MIN, Math.min(POLICY_RATE_MAX, x));

  const getActiveMacro = () => {
    if (!st.macroEventId) return null;
    return (MACRO_EVENTS || []).find((e) => e.id === st.macroEventId) || null;
  };

  const getEventById = (id) => (MACRO_EVENTS || []).find((e) => e.id === id) || null;

  const chooseDirectionByBias = (biasUp) => (Math.random() < biasUp ? 0.25 : -0.25);

  const getOutlookHitRate = () => {
    const hits = Math.max(0, Number(st.rateOutlookHits) || 0);
    const misses = Math.max(0, Number(st.rateOutlookMisses) || 0);
    const total = hits + misses;
    if (total <= 0) return 0;
    return hits / total;
  };

  const updateRateOutlook = () => {
    const macro = getActiveMacro();
    const biasUp = Math.max(0.05, Math.min(0.95, Number(macro?.guidanceBiasUp ?? POLICY_GUIDANCE_BASE_BIAS ?? 0.5)));
    st.rateOutlookBiasUp = biasUp;
    st.rateOutlookDirection = biasUp >= 0.5 ? '上调' : '下调';
    st.rateOutlookConfidence = Math.round(Math.abs(biasUp - 0.5) * 200);
  };

  const settleOutlookResult = (rateStep) => {
    const predictedUp = st.rateOutlookDirection !== '下调';
    const actualUp = rateStep > 0;
    const hit = predictedUp === actualUp;
    if (hit) {
      st.rateOutlookHits = Math.max(0, Number(st.rateOutlookHits) || 0) + 1;
      const bonus = Math.max(OUTLOOK_REWARD_BASE, Math.floor((1 + (st.policyRate || 0)) * OUTLOOK_REWARD_RATE_SCALE));
      st.gears += bonus;
      st.lifetimeGears += bonus;
      st.lastRewardText = `🔮 前瞻命中：奖励 ${bonus}`;
      pushLog(`✅ 前瞻命中（预测${predictedUp ? '上调' : '下调'}）：+${bonus}`);
    } else {
      st.rateOutlookMisses = Math.max(0, Number(st.rateOutlookMisses) || 0) + 1;
      const lossCap = Math.max(OUTLOOK_PENALTY_BASE, Math.floor((1 + (st.policyRate || 0)) * OUTLOOK_PENALTY_RATE_SCALE));
      const loss = Math.min(lossCap, Math.floor((st.gears || 0) * OUTLOOK_PENALTY_GEAR_RATIO));
      st.gears = Math.max(0, st.gears - loss);
      st.lastRewardText = `🔮 前瞻误判：回撤 ${loss}`;
      pushLog(`⚠️ 前瞻误判（预测${predictedUp ? '上调' : '下调'}，实际${actualUp ? '上调' : '下调'}）：-${loss}`);
    }
    dirty.gears = true;
    dirty.stats = true;
  };

  const maybeRollMacroEvent = () => {
    if (st.macroEventTimer > 0 || !Array.isArray(MACRO_EVENTS) || MACRO_EVENTS.length === 0) return;
    if (Math.random() >= 0.35) return;

    const prev = getEventById(st.lastMacroEventId || '');
    const chainTargetId = prev?.nextEventId || '';
    const chainPick = chainTargetId && Math.random() < 0.65;

    let ev = null;
    if (chainPick) {
      ev = getEventById(chainTargetId);
    }
    if (!ev) {
      const idx = Math.floor(Math.random() * MACRO_EVENTS.length);
      ev = MACRO_EVENTS[idx];
    }
    if (!ev) return;

    st.macroEventId = ev.id;
    st.lastMacroEventId = ev.id;
    st.macroEventTimer = Math.max(1, Number(ev.durationSwitches) || 1);
    st.macroPreferredBuildingId = ev.preferredBuildingId || '';
    if (chainPick && ev.id === chainTargetId) {
      st.macroChainCount = Math.max(0, Number(st.macroChainCount) || 0) + 1;
    }

    const shock = Number(ev.rateShock) || 0;
    if (shock !== 0) st.policyRate = clampRate((st.policyRate || 0) + shock);
    const chainTag = chainPick && ev.id === chainTargetId ? '｜连锁触发' : '';
    const prefTag = st.macroPreferredBuildingId ? `｜偏好 ${st.macroPreferredBuildingId}` : '';
    pushLog(`🌐 宏观事件：${ev.name}（持续 ${st.macroEventTimer} 次切换${chainTag}${prefTag}）`);
    dirty.logs = true;
    updateRateOutlook();
  };

  const decayMacroEvent = () => {
    if (st.macroEventTimer <= 0) return;
    st.macroEventTimer = Math.max(0, st.macroEventTimer - 1);
    if (st.macroEventTimer === 0) {
      const ev = getActiveMacro();
      if (ev) pushLog(`📰 事件结束：${ev.name}`);
      st.macroEventId = '';
      st.macroPreferredBuildingId = '';
      dirty.logs = true;
      updateRateOutlook();
    }
  };

  const doMarketSwitch = () => {
    st.marketIsBull = !st.marketIsBull;
    st.marketCycleDuration = MARKET_CYCLE_MIN + Math.random() * (MARKET_CYCLE_MAX - MARKET_CYCLE_MIN);
    st.marketTimer = st.marketCycleDuration;

    const rateStep = chooseDirectionByBias(st.rateOutlookBiasUp || POLICY_GUIDANCE_BASE_BIAS || 0.5);
    st.policyRate = clampRate((st.policyRate || 0) + rateStep);
    settleOutlookResult(rateStep);

    const label = st.marketIsBull ? '📈 多头行情爆发！' : '📉 空头来袭，注意风控';
    pushLog(`${label}（政策利率 ${st.policyRate.toFixed(2)}%）`);

    decayMacroEvent();
    maybeRollMacroEvent();
    updateRateOutlook();

    const arrow = st.rateOutlookDirection === '上调' ? '↑' : '↓';
    pushLog(`🔮 利率前瞻：下次更可能${st.rateOutlookDirection}${arrow}（置信 ${st.rateOutlookConfidence}%）`);

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
    const macro = getActiveMacro();
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

    if (marketEventEl) {
      marketEventEl.textContent = macro
        ? `宏观事件：${macro.name}（剩余 ${st.macroEventTimer} 次切换｜偏好 ${st.macroPreferredBuildingId || 'none'}｜连锁 ${st.macroChainCount || 0}）`
        : '宏观事件：暂无';
    }
    if (marketOutlookEl) {
      const arrow = st.rateOutlookDirection === '上调' ? '↑' : '↓';
      const hits = Math.max(0, Number(st.rateOutlookHits) || 0);
      const misses = Math.max(0, Number(st.rateOutlookMisses) || 0);
      const hitRatePct = (getOutlookHitRate() * 100).toFixed(1);
      marketOutlookEl.textContent = `利率前瞻：${st.rateOutlookDirection}${arrow}（置信 ${st.rateOutlookConfidence || 0}%｜命中 ${hitRatePct}% ${hits}/${hits + misses}）`;
    }
  };

  updateRateOutlook();
  return { doMarketSwitch, tickMarket, renderMarket };
};
