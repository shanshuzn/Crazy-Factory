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

  // 场景系统动态覆盖参数（UGC 场景编辑器）：读取 st.scenarioParams，未设置时回退到常量
  let _scenarioParams = null;
  const _scp = (key, fallback) => {
    const v = _scenarioParams && _scenarioParams[key];
    return v != null && isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback;
  };
  const setScenarioParams = (params = null) => {
    _scenarioParams = params;
    if (dirty) dirty.market = true;
  };
  const _cycleMin = () => _scp('marketCycleMin', MARKET_CYCLE_MIN);
  const _cycleMax = () => _scp('marketCycleMax', MARKET_CYCLE_MAX);
  const _bullBonus = () => _scp('bullBonus', MARKET_BULL_BONUS);
  const _bearPenalty = () => _scp('bearPenalty', MARKET_BEAR_PENALTY);

  // 预取宏事件数组（消除 getActiveMacro/getEventById 内每次 (MACRO_EVENTS || []) 分配）
  const _macroEvents = MACRO_EVENTS ?? [];

  const getActiveMacro = () => {
    if (!st.macroEventId) return null;
    return _macroEvents.find((e) => e.id === st.macroEventId) ?? null;
  };

  const getEventById = (id) => _macroEvents.find((e) => e.id === id) ?? null;

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
    if (Math.random() >= 0.15) return;   // 0.35 → 0.22 → 0.15：进一步降低宏观事件触发概率

    const prev = getEventById(st.lastMacroEventId || '');
    const chainTargetId = prev?.nextEventId || '';
    const chainPick = chainTargetId && Math.random() < 0.50;  // 0.65 → 0.50：降低连锁概率

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
    eventBus.emit('macro:changed', { preferredBuildingId: st.macroPreferredBuildingId });
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
      eventBus.emit('macro:changed', { preferredBuildingId: '' });
      dirty.logs = true;
      updateRateOutlook();
    }
  };

  const doMarketSwitch = () => {
    st.marketIsBull = !st.marketIsBull;
    st.marketCycleDuration = _cycleMin() + Math.random() * (_cycleMax() - _cycleMin());
    st.marketTimer = st.marketCycleDuration;
    const label = st.marketIsBull ? '📈 多头行情爆发！' : '📉 空头来袭，注意风控';
    pushLog(label);
    st.lastRewardText = label;
    sfxMarket(st.marketIsBull);
    dirty.market = true;
    dirty.logs = true;
    eventBus.emit('market:switched', { isBull: st.marketIsBull });
  };

  const tickMarket = (dt) => {
    st.marketTimer -= dt * st.gameSpeed;
    if (st.marketTimer <= 0) doMarketSwitch();
  };

  // renderMarket 值变化缓存：避免每帧无条件重写 DOM
  const _mc = {}; // renderMarket local cache
  const _mcSet = (k, v) => { if (_mc[k] !== v) { _mc[k] = v; return true; } return false; };

  const renderMarket = () => {
    const bull = st.marketIsBull;
    const mult = mktMult();
    const macro = getActiveMacro();
    if (_mcSet('mult', mult.toFixed(2))) marketMultEl.textContent = `×${mult.toFixed(2)}`;
    marketMultEl.style.color = bull ? 'var(--bull)' : 'var(--bear)';
    if (_mcSet('status', bull ? '多头市场' : '空头市场')) {
      marketStatusEl.textContent = bull ? '多头市场' : '空头市场';
      marketStatusEl.style.color = bull ? 'var(--bull)' : 'var(--bear)';
    }
    marketDotEl.classList.toggle('bear', !bull);
    if (_mcSet('label', bull ? '多头市场' : '空头市场')) {
      marketLabelEl.textContent = bull ? '多头市场' : '空头市场';
      marketLabelEl.style.color = bull ? 'var(--bull)' : 'var(--bear)';
    }

    const pct = bull
      ? 50 + (1 - st.marketTimer / st.marketCycleDuration) * 50
      : (st.marketTimer / st.marketCycleDuration) * 50;
    if (_mcSet('wave', pct)) marketWaveEl.style.width = `${Math.max(5, Math.min(95, pct))}%`;
    if (_mcSet('count', `切换：${Math.ceil(st.marketTimer)}s`)) marketCountEl.textContent = `切换：${Math.ceil(st.marketTimer)}s`;
    const effTxt = bull ? `多头加成 ×${_bullBonus().toFixed(1)}` : `空头折损 ×${_bearPenalty().toFixed(1)}`;
    if (_mcSet('effect', effTxt)) {
      marketEffectEl.textContent = effTxt;
      marketEffectEl.style.color = bull ? 'var(--bull)' : 'var(--bear)';
    }

    if (marketEventEl) {
      const evTxt = macro
        ? `宏观事件：${macro.name}（剩余 ${st.macroEventTimer} 次切换｜偏好 ${st.macroPreferredBuildingId || 'none'}｜连锁 ${st.macroChainCount || 0}）`
        : '宏观事件：暂无';
      if (_mcSet('event', evTxt)) marketEventEl.textContent = evTxt;
    }
    if (marketOutlookEl) {
      const arrow = st.rateOutlookDirection === '上调' ? '↑' : '↓';
      const hits = Math.max(0, Number(st.rateOutlookHits) || 0);
      const misses = Math.max(0, Number(st.rateOutlookMisses) || 0);
      const hitRatePct = (getOutlookHitRate() * 100).toFixed(1);
      const outlookTxt = `利率前瞻：${st.rateOutlookDirection}${arrow}（置信 ${st.rateOutlookConfidence || 0}%｜命中 ${hitRatePct}% ${hits}/${hits + misses}）`;
      if (_mcSet('outlook', outlookTxt)) marketOutlookEl.textContent = outlookTxt;
    }
  };

  updateRateOutlook();
  return {
    doMarketSwitch,
    tickMarket,
    renderMarket,
    setScenarioParams,
    // 诊断/测试接口
    getActiveMacro,
    getEventById,
    getOutlookHitRate,
    updateRateOutlook,
    settleOutlookResult,
    maybeRollMacroEvent,
    decayMacroEvent,
  };
};
