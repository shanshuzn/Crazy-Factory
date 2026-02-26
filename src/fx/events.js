// 统一反馈事件名：避免字符串散落导致订阅/分发错配。
export const FEEDBACK_EVENTS = Object.freeze({
  MANUAL_CLICK: 'onManualClick',
  BIG_REWARD: 'onBigReward',
  TASK_COMPLETE: 'onTaskComplete',
  ORDER_COMPLETE: 'onOrderComplete',
  PRESTIGE: 'onPrestige'
});
