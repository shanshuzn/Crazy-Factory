#!/usr/bin/env node

const TOTAL_SECONDS = Number(process.env.SECONDS || 600);
const DT = 0.1;
const MOMENTUM_CAP = Number(process.env.MOMENTUM_CAP || 12);
const MOMENTUM_DURATION = Number(process.env.MOMENTUM_DURATION || 5);
const MANUAL_PER_STACK = Number(process.env.MANUAL_PER_STACK || 0.06);
const GPS_PER_STACK = Number(process.env.GPS_PER_STACK || 0.02);

// 简化市场模型：30s 牛 / 30s 熊，牛市时每 1.2s 触发一次手动撮合。
const BULL_SEC = 30;
const BEAR_SEC = 30;
const CLICK_INTERVAL = 1.2;

let t = 0;
let momentum = 0;
let timer = 0;
let nextClickAt = 0;

let bullSamples = 0;
let sumStacksBull = 0;
let sumManualMultBull = 0;
let sumGpsMultBull = 0;

while (t < TOTAL_SECONDS) {
  const phase = t % (BULL_SEC + BEAR_SEC);
  const isBull = phase < BULL_SEC;

  if (isBull && t >= nextClickAt) {
    momentum = Math.min(MOMENTUM_CAP, momentum + 1);
    timer = MOMENTUM_DURATION;
    nextClickAt += CLICK_INTERVAL;
  }

  if (timer > 0) {
    timer = Math.max(0, timer - DT);
    if (timer <= 0) momentum = 0;
  }

  if (!isBull) {
    nextClickAt = t + Math.max(0.4, CLICK_INTERVAL * 0.6);
  }

  if (isBull) {
    bullSamples += 1;
    sumStacksBull += momentum;
    sumManualMultBull += 1 + momentum * MANUAL_PER_STACK;
    sumGpsMultBull += 1 + momentum * GPS_PER_STACK;
  }

  t += DT;
}

const avgStacksBull = sumStacksBull / Math.max(1, bullSamples);
const avgManualMultBull = sumManualMultBull / Math.max(1, bullSamples);
const avgGpsMultBull = sumGpsMultBull / Math.max(1, bullSamples);

const recommendation = avgStacksBull > MOMENTUM_CAP * 0.9
  ? '连击接近常驻满层，建议降低层数上限或缩短持续时间。'
  : avgStacksBull < MOMENTUM_CAP * 0.35
    ? '连击触发偏弱，建议延长持续时间或提高点击收益。'
    : '连击强度处于可控区间，可保持当前参数。';

console.log('MOMENTUM_BALANCE_REPORT');
console.log(JSON.stringify({
  sampleSec: TOTAL_SECONDS,
  params: {
    momentumCap: MOMENTUM_CAP,
    momentumDurationSec: MOMENTUM_DURATION,
    manualPerStack: MANUAL_PER_STACK,
    gpsPerStack: GPS_PER_STACK,
    clickIntervalSec: CLICK_INTERVAL,
    marketCycleSec: { bull: BULL_SEC, bear: BEAR_SEC },
  },
  metrics: {
    avgStacksBull: Number(avgStacksBull.toFixed(2)),
    avgManualMultBull: Number(avgManualMultBull.toFixed(3)),
    avgGpsMultBull: Number(avgGpsMultBull.toFixed(3)),
  },
  recommendation,
}, null, 2));
