#!/usr/bin/env node

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const FINANCE_BASE_APR = 0.045;
const FINANCE_TIER_APR_BONUS = 0.018;
const FINANCE_CYCLE_AMPLITUDE = 0.02;

const marketTimeline = ['stable', 'overheat', 'pullback', 'panic'];
const marketMods = {
  stable: { aprDelta: 0, cycleScale: 0.8 },
  overheat: { aprDelta: 0.018, cycleScale: 1.15 },
  pullback: { aprDelta: -0.012, cycleScale: 0.95 },
  panic: { aprDelta: -0.022, cycleScale: 0.7 }
};

const strategies = {
  conservative: { aprMult: 0.9, drawdown: 0.0008 },
  balanced: { aprMult: 1.0, drawdown: 0.0018 },
  aggressive: { aprMult: 1.22, drawdown: 0.002 }
};

const quantile = (arr, q) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
};

const run = (mode) => {
  const strategy = strategies[mode];
  let capital = 10000;
  let peak = capital;
  let maxDrawdown = 0;
  const aprSeries = [];

  for (let t = 0; t < 1200; t += 1) {
    const market = marketMods[marketTimeline[Math.floor(t / 75) % marketTimeline.length]];
    const cycle = FINANCE_CYCLE_AMPLITUDE * Math.sin(t / 45) * market.cycleScale;
    const apr = Math.max(0.01, FINANCE_BASE_APR + 3 * FINANCE_TIER_APR_BONUS + market.aprDelta + cycle) * strategy.aprMult;
    aprSeries.push(apr);

    // 利润累积
    capital += capital * apr * 0.01;

    // 风险回撤窗口：激进策略在回调/恐慌时有更高下行
    if (market.aprDelta < 0) {
      capital *= 1 - strategy.drawdown * (market.aprDelta < -0.02 ? 1 : 0.6);
    }

    peak = Math.max(peak, capital);
    const dd = peak > 0 ? (peak - capital) / peak : 0;
    maxDrawdown = Math.max(maxDrawdown, dd);
  }

  return {
    mode,
    endCapital: capital,
    maxDrawdown,
    aprP10: quantile(aprSeries, 0.1),
    aprP50: quantile(aprSeries, 0.5),
    aprP90: quantile(aprSeries, 0.9)
  };
};

const stable = run('conservative');
const balanced = run('balanced');
const aggressive = run('aggressive');

// 峰谷切换必须存在波动
assert(stable.aprP90 > stable.aprP10, 'apr quantiles should show market wave switching');

// 回撤上限护栏（可按路线图调）
assert(stable.maxDrawdown < 0.12, 'conservative drawdown should remain low');
assert(balanced.maxDrawdown < 0.22, 'balanced drawdown should remain moderate');
assert(aggressive.maxDrawdown < 0.4, 'aggressive drawdown should stay bounded');

// 激进策略不得长期稳定优于平衡：收益更高但伴随显著更高回撤
assert(aggressive.endCapital > balanced.endCapital, 'aggressive should have higher upside');
assert(aggressive.maxDrawdown > balanced.maxDrawdown, 'aggressive must pay higher drawdown cost than balanced');

console.log('finance checks passed');
