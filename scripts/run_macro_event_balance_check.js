#!/usr/bin/env node
'use strict';

const DEFAULT_SWITCHES = 120;
const DEFAULT_SEED = 42;
const DEFAULT_EVENT_CHANCE = 0.35;
const DEFAULT_GUIDANCE_BIAS = 0.5;
const DEFAULT_REWARD_BASE = 100;
const DEFAULT_REWARD_RATE_SCALE = 35;
const DEFAULT_PENALTY_BASE = 80;
const DEFAULT_PENALTY_RATE_SCALE = 24;
const DEFAULT_PENALTY_GEAR_RATIO = 0.03;

const MACRO_EVENTS = [
  { id: 'inflation_hot', name: '通胀升温', guidanceBiasUp: 0.8, durationSwitches: 3, preferredBuildingId: 'bank', nextEventId: 'growth_cool' },
  { id: 'growth_cool', name: '增长放缓', guidanceBiasUp: 0.2, durationSwitches: 3, preferredBuildingId: 'logistics', nextEventId: 'inflation_hot' },
];

const help = `用法:
  node scripts/run_macro_event_balance_check.js [options]

选项:
  --switches <n>               模拟市场切换次数，默认 ${DEFAULT_SWITCHES}
  --seed <n>                   随机种子，默认 ${DEFAULT_SEED}
  --event-chance <f>           每次切换触发事件概率(0~1)，默认 ${DEFAULT_EVENT_CHANCE}
  --reward-base <n>            命中最低奖励，默认 ${DEFAULT_REWARD_BASE}
  --reward-rate-scale <n>      命中奖励利率系数，默认 ${DEFAULT_REWARD_RATE_SCALE}
  --penalty-base <n>           误判最低惩罚上限，默认 ${DEFAULT_PENALTY_BASE}
  --penalty-rate-scale <n>     误判惩罚利率系数，默认 ${DEFAULT_PENALTY_RATE_SCALE}
  --penalty-gear-ratio <f>     误判按当前资本扣减比例，默认 ${DEFAULT_PENALTY_GEAR_RATIO}
  --json                       仅输出 JSON（便于 CI 解析）
  -h, --help                   显示帮助
`;

