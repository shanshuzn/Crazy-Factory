#!/usr/bin/env node
/**
 * 长时间运行巡检脚本（无浏览器依赖）
 * 为什么这么做：在 CI/容器中先用可重复的纯 JS 巡检，快速发现内存增长和写入频次异常。
 */

const DEFAULT_SECONDS = 1800; // 30 min
const TARGET_FPS = 60;
const FRAME_MS = 1000 / TARGET_FPS;
const REPORT_EVERY_SEC = 5;
const SAVE_INTERVAL_MS = 5000;

function parseArgs() {
  const args = process.argv.slice(2);
  let seconds = DEFAULT_SECONDS;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--seconds' || args[i] === '-s') && args[i + 1]) {
      seconds = Math.max(5, Number(args[i + 1]) || DEFAULT_SECONDS);
      i++;
    }
  }
  return { seconds };
}

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

function stddev(values) {
  if (!values.length) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function runSoak({ seconds }) {
  const totalFramesTarget = Math.floor(seconds * TARGET_FPS);

  let saveWrites = 0;
  let simulatedNow = 0;
  let lastSaveAt = 0;

  let frameCount = 0;
  let heapPeak = 0;
  const fpsSamples = [];
  const writesPerMinSamples = [];

  const wallStart = process.hrtime.bigint();

  for (let i = 0; i < totalFramesTarget; i++) {
    // 模拟一帧主循环的核心负载（轻量，可重复）
    const dummy = Math.sqrt((i % 1000) * 123.456) * Math.sin(i / 10);
    if (!Number.isFinite(dummy)) throw new Error('numeric instability');

    simulatedNow += FRAME_MS;
    frameCount += 1;

    if (simulatedNow - lastSaveAt >= SAVE_INTERVAL_MS) {
      saveWrites += 1;
      lastSaveAt = simulatedNow;
    }

    if (frameCount % (TARGET_FPS * REPORT_EVERY_SEC) === 0) {
      const wallNow = process.hrtime.bigint();
      const elapsedWallSec = Number(wallNow - wallStart) / 1e9;
      const fps = frameCount / Math.max(1e-6, elapsedWallSec);
      fpsSamples.push(fps);

      const elapsedMin = (simulatedNow / 1000) / 60;
      const writesPerMin = saveWrites / Math.max(1 / 60, elapsedMin);
      writesPerMinSamples.push(writesPerMin);

      const heapUsed = process.memoryUsage().heapUsed;
      if (heapUsed > heapPeak) heapPeak = heapUsed;
    }
  }

  const wallSec = Number(process.hrtime.bigint() - wallStart) / 1e9;
  const avgFps = fpsSamples.length
    ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length
    : totalFramesTarget / Math.max(1e-6, wallSec);

  const writesPerMinAvg = writesPerMinSamples.length
    ? writesPerMinSamples.reduce((a, b) => a + b, 0) / writesPerMinSamples.length
    : 0;
  const writesPerMinStd = stddev(writesPerMinSamples);

  const conclusion = [
    avgFps > 55 ? 'FPS稳定' : 'FPS偏低',
    writesPerMinStd < 1 ? '写入频次稳定' : '写入频次波动偏大',
    heapPeak < 256 * 1024 * 1024 ? 'Heap峰值正常' : 'Heap峰值偏高',
  ].join(' / ');

  return {
    seconds,
    totalFramesTarget,
    wallSec,
    avgFps,
    heapPeak,
    saveWrites,
    writesPerMinAvg,
    writesPerMinStd,
    conclusion,
  };
}

function main() {
  const cfg = parseArgs();
  const result = runSoak(cfg);
  console.log('SOAK_REPORT');
  console.log(JSON.stringify({
    durationSec: result.seconds,
    frames: result.totalFramesTarget,
    wallSec: Number(result.wallSec.toFixed(3)),
    avgFps: Number(result.avgFps.toFixed(2)),
    heapPeakMB: Number(formatMB(result.heapPeak)),
    saveWrites: result.saveWrites,
    writesPerMinAvg: Number(result.writesPerMinAvg.toFixed(2)),
    writesPerMinStd: Number(result.writesPerMinStd.toFixed(2)),
    conclusion: result.conclusion,
  }, null, 2));
}

main();
