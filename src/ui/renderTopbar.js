// 顶栏渲染：集中处理资源与摘要文案，避免 bootstrap 渲染函数继续膨胀。
export function renderTopbar({
  elements,
  values,
  format
}) {
  const {
    gearsEl,
    gpsEl,
    rpEl,
    statModeEl,
    statLifetimeEl,
    statChainEl
  } = elements;

  const {
    gears,
    totalGPS,
    researchPoints,
    researchMultiplier,
    gameSpeed,
    financeIncomePerSecond,
    industryChainMultiplier,
    financeCreditLevel,
    financeMetaPoints,
    prestigeManualMultiplier,
    prestigeGpsMultiplier,
    autoBuy,
    lifetimeGears
  } = values;

  gearsEl.textContent = format(gears);
  gpsEl.textContent = format(totalGPS);
  rpEl.textContent = `研究点 RP：${researchPoints}（总产出 x${researchMultiplier.toFixed(1)}，速度 x${gameSpeed}，金融 +${format(financeIncomePerSecond)}/s，产业链 x${industryChainMultiplier.toFixed(2)}，信用 Lv.${financeCreditLevel}，金融元进度 ${financeMetaPoints}，Prestige 手动 x${prestigeManualMultiplier.toFixed(2)} / 产线 x${prestigeGpsMultiplier.toFixed(2)}）`;

  statModeEl.textContent = `自动购买：${autoBuy ? "开" : "关"}`;
  statLifetimeEl.textContent = `累计齿轮：${format(lifetimeGears)}`;
  statChainEl.textContent = `产业链加成：x${industryChainMultiplier.toFixed(2)}`;
}