const args = process.argv.slice(2);
const opts = {
  switches: DEFAULT_SWITCHES,
  seed: DEFAULT_SEED,
  eventChance: DEFAULT_EVENT_CHANCE,
  rewardBase: DEFAULT_REWARD_BASE,
  rewardRateScale: DEFAULT_REWARD_RATE_SCALE,
  penaltyBase: DEFAULT_PENALTY_BASE,
  penaltyRateScale: DEFAULT_PENALTY_RATE_SCALE,
  penaltyGearRatio: DEFAULT_PENALTY_GEAR_RATIO,
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
  else if (a === '--reward-base') opts.rewardBase = readInt(args[++i], '--reward-base', 1);
  else if (a === '--reward-rate-scale') opts.rewardRateScale = readInt(args[++i], '--reward-rate-scale', 1);
  else if (a === '--penalty-base') opts.penaltyBase = readInt(args[++i], '--penalty-base', 1);
  else if (a === '--penalty-rate-scale') opts.penaltyRateScale = readInt(args[++i], '--penalty-rate-scale', 1);
  else if (a === '--penalty-gear-ratio') opts.penaltyGearRatio = readFloat(args[++i], '--penalty-gear-ratio', 0, 1);
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

const rand = mulberry32(opts.seed);

let gears = 10000;
let policyRate = 2.5;
let macroEventId = '';
let macroEventTimer = 0;
let rateOutlookBiasUp = DEFAULT_GUIDANCE_BIAS;
let outlookPredictedUp = true;
let outlookHit = 0;
let eventTriggers = 0;
let netDelta = 0;
let lastMacroEventId = "";
let chainTriggers = 0;
const preferredBreakdown = { bank: 0, logistics: 0, none: 0 };

const eventBreakdown = Object.fromEntries(MACRO_EVENTS.map((e) => [e.id, 0]));
const deltas = [];

const findEvent = (id) => MACRO_EVENTS.find((e) => e.id === id) || null;
const pickEvent = () => MACRO_EVENTS[Math.floor(rand() * MACRO_EVENTS.length)];
const chooseEvent = () => {
  const prev = findEvent(lastMacroEventId);
  const target = prev?.nextEventId ? findEvent(prev.nextEventId) : null;
  if (target && rand() < 0.65) return { event: target, chained: true };
  return { event: pickEvent(), chained: false };
};

for (let i = 0; i < opts.switches; i += 1) {
  const actualUp = rand() < rateOutlookBiasUp;
  const predictedUp = outlookPredictedUp;
  const hit = actualUp === predictedUp;

  const rateStep = actualUp ? 0.25 : -0.25;
  policyRate = Math.max(0, Math.min(8, policyRate + rateStep));

  let delta = 0;
  if (hit) {
    outlookHit += 1;
    const bonus = Math.max(opts.rewardBase, Math.floor((1 + policyRate) * opts.rewardRateScale));
    gears += bonus;
    delta += bonus;
  } else {
    const lossCap = Math.max(opts.penaltyBase, Math.floor((1 + policyRate) * opts.penaltyRateScale));
    const loss = Math.min(lossCap, Math.floor(gears * opts.penaltyGearRatio));
    gears = Math.max(0, gears - loss);
    delta -= loss;
  }
  deltas.push(delta);
  netDelta += delta;

  if (macroEventTimer > 0) {
    macroEventTimer = Math.max(0, macroEventTimer - 1);
    if (macroEventTimer === 0) macroEventId = '';
  }

  if (macroEventTimer === 0 && rand() < opts.eventChance) {
    const picked = chooseEvent();
    const ev = picked.event;
    macroEventId = ev.id;
    lastMacroEventId = ev.id;
    macroEventTimer = ev.durationSwitches;
    eventTriggers += 1;
    eventBreakdown[ev.id] += 1;
    if (picked.chained) chainTriggers += 1;
    preferredBreakdown[ev.preferredBuildingId || 'none'] = (preferredBreakdown[ev.preferredBuildingId || 'none'] || 0) + 1;
  }

  const active = findEvent(macroEventId);
  rateOutlookBiasUp = active ? active.guidanceBiasUp : DEFAULT_GUIDANCE_BIAS;
  outlookPredictedUp = rateOutlookBiasUp >= 0.5;
}

const mean = deltas.reduce((s, x) => s + x, 0) / deltas.length;
const variance = deltas.reduce((s, x) => s + (x - mean) ** 2, 0) / deltas.length;
const std = Math.sqrt(variance);
const hitRate = outlookHit / opts.switches;
const netPerSwitch = netDelta / opts.switches;

const result = {
  switches: opts.switches,
  seed: opts.seed,
  eventChance: opts.eventChance,
  params: {
    rewardBase: opts.rewardBase,
    rewardRateScale: opts.rewardRateScale,
    penaltyBase: opts.penaltyBase,
    penaltyRateScale: opts.penaltyRateScale,
    penaltyGearRatio: opts.penaltyGearRatio,
  },
  totalEventTriggers: eventTriggers,
  chainTriggers,
  eventBreakdown,
  preferredBreakdown,
  outlookHitRate: Number(hitRate.toFixed(4)),
  netDelta,
  netDeltaPerSwitch: Number(netPerSwitch.toFixed(4)),
  netDeltaStdPerSwitch: Number(std.toFixed(4)),
  endingGears: gears,
  recommendation:
    std > 220
      ? '奖惩波动偏大，建议降低 penalty-gear-ratio 或提升 reward-base'
      : (hitRate < 0.58 || hitRate > 0.82)
        ? '前瞻命中率偏离目标区间，建议微调事件偏置或触发概率'
        : '命中率与奖惩波动处于可控区间，建议保持当前参数',
};

if (opts.jsonOnly) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log('MACRO_EVENT_REPORT');
console.log(JSON.stringify(result, null, 2));
