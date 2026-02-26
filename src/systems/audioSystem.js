// 音频系统：把音效合成与低性能保护从 bootstrap 中剥离，便于后续独立调音与节流。
export function createAudioSystem({ getState, volume }) {
  let audioContext = null;

  const getAudioContext = () => {
    if (audioContext) return audioContext;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
    return audioContext;
  };

  const playSfx = (kind) => {
    const state = getState();
    if (!state.audioEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const profile = {
      click: { f0: 680, f1: 520, t: 0.06 },
      reward: { f0: 900, f1: 1200, t: 0.1 },
      order: { f0: 480, f1: 720, t: 0.12 },
      prestige: { f0: 320, f1: 860, t: 0.18 }
    }[kind] || { f0: 600, f1: 700, t: 0.08 };

    const audioSafeMode = state.lowPerfMode || state.lowPerfAudioSafe;
    const safeF0 = audioSafeMode ? Math.min(profile.f0, 700) : profile.f0;
    const safeF1 = audioSafeMode ? Math.min(profile.f1, 780) : profile.f1;
    const safeT = audioSafeMode ? Math.min(profile.t, 0.07) : profile.t;

    osc.type = audioSafeMode ? "sine" : "triangle";
    osc.frequency.setValueAtTime(safeF0, now);
    osc.frequency.exponentialRampToValueAtTime(safeF1, now + safeT);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + safeT);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + safeT);
  };

  return { playSfx };
}
