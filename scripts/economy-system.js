// 经济系统工厂
// 为什么拆分：数值平衡/购买规则改动频繁，独立后可避免渲染与输入逻辑互相污染。
const createEconomySystem = ({
  st,
  buildings,
  upgrades,
  skills,
  bldBoost,
  PRICE_GROWTH,
  MARKET_BULL_BONUS,
  MARKET_BEAR_PENALTY,
  SKILL_MASTERY_BONUS,
  dirty,
  buildingViewMap,
  pushLog,
  saveGame,
  fmt,
  sfxBuy,
  applyUpgradeEffect
}) => {
  const bld = (id) => buildings.find((b) => b.id === id);
  const skillLv = (id) => skills.find((s) => s.id === id)?.level || 0;
  const discount = () => Math.max(0.6, 1 - skillLv('bulk_discount') * 0.04);
  const price = (b, off = 0) => GameFormulas.calcBuildingPrice({ basePrice: b.basePrice, owned: b.owned, growth: PRICE_GROWTH, discount: discount(), offset: off });

  const bldGPS = (b) => b.dps * b.owned * (bldBoost[b.id] || 1);
  const baseGPS = () => buildings.reduce((s, b) => s + bldGPS(b), 0);
  const resMult = () => 1 + st.researchPoints * 0.1;
  const skillGPS = () => 1 + skillLv('line_optimizer') * 0.25;
  const mktMult = () => {
    const base = st.marketIsBull ? MARKET_BULL_BONUS : MARKET_BEAR_PENALTY;
    return st.marketIsBull ? base * (1 + skillLv('market_sense') * 0.1) : base;
  };

  const skillMasteryMult = () => 1 + (st.skillMasteryTier || 0) * SKILL_MASTERY_BONUS;
  const getTotalGPS = () => baseGPS() * st.gpsMultiplier * resMult() * skillGPS() * mktMult() * skillMasteryMult();
  const getManualGain = () => st.manualPower * st.manualMult * (1 + skillLv('manual_mastery') * 0.3);

  const getGpsBreakdown = () => {
    const _baseGPS = baseGPS();
    const _resMult = resMult();
    const _skillGPS = skillGPS();
    const _mktMult = mktMult();
    const _mastery = skillMasteryMult();
    const finalMult = st.gpsMultiplier * _resMult * _skillGPS * _mktMult * _mastery;
    return {
      baseGPS: _baseGPS,
      gpsMultiplier: st.gpsMultiplier,
      resMult: _resMult,
      skillGPS: _skillGPS,
      marketMult: _mktMult,
      masteryMult: _mastery,
      finalMult,
      totalGPS: _baseGPS * finalMult,
    };
  };

  const affordableCount = (b, budget, mode) => GameFormulas.calcAffordableCount({
    basePrice: b.basePrice,
    owned: b.owned,
    growth: PRICE_GROWTH,
    discount: discount(),
    budget,
    mode,
  });

  const purchaseCost = (b, n) => GameFormulas.calcPurchaseCost({
    basePrice: b.basePrice,
    owned: b.owned,
    growth: PRICE_GROWTH,
    discount: discount(),
    count: n,
  });

  const upgradeLockedReason = (u) => {
    if (st.researchPoints < u.unlockRP) return `需要 ${u.unlockRP} RP`;
    if (u.requires) {
      const r = upgrades.find((x) => x.id === u.requires);
      if (r && !r.purchased) return `前置：${r.name}`;
    }
    if (u.type === 'bldBoost') {
      const bb = bld(u.value.id);
      if (bb && st.lifetimeGears < bb.unlock) return `解锁「${bb.name}」后可用`;
    }
    return '';
  };

  const isBldUnlocked = (b) => st.lifetimeGears >= b.unlock;

  const buyBuilding = (id) => {
    const b = bld(id);
    if (!b || !isBldUnlocked(b)) return;
    const n = affordableCount(b, st.gears, st.purchaseMode);
    if (n <= 0) return;
    const pc = st.purchaseMode === 'max' ? n : Math.min(n, Number(st.purchaseMode) || 1);
    const cost = purchaseCost(b, pc);
    if (st.gears < cost) return;

    st.gears -= cost;
    b.owned += pc;
    pushLog(`收购 ${b.emoji}${b.name} ×${pc}（-${fmt(cost)}）`);
    sfxBuy();

    const v = buildingViewMap.get(id);
    if (v) {
      v.row.classList.remove('bought');
      void v.row.offsetWidth;
      v.row.classList.add('bought');
    }

    dirty.buildings = dirty.stats = dirty.logs = true;
    saveGame();
  };

  const buyUpgrade = (id) => {
    const u = upgrades.find((x) => x.id === id);
    if (!u || u.purchased) return;
    const locked = upgradeLockedReason(u);
    if (locked || st.gears < u.price) return;

    st.gears -= u.price;
    u.purchased = true;
    applyUpgradeEffect(u);
    dirty.upgrades = dirty.buildings = dirty.stats = dirty.logs = true;
    saveGame();
  };



  const tryAutoBuy = () => {
    for (const u of upgrades) {
      if (u.purchased || upgradeLockedReason(u)) continue;
      if (st.gears >= u.price) {
        buyUpgrade(u.id);
        return;
      }
    }
    for (const b of [...buildings].reverse()) {
      if (!isBldUnlocked(b)) continue;
      if (affordableCount(b, st.gears, '1') > 0) {
        const prev = st.purchaseMode;
        st.purchaseMode = '1';
        buyBuilding(b.id);
        st.purchaseMode = prev;
        return;
      }
    }
  };

  return {
    bld,
    skillLv,
    price,
    mktMult,
    getTotalGPS,
    getManualGain,
    getGpsBreakdown,
    affordableCount,
    purchaseCost,
    upgradeLockedReason,
    isBldUnlocked,
    buyBuilding,
    buyUpgrade,
    tryAutoBuy,
  };
};
