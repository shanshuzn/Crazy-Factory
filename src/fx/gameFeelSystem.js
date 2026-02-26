// 阶段3：反馈演出系统。只订阅反馈事件，不直接感知经济/存档逻辑。
export function attachGameFeelHandlers({
  feedbackBus,
  manualBtn,
  gamePanelEl,
  orderPanelEl,
  format,
  triggerButtonPop,
  spawnFloatingGain,
  triggerPanelPulse,
  triggerEventHighlight,
  triggerScreenShake,
  playSfx
}) {
  feedbackBus.on('onManualClick', ({ gain }) => {
    triggerButtonPop(manualBtn);
    spawnFloatingGain(manualBtn, `+${format(gain)}`, 'gear');
    playSfx('click');
  });

  feedbackBus.on('onBigReward', ({ text, kind = 'gear', priority = 'normal', anchorEl = gamePanelEl }) => {
    spawnFloatingGain(anchorEl, text, kind, priority);
    triggerPanelPulse(gamePanelEl);
    playSfx('reward');
  });

  feedbackBus.on('onTaskComplete', ({ title }) => {
    triggerEventHighlight('task', `任务完成：${title}`);
    triggerScreenShake(gamePanelEl, 'task');
    playSfx('order');
  });

  feedbackBus.on('onOrderComplete', ({ title }) => {
    triggerEventHighlight('order', `订单达成：${title}`);
    triggerPanelPulse(orderPanelEl);
    triggerScreenShake(gamePanelEl, 'order');
    playSfx('order');
  });

  feedbackBus.on('onPrestige', ({ gain }) => {
    triggerEventHighlight('prestige', `Prestige +${gain} RP`, '本轮效率重塑完成');
    triggerScreenShake(gamePanelEl, 'prestige');
    playSfx('prestige');
  });
}
