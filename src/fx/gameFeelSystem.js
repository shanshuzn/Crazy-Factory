import { FEEDBACK_EVENTS } from './events.js';

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
  feedbackBus.on(FEEDBACK_EVENTS.MANUAL_CLICK, ({ gain }) => {
    triggerButtonPop(manualBtn);
    spawnFloatingGain(manualBtn, `+${format(gain)}`, 'gear');
    playSfx('click');
  });

  feedbackBus.on(FEEDBACK_EVENTS.BIG_REWARD, ({ text, kind = 'gear', priority = 'normal', anchorEl = gamePanelEl }) => {
    spawnFloatingGain(anchorEl, text, kind, priority);
    triggerPanelPulse(gamePanelEl);
    playSfx('reward');
  });

  feedbackBus.on(FEEDBACK_EVENTS.TASK_COMPLETE, ({ title }) => {
    triggerEventHighlight('task', `任务完成：${title}`);
    triggerScreenShake(gamePanelEl, 'task');
    playSfx('order');
  });

  feedbackBus.on(FEEDBACK_EVENTS.ORDER_COMPLETE, ({ title }) => {
    triggerEventHighlight('order', `订单达成：${title}`);
    triggerPanelPulse(orderPanelEl);
    triggerScreenShake(gamePanelEl, 'order');
    playSfx('order');
  });

  feedbackBus.on(FEEDBACK_EVENTS.PRESTIGE, ({ gain }) => {
    triggerEventHighlight('prestige', `Prestige +${gain} RP`, '本轮效率重塑完成');
    triggerScreenShake(gamePanelEl, 'prestige');
    playSfx('prestige');
  });
}
