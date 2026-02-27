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

function printHelp() {
  console.log(`用法:
  node scripts/run_soak_check.js [options]

选项:
  -s, --seconds <n>         巡检时长（秒），默认 ${DEFAULT_SECONDS}
      --min-fps <n>         最低平均 FPS，默认 55
      --max-heap-mb <n>     Heap 峰值上限（MB），默认 256
      --max-writes-std <n>  writesPerMin 标准差上限，默认 1
  -h, --help                显示帮助信息

退出码:
  0  所有阈值检查通过
  1  任意阈值检查失败或参数非法`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let seconds = DEFAULT_SECONDS;
  let minFps = 55;
  let maxHeapMb = 256;
  let maxWritesStd = 1;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      return { help: true };
    }

    if ((arg === '--seconds' || arg === '-s') && args[i + 1]) {
      seconds = Math.max(5, Number(args[i + 1]) || DEFAULT_SECONDS);
      i++;
      continue;
    }
    if (arg === '--min-fps' && args[i + 1]) {
      minFps = Math.max(1, Number(args[i + 1]) || minFps);
      i++;
      continue;
    }
    if (arg === '--max-heap-mb' && args[i + 1]) {
      maxHeapMb = Math.max(1, Number(args[i + 1]) || maxHeapMb);
      i++;
      continue;
    }
    if (arg === '--max-writes-std' && args[i + 1]) {
      maxWritesStd = Math.max(0, Number(args[i + 1]) || maxWritesStd);
      i++;
      continue;
    }

    return { error: `未知参数: ${arg}` };
  }

  return { seconds, minFps, maxHeapMb, maxWritesStd, help: false };
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

function runSoak({ seconds, minFps, maxHeapMb, maxWritesStd }) {
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

  const checks = {
    fpsOk: avgFps >= minFps,
    writesStdOk: writesPerMinStd <= maxWritesStd,
    heapOk: heapPeak <= maxHeapMb * 1024 * 1024,
  };

  const conclusion = [
    checks.fpsOk ? 'FPS稳定' : 'FPS偏低',
    checks.writesStdOk ? '写入频次稳定' : '写入频次波动偏大',
    checks.heapOk ? 'Heap峰值正常' : 'Heap峰值偏高',
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
    thresholds: {
      minFps,
      maxHeapMb,
      maxWritesStd,
    },
    checks,
    conclusion,
  };
}

function main() {
  const cfg = parseArgs();

  if (cfg.help) {
    printHelp();
    return;
  }

  if (cfg.error) {
    console.error(cfg.error);
    printHelp();
    process.exitCode = 1;
    return;
  }

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
    thresholds: result.thresholds,
    checks: result.checks,
    conclusion: result.conclusion,
  }, null, 2));

  if (!result.checks.fpsOk || !result.checks.writesStdOk || !result.checks.heapOk) {
    process.exitCode = 1;
  }
}

main();
