// 控件绑定：把顶部控制条与栏目折叠交互从 bootstrap 中抽离。
export function bindPrimaryControls({
  controlsRoot,
  categoryGrid,
  onSetPurchaseMode,
  onSetSpeed,
  onToggleAutoBuy,
  onToggleAudio,
  onToggleLowPerf,
  onToggleLowPerfAudio,
  onToggleDebugPanel,
  onToggleCategory
}) {
  controlsRoot.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const mode = target.dataset.mode;
    if (mode) return onSetPurchaseMode(mode);

    const speed = Number(target.dataset.speed);
    if ([1, 2, 4].includes(speed)) return onSetSpeed(speed);

    if (target.id === 'autoBuyBtn') return onToggleAutoBuy();
    if (target.id === 'audioBtn') return onToggleAudio();
    if (target.id === 'lowPerfBtn') return onToggleLowPerf();
    if (target.id === 'lowPerfAudioBtn') return onToggleLowPerfAudio();
    if (target.id === 'debugToggleBtn') return onToggleDebugPanel();
  });

  categoryGrid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const key = target.dataset.toggleCategory;
    if (!key) return;
    onToggleCategory(key);
  });
}
