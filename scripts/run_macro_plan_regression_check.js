#!/usr/bin/env node
'use strict';

const DEFAULT_SWITCHES = 600;
const DEFAULT_SEED = 42;
const DEFAULT_EVENT_CHANCE = 0.35;
const DEFAULT_BASE_RETURN = 120;
const DEFAULT_VOLATILITY = 0.2;
const DEFAULT_PREFERRED_BONUS = 0.12;
const DEFAULT_PLAN_SWITCH_COST = 0.015;
const DEFAULT_MIN_LIFT_PER_SWITCH = 1.5;
const DEFAULT_MAX_VOL_RATIO = 1.25;

const MACRO_EVENTS = [
  { id: 'inflation_hot', guidanceBiasUp: 0.8, durationSwitches: 3, preferredBuildingId: 'bank' },
  { id: 'growth_cool', guidanceBiasUp: 0.2, durationSwitches: 3, preferredBuildingId: 'logistics' },
];

const help = `用法:
  node scripts/run_macro_plan_regression_check.js [options]

选项:
  --switches <n>                  模拟切换次数，默认 ${DEFAULT_SWITCHES}
  --seed <n>                      随机种子，默认 ${DEFAULT_SEED}
  --event-chance <f>              事件触发概率(0~1)，默认 ${DEFAULT_EVENT_CHANCE}
  --base-return <n>               单次基础收益，默认 ${DEFAULT_BASE_RETURN}
  --volatility <f>                收益波动系数(0~1)，默认 ${DEFAULT_VOLATILITY}
  --preferred-bonus <f>           命中偏好产业额外收益，默认 ${DEFAULT_PREFERRED_BONUS}
  --plan-switch-cost <f>          自动预案切换成本，默认 ${DEFAULT_PLAN_SWITCH_COST}
  --min-lift-per-switch <f>       阈值：预案开启每次切换最小收益提升，默认 ${DEFAULT_MIN_LIFT_PER_SWITCH}
  --max-volatility-ratio <f>      阈值：预案开启/关闭波动比上限，默认 ${DEFAULT_MAX_VOL_RATIO}
  --json                          仅输出 JSON
  -h, --help                      显示帮助
`;

const args = process.argv.slice(2);
const opts = {
  switches: DEFAULT_SWITCHES,
  seed: DEFAULT_SEED,
  eventChance: DEFAULT_EVENT_CHANCE,
  baseReturn: DEFAULT_BASE_RETURN,
  volatility: DEFAULT_VOLATILITY,
  preferredBonus: DEFAULT_PREFERRED_BONUS,
  planSwitchCost: DEFAULT_PLAN_SWITCH_COST,
  minLiftPerSwitch: DEFAULT_MIN_LIFT_PER_SWITCH,
  maxVolatilityRatio: DEFAULT_MAX_VOL_RATIO,
  jsonOnly: false,
};

const readInt = (v, name, min = 0) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) {
    console.error(`${name} 必须是 >= ${min} 的整数`);
    process.exit(1);
  }
  return n;
};

const readFloat = (v, name, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    console.error(`${name} 必须在 [${min}, ${max}]`);
    process.exit(1);
  }
  return n;
};

for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--switches') opts.switches = readInt(args[++i], '--switches', 1);
  else if (a === '--seed') opts.seed = readInt(args[++i], '--seed', 0);
  else if (a === '--event-chance') opts.eventChance = readFloat(args[++i], '--event-chance', 0, 1);
  else if (a === '--base-return') opts.baseReturn = readInt(args[++i], '--base-return', 1);
  else if (a === '--volatility') opts.volatility = readFloat(args[++i], '--volatility', 0, 1);
  else if (a === '--preferred-bonus') opts.preferredBonus = readFloat(args[++i], '--preferred-bonus', 0, 1);
  else if (a === '--plan-switch-cost') opts.planSwitchCost = readFloat(args[++i], '--plan-switch-cost', 0, 1);
  else if (a === '--min-lift-per-switch') opts.minLiftPerSwitch = readFloat(args[++i], '--min-lift-per-switch', -9999, 9999);
  else if (a === '--max-volatility-ratio') opts.maxVolatilityRatio = readFloat(args[++i], '--max-volatility-ratio', 0, 9999);
  else if (a === '--json') opts.jsonOnly = true;
  else if (a === '--help' || a === '-h') {
    console.log(help);
    process.exit(0);
  } else {
    console.error(`未知参数: ${a}`);
    console.error(help);
    process.exit(1);
  }
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

