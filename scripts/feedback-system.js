// 反馈系统工厂
// 为什么拆出来：反馈（音效/动效）迭代频率高，独立文件可避免污染经济与渲染主流程。
const createFeedbackSystem = ({ st, JUICE, fmt, manualBtn, manualZone, marketFlashEl, gameShellEl }) => {
  // 轻量事件总线：保持事件驱动，不把反馈细节写进业务逻辑。
  const listeners = new Map();
  const _emptyArr = []; // 消除每帧 emit() 调用时的数组分配

  // ── Canvas 渲染层：粒子和漂浮文字从 DOM 迁移到 Canvas，节省 DOM 操作和 GC ──
  const _canvas = document.createElement('canvas');
  const _ctx = _canvas.getContext('2d');
  _canvas.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 9998; overflow: hidden;
  `;
  _canvas.width = window.innerWidth;
  _canvas.height = window.innerHeight;
  document.body.appendChild(_canvas);

  window.addEventListener('resize', () => {
    _canvas.width = window.innerWidth;
    _canvas.height = window.innerHeight;
  });

  // 粒子对象池（预分配 + 溢出静默丢弃，避免热路径对象创建）
  // 灵感来源：https://arxiv.org/abs/2204.10455 — V8 GC square-root heap limit 规则
  // 核心思想：减少对象分配频率，让 GC 触发更少；预分配固定大小池，无堆碎片
  const MAX_PARTICLES = 60;
  const MAX_FLOATS = 20;
  const _pools = {
    particles: [],   // { x, y, vx, vy, color, radius, life, maxLife, active }
    floats:      [], // { x, y, text, color, vy, life, maxLife, active }
  };

  // 预分配所有池对象（初始化时一次性分配，运行时不再创建新对象，减少 GC pressure）
  for (let i = 0; i < MAX_PARTICLES; i++) _pools.particles.push({ active: false });
  for (let i = 0; i < MAX_FLOATS; i++) _pools.floats.push({ active: false });

  // 粒子池获取/归还（复用已有对象，不在运行时创建新对象）
  const _acquireParticle = (x, y, count, color) => {
    let acquired = 0;
    for (const p of _pools.particles) {
      if (p.active) continue;
      const angle = (Math.PI * 2 * acquired) / count;
      const velocity = 50 + Math.random() * 50;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * velocity;
      p.vy = Math.sin(angle) * velocity;
      p.color = color; p.radius = 3;
      p.maxLife = 600 + Math.random() * 200;
      p.life = p.maxLife;
      p.active = true;
      if (++acquired >= count) break;
    }
  };

  const _acquireFloat = (x, y, text, color) => {
    for (const p of _pools.floats) {
      if (p.active) continue;
      p.x = x; p.y = y; p.text = text; p.color = color;
      p.vy = -60; p.maxLife = 1000; p.life = p.maxLife;
      p.active = true;
      return; // 找到空闲槽就立即返回，不再遍历
    }
    // 池满时静默丢弃（不创建临时对象，不触发 GC）
  };

  // RAF 驱动的 Canvas tick（由 game.js 的 loop-system onAfterFrame 调用）
  let _lastT = 0;
  const tickCanvas = (now) => {
    const dt = _lastT ? Math.min(now - _lastT, 50) : 16;
    _lastT = now;
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

    // 粒子
    for (const p of _pools.particles) {
      if (!p.active) continue;
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      p.vy += 120 * (dt / 1000); // gravity
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      const alpha = Math.max(0, p.life / p.maxLife);
      _ctx.globalAlpha = alpha;
      _ctx.fillStyle = p.color;
      _ctx.beginPath();
      _ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
      _ctx.fill();
    }

    // 漂浮文字
    _ctx.font = 'bold 16px system-ui, sans-serif';
    for (const f of _pools.floats) {
      if (!f.active) continue;
      f.y += f.vy * (dt / 1000);
      f.life -= dt;
      if (f.life <= 0) { f.active = false; continue; }
      const alpha = Math.max(0, f.life / f.maxLife);
      _ctx.globalAlpha = alpha;
      _ctx.fillStyle = f.color;
      _ctx.textAlign = 'center';
      _ctx.fillText(f.text, f.x, f.y);
    }

    _ctx.globalAlpha = 1;
  };

  const eventBus = {
    on(event, handler) {
      const bucket = listeners.get(event) || [];
      bucket.push(handler);
      listeners.set(event, bucket);
    },
    emit(event, payload) {
      (listeners.get(event) ?? _emptyArr).forEach((fn) => fn(payload));
      // 通配符订阅（Mod 系统等外部扩展）
      (listeners.get('*') ?? _emptyArr).forEach((fn) => fn(event, payload));
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

  // P4-T2: 新增音效
  const sfxAchievement = () => {
    // 胜利音效：上行音阶
    playTone(523, 'sine', 0.1, 0.1); // C5
    setTimeout(() => playTone(659, 'sine', 0.1, 0.1), 100); // E5
    setTimeout(() => playTone(784, 'sine', 0.1, 0.1), 200); // G5
    setTimeout(() => playTone(1047, 'sine', 0.3, 0.12), 300); // C6
  };

  const sfxSkill = () => {
    // 技能升级：科幻感音效
    playTone(440, 'triangle', 0.05, 0.06);
    setTimeout(() => playTone(554, 'triangle', 0.05, 0.06), 60);
    setTimeout(() => playTone(659, 'triangle', 0.1, 0.08), 120);
  };

  const sfxPrestige = () => {
    // Prestige：庄重音效
    playTone(262, 'sine', 0.2, 0.1); // C4
    setTimeout(() => playTone(330, 'sine', 0.2, 0.1), 150); // E4
    setTimeout(() => playTone(392, 'sine', 0.2, 0.1), 300); // G4
    setTimeout(() => playTone(523, 'sine', 0.4, 0.12), 450); // C5
  };

  // DOM 版已迁移到 Canvas（见上 _acquireFloat / _acquireParticle）
  // 此处保留 API 兼容，内部走 Canvas 池
  const spawnFloat = (x, y, text, color = '#fbbf24') => {
    _acquireFloat(x, y, text, color);
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

  // P4-T2: 新增视觉反馈效果（Canvas 版本：粒子由 RAF 驱动，零 DOM 操作）
  const spawnParticles = (x, y, count = 8, color = '#fbbf24') => {
    _acquireParticle(x, y, count, color);
  };

  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    const colors = {
      info: '#3b82f6',
      success: '#10b981',
      warning: '#f59e0b',
      achievement: '#8b5cf6',
    };
    toast.className = 'game-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: toastSlideDown 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 添加动画样式
    if (!document.getElementById('toastStyles')) {
      const style = document.createElement('style');
      style.id = 'toastStyles';
      style.textContent = `
        @keyframes toastSlideDown {
          from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => {
      toast.style.animation = 'toastSlideDown 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, JUICE.toastDurationMs || 2500);
  };

  // 事件监听：成就解锁
  eventBus.on('achievement:unlocked', ({ name, x, y }) => {
    sfxAchievement();
    spawnParticles(x, y, 12, '#8b5cf6');
    showToast(`🏆 成就解锁: ${name}`, 'achievement');
  });

  // 事件监听：技能升级
  eventBus.on('skill:upgraded', ({ name, level, x, y }) => {
    sfxSkill();
    spawnParticles(x, y, 10, '#3b82f6');
    showToast(`✨ ${name} 升级到 Lv.${level}`, 'success');
  });

  // 事件监听：建筑批量购买
  eventBus.on('building:bulkBuy', ({ count, x, y }) => {
    if (count >= 10) {
      spawnParticles(x, y, Math.min(count / 2, 20), '#10b981');
    }
  });

  // 事件监听：Prestige
  eventBus.on('prestige:executed', ({ rpGain, x, y }) => {
    sfxPrestige();
    spawnParticles(x, y, 20, '#f59e0b');
    showToast(`🌟 增发股权完成! 获得 ${rpGain} RP`, 'success');
  });

  return {
    eventBus,
    sfxBuy,
    sfxUpgrade,
    sfxMarket,
    sfxAchievement,
    sfxSkill,
    sfxPrestige,
    spawnFloat,
    spawnParticles,
    showToast,
    tickCanvas,
  };
};
