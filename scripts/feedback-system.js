// 反馈系统工厂
// 为什么拆出来：反馈（音效/动效）迭代频率高，独立文件可避免污染经济与渲染主流程。
const createFeedbackSystem = ({ st, JUICE, fmt, manualBtn, manualZone, marketFlashEl, gameShellEl }) => {
  // 轻量事件总线：保持事件驱动，不把反馈细节写进业务逻辑。
  const listeners = new Map();
  const eventBus = {
    on(event, handler) {
      const bucket = listeners.get(event) || [];
      bucket.push(handler);
      listeners.set(event, bucket);
    },
    emit(event, payload) {
      (listeners.get(event) || []).forEach((fn) => fn(payload));
    }
  };

  // Web Audio：纯合成，无外部资源依赖，适合原型快速迭代。
  let audioCtx = null;
  const getAudioCtx = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  };

  const playTone = (freq, type, duration, gainVal, detune = 0) => {
    if (!st.soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  const sfxClick = () => playTone(520, 'triangle', 0.08, 0.12);
  const sfxBuy = () => {
    playTone(330, 'square', 0.12, 0.08);
    playTone(440, 'square', 0.1, 0.06, 50);
  };
  const sfxUpgrade = () => {
    playTone(660, 'sine', 0.15, 0.1);
    setTimeout(() => playTone(880, 'sine', 0.2, 0.08), 80);
  };
  const sfxMarket = (bull) => playTone(bull ? 330 : 220, 'sawtooth', 0.25, 0.06, bull ? 0 : -20);

  const spawnFloat = (x, y, text, color = '#fbbf24') => {
    const el = document.createElement('div');
    el.className = 'float-num';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  };

  // 事件驱动反馈注册：业务层只 emit，不关心如何表现。
  eventBus.on('manual:clicked', ({ x, y, gain }) => {
    sfxClick();
    spawnFloat(
      x + (Math.random() * JUICE.manualFloatJitter * 2 - JUICE.manualFloatJitter),
      y - 10,
      `+${fmt(gain)}`
    );
    manualBtn.classList.remove('clicked');
    if (JUICE.clickPulseResetReflow) void manualBtn.offsetWidth;
    manualBtn.classList.add('clicked');

    const rect = manualZone.getBoundingClientRect();
    manualZone.style.setProperty('--rx', `${((x - rect.left) / rect.width) * 100}%`);
    manualZone.style.setProperty('--ry', `${((y - rect.top) / rect.height) * 100}%`);
    manualZone.classList.add('ripple');
    setTimeout(() => manualZone.classList.remove('ripple'), JUICE.rippleDurationMs);
  });

  eventBus.on('market:switched', ({ isBull }) => {
    marketFlashEl.style.background = isBull ? '#10b981' : '#ef4444';
    marketFlashEl.classList.add('on');
    setTimeout(() => marketFlashEl.classList.remove('on'), JUICE.marketFlashDurationMs);

    if (!gameShellEl) return;
    gameShellEl.style.setProperty('--shake-x', `${JUICE.marketShakePx}px`);
    gameShellEl.classList.remove('screen-shake');
    void gameShellEl.offsetWidth;
    gameShellEl.classList.add('screen-shake');
    setTimeout(() => gameShellEl.classList.remove('screen-shake'), JUICE.marketShakeMs);
  });

  return { eventBus, sfxBuy, sfxUpgrade, sfxMarket, spawnFloat };
};
