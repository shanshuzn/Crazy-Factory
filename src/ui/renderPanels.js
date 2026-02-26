// 面板渲染：集中处理栏目折叠态与目标栏目红点提醒。
export function renderCategoryCollapse({ categoryCollapse }) {
  for (const section of document.querySelectorAll('.category[data-category]')) {
    const key = section.getAttribute('data-category');
    const collapsed = Boolean(categoryCollapse?.[key]);
    section.classList.toggle('collapsed', collapsed);
    const btn = section.querySelector('[data-toggle-category]');
    if (!btn) continue;
    const label = btn.querySelector('.label');
    if (label) label.textContent = collapsed ? '展开' : '折叠';
  }
}

export function renderCategoryAlerts({ activeOrder, orderProgress, achievements }) {
  const goalToggle = document.querySelector('[data-toggle-category="goals"]');
  if (!goalToggle) return;
  const hasUnclaimedOrder = Boolean(activeOrder) && orderProgress >= activeOrder.target;
  const hasClaimableAchievement = achievements.some((a) => !a.done && a.check());
  goalToggle.classList.toggle('has-alert', hasUnclaimedOrder || hasClaimableAchievement);
}
