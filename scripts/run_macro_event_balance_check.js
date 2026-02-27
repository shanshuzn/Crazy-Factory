#!/usr/bin/env node
'use strict';

const DEFAULT_SWITCHES = 120;
const DEFAULT_SEED = 42;
const DEFAULT_EVENT_CHANCE = 0.35;
const DEFAULT_GUIDANCE_BIAS = 0.5;

const MACRO_EVENTS = [
  { id: 'inflation_hot', name: '通胀升温', guidanceBiasUp: 0.8, durationSwitches: 3 },
  { id: 'growth_cool', name: '增长放缓', guidanceBiasUp: 0.2, durationSwitches: 3 },
];

const help = `用法:
  node scripts/run_macro_event_balance_check.js [options]

选项:
  --switches <n>     模拟市场切换次数，默认 ${DEFAULT_SWITCHES}
  --seed <n>         随机种子，默认 ${DEFAULT_SEED}
  --event-chance <f> 每次切换触发事件概率(0~1)，默认 ${DEFAULT_EVENT_CHANCE}
  --json             仅输出 JSON（便于 CI 解析）
  -h, --help         显示帮助
`;

const args = process.argv.slice(2);
const opts = {
  switches: DEFAULT_SWITCHES,
  seed: DEFAULT_SEED,
  eventChance: DEFAULT_EVENT_CHANCE,
  jsonOnly: false,
};

for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--switches') {
    const v = Number(args[++i]);
    if (!Number.isInteger(v) || v <= 0) {
      console.error('--switches 必须是正整数');
      process.exit(1);
    }
    opts.switches = v;
  } else if (a === '--seed') {
    const v = Number(args[++i]);
    if (!Number.isInteger(v) || v < 0) {
      console.error('--seed 必须是非负整数');
      process.exit(1);
    }
    opts.seed = v;
  } else if (a === '--event-chance') {
    const v = Number(args[++i]);
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      console.error('--event-chance 必须在 [0,1]');
      process.exit(1);
    }
    opts.eventChance = v;
  } else if (a === '--json') {
    opts.jsonOnly = true;
  } else if (a === '--help' || a === '-h') {
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

let macroEventId = '';
let macroEventTimer = 0;
let rateOutlookBiasUp = DEFAULT_GUIDANCE_BIAS;
let outlookPredictedUp = true;
let outlookHit = 0;
let eventTriggers = 0;

const eventBreakdown = Object.fromEntries(MACRO_EVENTS.map((e) => [e.id, 0]));
const outlookSamples = [];

const findEvent = (id) => MACRO_EVENTS.find((e) => e.id === id) || null;
const pickEvent = () => MACRO_EVENTS[Math.floor(rand() * MACRO_EVENTS.length)];

for (let i = 0; i < opts.switches; i += 1) {
  // 1) 利率变化按当前前瞻偏置发生（与游戏内市场切换一致）
  const actualUp = rand() < rateOutlookBiasUp;
  if (actualUp === outlookPredictedUp) outlookHit += 1;

  // 2) 事件持续衰减
  if (macroEventTimer > 0) {
    macroEventTimer = Math.max(0, macroEventTimer - 1);
    if (macroEventTimer === 0) {
      macroEventId = '';
    }
  }

  // 3) 事件触发
  if (macroEventTimer === 0 && rand() < opts.eventChance) {
    const ev = pickEvent();
    macroEventId = ev.id;
    macroEventTimer = ev.durationSwitches;
    eventTriggers += 1;
    eventBreakdown[ev.id] += 1;
  }

  // 4) 更新下一次前瞻方向
  const active = findEvent(macroEventId);
  rateOutlookBiasUp = active ? active.guidanceBiasUp : DEFAULT_GUIDANCE_BIAS;
  outlookPredictedUp = rateOutlookBiasUp >= 0.5;

  if (outlookSamples.length < 8) {
    outlookSamples.push({
      switchNo: i + 1,
      event: active ? active.id : 'none',
      predicted: outlookPredictedUp ? 'up' : 'down',
      biasUp: Number(rateOutlookBiasUp.toFixed(2)),
      actual: actualUp ? 'up' : 'down',
    });
  }
}

const result = {
  switches: opts.switches,
  seed: opts.seed,
  eventChance: opts.eventChance,
  totalEventTriggers: eventTriggers,
  eventBreakdown,
  outlookHitRate: Number((outlookHit / opts.switches).toFixed(4)),
  recommendation:
    eventTriggers < opts.switches * 0.15
      ? '事件偏少，建议提高 eventChance 或延长事件持续时间'
      : eventTriggers > opts.switches * 0.45
        ? '事件偏密，建议降低 eventChance 或缩短事件持续时间'
        : '事件频率处于可接受区间，建议保持当前参数',
  sample: outlookSamples,
};

if (opts.jsonOnly) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log('MACRO_EVENT_REPORT');
console.log(JSON.stringify(result, null, 2));