function simulate({ enablePlan, seedOffset }) {
  const rand = mulberry32(opts.seed + seedOffset);
  let policyRate = 2.5;
  let macroEventId = '';
  let macroTimer = 0;
  let activePlan = 'baseline';
  let totalReturn = 0;
  const deltas = [];
  let planSwitches = 0;
  let preferredHits = 0;

  for (let i = 0; i < opts.switches; i += 1) {
    let switchedThisTick = false;
    if (macroTimer > 0) {
      macroTimer = Math.max(0, macroTimer - 1);
      if (macroTimer === 0) macroEventId = '';
    }

    if (macroTimer === 0 && rand() < opts.eventChance) {
      const ev = MACRO_EVENTS[Math.floor(rand() * MACRO_EVENTS.length)];
      macroEventId = ev.id;
      macroTimer = ev.durationSwitches;
      if (enablePlan && activePlan !== ev.preferredBuildingId) {
        activePlan = ev.preferredBuildingId;
        planSwitches += 1;
        switchedThisTick = true;
      }
    }

    const currentEvent = MACRO_EVENTS.find((e) => e.id === macroEventId) || null;
    const expectedUp = currentEvent ? currentEvent.guidanceBiasUp >= 0.5 : true;
    const actualUp = rand() < (currentEvent ? currentEvent.guidanceBiasUp : 0.5);
    const rateStep = actualUp ? 0.25 : -0.25;
    policyRate = clamp(policyRate + rateStep, 0, 8);

    const randomShock = (rand() * 2 - 1) * opts.volatility;
    const rateDrag = 1 - Math.abs(policyRate - 2.5) * 0.02;
    let gross = opts.baseReturn * (1 + randomShock) * rateDrag;

    if (enablePlan && currentEvent && activePlan === currentEvent.preferredBuildingId) {
      gross *= 1 + opts.preferredBonus;
      preferredHits += 1;
    }
    if (enablePlan && expectedUp !== actualUp) {
      gross *= 0.985;
    }

    const switchCost = enablePlan && switchedThisTick ? opts.baseReturn * opts.planSwitchCost : 0;
    const delta = Math.max(0, gross - switchCost);
    totalReturn += delta;
    deltas.push(delta);
  }

  const mean = totalReturn / opts.switches;
  const variance = deltas.reduce((sum, d) => sum + (d - mean) ** 2, 0) / deltas.length;
  return {
    totalReturn: Number(totalReturn.toFixed(2)),
    returnPerSwitch: Number(mean.toFixed(4)),
    stdPerSwitch: Number(Math.sqrt(variance).toFixed(4)),
    planSwitches,
    preferredHits,
  };
}

const withoutPlan = simulate({ enablePlan: false, seedOffset: 0 });
const withPlan = simulate({ enablePlan: true, seedOffset: 0 });
const liftPerSwitch = Number((withPlan.returnPerSwitch - withoutPlan.returnPerSwitch).toFixed(4));
const volatilityRatio = Number((withPlan.stdPerSwitch / Math.max(0.0001, withoutPlan.stdPerSwitch)).toFixed(4));

const gate = {
  minLiftPerSwitch: opts.minLiftPerSwitch,
  maxVolatilityRatio: opts.maxVolatilityRatio,
  passLift: liftPerSwitch >= opts.minLiftPerSwitch,
  passVolatility: volatilityRatio <= opts.maxVolatilityRatio,
};
gate.passed = gate.passLift && gate.passVolatility;

const result = {
  switches: opts.switches,
  seed: opts.seed,
  params: {
    eventChance: opts.eventChance,
    baseReturn: opts.baseReturn,
    volatility: opts.volatility,
    preferredBonus: opts.preferredBonus,
    planSwitchCost: opts.planSwitchCost,
  },
  comparison: {
    withoutPlan,
    withPlan,
    liftPerSwitch,
    volatilityRatio,
  },
  thresholdGate: gate,
  recommendation: gate.passed
    ? '预案收益提升与波动约束均达标，可保持当前宏观自动预案参数。'
    : '阈值门禁未通过，建议提高偏好收益或降低切换成本后重测。',
};

if (opts.jsonOnly) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('MACRO_PLAN_REGRESSION_REPORT');
  console.log(JSON.stringify(result, null, 2));
}

process.exit(gate.passed ? 0 : 2);
