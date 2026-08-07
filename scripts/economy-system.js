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
  MACRO_PREFERRED_BONUS,
  dirty,
  buildingViewMap,
  pushLog,
  saveGame,
  fmt,
  sfxBuy,
  applyUpgradeEffect
}) => {
  // 预计算 1.15^n 查表（消除每帧 Math.pow 调用，n>TABLE_MAX 时回退）
  // priceGrowth 可由场景系统动态覆盖（UGC 场景编辑器），切换场景时重建查表
  let _priceGrowth = PRICE_GROWTH;
  const _powTable = [];
  const _POW_TABLE_MAX = 5000;
  const _rebuildPowTable = () => {
    for (let i = 0; i <= _POW_TABLE_MAX; i++) _powTable[i] = Math.pow(_priceGrowth, i);
  };
  _rebuildPowTable();
  const _cachedPow = (n) => (n <= _POW_TABLE_MAX ? _powTable[n] : Math.pow(_priceGrowth, n));

  // 每建筑价格缓存：owned 变化时才重算，消除 render 帧内重复 price() 调用
  const _priceCache = new Map(); // b.id → { owned, price0 }
  const _getCachedPrice = (b) => {
    const c = _priceCache.get(b.id);
    if (c && c.owned === b.owned) return c.price0;
    const p0 = Math.floor(b.basePrice * _cachedPow(b.owned) * discount());
    _priceCache.set(b.id, { owned: b.owned, price0: p0 });
    return p0;
  };

  // 预计算查找表（消除 O(n) find 在热路径中的每帧调用）
  const _bldMap = new Map(buildings.map(b => [b.id, b]));
  const _skillMap = new Map(skills.map(s => [s.id, s]));
  const _upgradeMap = new Map(upgrades.map(u => [u.id, u]));

  const bld = (id) => _bldMap.get(id) || null;
  const skillLv = (id) => _skillMap.get(id)?.level || 0;
  // discount() 对象池：skillLv 变化极稀疏，缓存消除每帧重复乘法运算
  let _discountCache = null;
  let _discountSkillLevel = -1;
  const discount = () => {
    const lv = skillLv('bulk_discount');
    if (lv === _discountSkillLevel) return _discountCache;
    _discountCache = Math.max(0.6, 1 - lv * 0.04);
    _discountSkillLevel = lv;
    return _discountCache;
  };
  // price(b,off) 在购买逻辑中用 offset>0，render 帧内只用 off=0 用 _getCachedPrice 缓存
  const price = (b, off = 0) => {
    if (off === 0) return _getCachedPrice(b);
    return Math.floor(b.basePrice * _cachedPow(b.owned + off) * discount());
  };

  const bldPreferredMult = (b) => (st.macroPreferredBuildingId && st.macroPreferredBuildingId === b.id ? 1 + MACRO_PREFERRED_BONUS : 1);
  const bldGPS = (b) => b.dps * b.owned * (bldBoost[b.id] || 1) * bldPreferredMult(b);
  // baseGPS 已由 _getBaseGPS() 缓存，移除重复定义
  const resMult = () => 1 + st.researchPoints * 0.1;
  const skillGPS = () => 1 + skillLv('line_optimizer') * 0.25;
  // 场景参数读取（UGC 场景编辑器）：bullBonus/bearPenalty 可被 st.scenarioParams 覆盖
  const _scp = (key, fallback) => {
    const v = st.scenarioParams && st.scenarioParams[key];
    return v != null && isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback;
  };
  const mktMult = () => {
    const base = st.marketIsBull ? _scp('bullBonus', MARKET_BULL_BONUS) : _scp('bearPenalty', MARKET_BEAR_PENALTY);
    return st.marketIsBull ? base * (1 + skillLv('market_sense') * 0.1) : base;
  };
  const skillMasteryMult = () => 1 + (st.skillMasteryTier || 0) * SKILL_MASTERY_BONUS;

  // GPS 乘法链路缓存（Matching Principle 启发）：避免每帧重复计算 st.gpsMultiplier × resMult × skillGPS × mktMult × skillMasteryMult
  let _gpsMultCache = null;
  let _gpsMultDirty = true;
  const _invalidateGPSMult = () => { _gpsMultDirty = true; };
  let _synergyMultFn = null; // () => number，由 synergy-system 注入
  const setSynergyMultiplier = (fn) => { _synergyMultFn = fn; _invalidateGPSMult(); };
  let _regionMultFn = null; // () => number，由 global-market-system 注入
  const setRegionMultiplier = (fn) => { _regionMultFn = fn; _invalidateGPSMult(); };
  let _crisisMultFn = null; // () => number，由 crisis-system 注入
  const setCrisisMultiplier = (fn) => { _crisisMultFn = fn; _invalidateGPSMult(); };
  let _guildMultFn = null; // () => number，由 guild-system 注入
  const setGuildMultiplier = (fn) => { _guildMultFn = fn; _invalidateGPSMult(); };
  let _boostMultFn = null; // () => number，由 boost-system 注入
  const setBoostMultiplier = (fn) => { _boostMultFn = fn; _invalidateGPSMult(); };
  let _subscriptionMultFn = null; // () => number，由 subscription-system 注入
  const setSubscriptionMultiplier = (fn) => { _subscriptionMultFn = fn; _invalidateGPSMult(); };
  let _riskLambdaFn = null;  // () => number，由 asset-allocation-system 注入
  let _riskVolatilityFn = null; // () => number，由 asset-allocation-system 注入
  const setRiskLambdaFn = (fn) => { _riskLambdaFn = fn; _invalidateROICache(); };
  const setRiskVolatilityFn = (fn) => { _riskVolatilityFn = fn; _invalidateGPSMult(); };

  // baseGPS 缓存：buildings.reduce() 在主循环每帧调用，改为 dirty 时才重算
  let _baseGPSCache = null;
  let _baseGPSDirty = true;
  const _getBaseGPS = () => {
    if (!_baseGPSDirty) return _baseGPSCache;
    _baseGPSCache = buildings.reduce((s, b) => s + bldGPS(b), 0);
    _baseGPSDirty = false;
    return _baseGPSCache;
  };
  const _invalidateBaseGPS = () => { _baseGPSDirty = true; };

  const _getGPSMult = () => {
    if (!_gpsMultDirty) return _gpsMultCache;
    const riskVolScale = (_riskVolatilityFn && _riskVolatilityFn()) || 1.0;
    const regionBonus = (_regionMultFn && _regionMultFn()) || 1.0;
    const crisisPenalty = (_crisisMultFn && _crisisMultFn()) || 1.0;
    const guildBonus = (_guildMultFn && _guildMultFn()) || 1.0;
    const boostBonus = (_boostMultFn && _boostMultFn()) || 1.0;
    const subscriptionBonus = (_subscriptionMultFn && _subscriptionMultFn()) || 1.0;
    _gpsMultCache = st.gpsMultiplier * resMult() * skillGPS() * mktMult() * skillMasteryMult() * ((_synergyMultFn && _synergyMultFn()) || 1) * regionBonus * crisisPenalty * guildBonus * boostBonus * subscriptionBonus * riskVolScale;
    _gpsMultDirty = false;
    return _gpsMultCache;
  };

  const getTotalGPS = () => _getBaseGPS() * _getGPSMult();
  const getManualGain = () => st.manualPower * st.manualMult * (1 + skillLv('manual_mastery') * 0.3);

  const affordableCount = (b, budget, mode) => {
    if (mode === '1') return budget >= price(b) ? 1 : 0;
    if (mode === '10' || mode === '100') {
      const tgt = Number(mode);
      let tot = 0;
      for (let i = 0; i < tgt; i++) {
        tot += price(b, i);
        if (tot > budget) return i;
      }
      return tgt;
    }
    let n = 0;
    let tot = 0;
    while (n < 10000) {
      tot += price(b, n);
      if (tot > budget) return n;
      n++;
    }
    return n;
  };

  const purchaseCost = (b, n) => {
    let c = 0;
    for (let i = 0; i < n; i++) c += price(b, i);
    return c;
  };

  const upgradeLockedReason = (u) => {
    if (st.researchPoints < u.unlockRP) return `需要 ${u.unlockRP} RP`;
    if (u.requires) {
      const r = _upgradeMap.get(u.requires);
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
    _invalidateGPSMult();
    _invalidateBaseGPS();
    _invalidateROICache();
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
    _invalidateGPSMult();
    _invalidateBaseGPS();
    _invalidateROICache(); // bldBoost 改变时 ROI 排序可能变化
    saveGame();
  };

  // ROI 排序缓存：tryAutoBuy 每 0.5s 调用，sort 内每对调用 _buildingROI (price→pow+floor)
  // 改为 dirty 时才重算，避免每 0.5s 重复 O(n log n) 排序
  let _roiDirty = true;
  let _roiSorted = null;
  let _roiUnlocked = null;
  const _invalidateROICache = () => { _roiDirty = true; };

  // 边际 DPS = 买第 owned 个后再买 1 个的增量 DPS（边际产出）
  const _marginalDPS = (b) => b.dps * (bldBoost[b.id] || 1) * bldPreferredMult(b);

  // ROI = 边际 DPS / 边际成本（买第 owned+1 个时，第 owned 个的 price）
  // 越高越值得优先买
  // 风险偏好：lambda 幂运算调整排序（保守压缩差距，激进放大差距）
  const _buildingROI = (b) => {
    const mc = price(b);
    const rawROI = mc > 0 ? _marginalDPS(b) / mc : 0;
    // 应用 lambda 幂运算凸性变换（由 asset-allocation-system 注入）
    const lambda = (_riskLambdaFn && _riskLambdaFn()) || 1.0;
    if (lambda !== 1.0 && rawROI > 0) {
      return Math.pow(rawROI, lambda);
    }
    return rawROI;
  };

  const _getROISorted = () => {
    if (!_roiDirty) return _roiSorted;
    _roiUnlocked = buildings.filter(isBldUnlocked);
    _roiSorted = _roiUnlocked.slice().sort((a, b) => _buildingROI(b) - _buildingROI(a));
    _roiDirty = false;
    return _roiSorted;
  };

  // Deep RL Job Shop Scheduling 启发：用 ROI 评分替代逆序贪心
  // budgetSplit: {buildingBudget, upgradeBudget, marginReserve}，来自 asset-allocation-system
  const tryAutoBuy = (budgetSplit) => {
    let totalBought = 0;

    // 使用分配预算或回退到全部资金
    const buildingBudget = budgetSplit ? budgetSplit.buildingBudget : st.gears;
    const upgradeBudget = budgetSplit ? budgetSplit.upgradeBudget : st.gears;

    // —— 建筑：使用 ROI 缓存排序 + 分配预算，避免每 0.5s 重复 O(n log n) sort+pow+floor
    const sorted = _getROISorted();
    let didBuyBuilding = false;
    if (sorted.length > 0 && buildingBudget > 0) {
      let budget = buildingBudget;
      for (const b of sorted) {
        if (budget <= 0) break;
        const maxN = affordableCount(b, budget, 'max');
        if (maxN <= 0) continue;
        const cost = purchaseCost(b, maxN);
        if (cost > budget) {
          // 二分精确可购数量（避免 purchaseCost 循环累积误差）
          let lo = 0, hi = maxN;
          while (lo + 1 < hi) {
            const mid = (lo + hi) >> 1;
            purchaseCost(b, mid) <= budget ? (lo = mid) : (hi = mid);
          }
          const n = lo;
          if (n <= 0) continue;
          st.gears -= purchaseCost(b, n); b.owned += n;
          totalBought += n; budget -= purchaseCost(b, n);
        } else {
          st.gears -= cost; b.owned += maxN;
          totalBought += maxN; budget -= cost;
        }
        didBuyBuilding = true;
      }
      // 购买后一次性失效（而非每建筑重复调用）
      if (didBuyBuilding) {
        _invalidateGPSMult();
        _invalidateBaseGPS();
        _invalidateROICache();
      }
    }

    // —— 升级：按价格升序（便宜优先），买得起多少买多少（使用升级预算）
    if (upgradeBudget > 0 && st.gears >= upgradeBudget) {
      // 如果升级预算大于当前余额，只能花掉余额
      const actualUpgradeBudget = Math.min(upgradeBudget, st.gears);
      const avail = upgrades
        .filter(u => !u.purchased && !upgradeLockedReason(u) && actualUpgradeBudget >= u.price)
        .sort((a, b) => a.price - b.price);
      for (const u of avail) {
        if (actualUpgradeBudget < u.price) break;
        st.gears -= u.price; u.purchased = true; applyUpgradeEffect(u);
        _invalidateGPSMult();
        _invalidateBaseGPS();
        _invalidateROICache(); // bldBoost 改变后 ROI 排序可能变化
        totalBought++;
      }
    }

    if (totalBought > 0) {
      dirty.buildings = dirty.upgrades = dirty.stats = dirty.logs = true;
      saveGame();
    }
    return totalBought;
  };

  // 调试用 GPS 分解：debug-system 依赖此接口
  const getGpsBreakdown = () => {
    const base = _getBaseGPS();
    const riskVolScale = (_riskVolatilityFn && _riskVolatilityFn()) || 1.0;
    const regionBonus = (_regionMultFn && _regionMultFn()) || 1.0;
    const crisisPenalty = (_crisisMultFn && _crisisMultFn()) || 1.0;
    const guildBonus = (_guildMultFn && _guildMultFn()) || 1.0;
    const boostBonus = (_boostMultFn && _boostMultFn()) || 1.0;
    const subscriptionBonus = (_subscriptionMultFn && _subscriptionMultFn()) || 1.0;
    const synergyBonus = (_synergyMultFn && _synergyMultFn()) || 1.0;
    const factors = {
      gpsMultiplier: st.gpsMultiplier,
      research: resMult(),
      skillGPS: skillGPS(),
      market: mktMult(),
      skillMastery: skillMasteryMult(),
      synergy: synergyBonus,
      region: regionBonus,
      crisis: crisisPenalty,
      guild: guildBonus,
      boost: boostBonus,
      subscription: subscriptionBonus,
      riskVolatility: riskVolScale,
    };
    const mult = _getGPSMult();
    return {
      baseGPS: base,
      finalMult: mult,
      totalGPS: base * mult,
      factors,
      productCheck: Object.values(factors).reduce((a, v) => a * v, 1),
    };
  };

  return {
    bld,
    skillLv,
    price,
    mktMult,
    getTotalGPS,
    getGpsBreakdown,
    getManualGain,
    affordableCount,
    purchaseCost,
    upgradeLockedReason,
    isBldUnlocked,
    buyBuilding,
    buyUpgrade,
    tryAutoBuy,
    setSynergyMultiplier,
    setRegionMultiplier,
    setCrisisMultiplier,
    setGuildMultiplier,
    setBoostMultiplier,
    setSubscriptionMultiplier,
    setRiskLambdaFn,
    setRiskVolatilityFn,
    // 场景系统动态覆盖价格增速/市场乘数（UGC 场景编辑器）
    setScenarioParams: (params = null) => {
      const p = params && typeof params === 'object' && Object.keys(params).length ? params : null;
      st.scenarioParams = p;
      const g = p ? Number(p.priceGrowth) : NaN;
      const target = isFinite(g) && g > 0 ? g : PRICE_GROWTH;
      if (Math.abs(target - _priceGrowth) > 1e-9) {
        _priceGrowth = target;
        _rebuildPowTable();
        _priceCache.clear();
        _invalidateROICache();
      }
      _invalidateGPSMult(); // bullBonus/bearPenalty 变化影响 mktMult 链路
      if (dirty) dirty.buildings = dirty.market = dirty.stats = true;
    },
    invalidateROICache: _invalidateROICache,
    invalidateBaseGPS: _invalidateBaseGPS,
    invalidateGPSMult: _invalidateGPSMult,
  };
};
