// 公式系统（纯函数）
// 为什么拆分：把高价值数值公式从运行时逻辑解耦，便于单元测试与平衡校验。
(function initFormulaSystem(globalScope) {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const calcBuildingPrice = ({ basePrice, owned, growth, discount = 1, offset = 0 }) => {
    return Math.floor(basePrice * Math.pow(growth, owned + offset) * discount);
  };

  const calcPurchaseCost = ({ basePrice, owned, growth, discount = 1, count }) => {
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += calcBuildingPrice({ basePrice, owned, growth, discount, offset: i });
    }
    return total;
  };

  const calcAffordableCount = ({ basePrice, owned, growth, discount = 1, budget, mode, maxIterations = 10000 }) => {
    if (mode === '1') {
      return budget >= calcBuildingPrice({ basePrice, owned, growth, discount }) ? 1 : 0;
    }
    if (mode === '10' || mode === '100') {
      const target = Number(mode);
      let total = 0;
      for (let i = 0; i < target; i++) {
        total += calcBuildingPrice({ basePrice, owned, growth, discount, offset: i });
        if (total > budget) return i;
      }
      return target;
    }

    let n = 0;
    let total = 0;
    while (n < maxIterations) {
      total += calcBuildingPrice({ basePrice, owned, growth, discount, offset: n });
      if (total > budget) return n;
      n++;
    }
    return n;
  };

  const calcPrestigeGain = ({ lifetimeGears, divisor = 2000 }) => Math.floor(Math.sqrt(Math.max(0, lifetimeGears) / divisor));

  const calcOfflineGain = ({ gps, elapsedSec, capSec }) => {
    const secs = clamp(elapsedSec, 0, capSec);
    return Math.max(0, gps * secs);
  };

  const api = {
    calcBuildingPrice,
    calcPurchaseCost,
    calcAffordableCount,
    calcPrestigeGain,
    calcOfflineGain,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.GameFormulas = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
