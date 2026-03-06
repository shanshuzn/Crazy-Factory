#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

const DEFAULT_SWITCHES = 600;
const DEFAULT_SEED = 42;
const DEFAULT_BONUS_SET = '0.08,0.12,0.16';
const DEFAULT_COST_SET = '0.01,0.015,0.02';

const help = `用法:
  node scripts/run_macro_plan_sensitivity_scan.js [options]

选项:
  --switches <n>                每组参数模拟切换次数，默认 ${DEFAULT_SWITCHES}
  --seed <n>                    随机种子，默认 ${DEFAULT_SEED}
  --bonus-set <csv>             preferred-bonus 参数集合，默认 ${DEFAULT_BONUS_SET}
  --cost-set <csv>              plan-switch-cost 参数集合，默认 ${DEFAULT_COST_SET}
  --min-lift-per-switch <f>     传递给回归脚本的收益门槛（可选）
  --max-volatility-ratio <f>    传递给回归脚本的波动门槛（可选）
  --ci-summary                  CI 摘要模式：输出单行 JSON，并在存在失败组合时返回 2
  --json                        仅输出 JSON
  -h, --help                    显示帮助
`;

const args = process.argv.slice(2);
const opts = {
  switches: DEFAULT_SWITCHES,
  seed: DEFAULT_SEED,
  bonusSet: DEFAULT_BONUS_SET,
  costSet: DEFAULT_COST_SET,
  minLiftPerSwitch: null,
  maxVolatilityRatio: null,
  ciSummary: false,
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

const parseCsvFloats = (csv, name) => {
  const parts = String(csv).split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) {
    console.error(`${name} 不能为空`);
    process.exit(1);
  }
  return parts.map((p) => readFloat(p, name, 0, 1));
};

for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--switches') opts.switches = readInt(args[++i], '--switches', 1);
  else if (a === '--seed') opts.seed = readInt(args[++i], '--seed', 0);
  else if (a === '--bonus-set') opts.bonusSet = args[++i];
  else if (a === '--cost-set') opts.costSet = args[++i];
  else if (a === '--min-lift-per-switch') opts.minLiftPerSwitch = readFloat(args[++i], '--min-lift-per-switch', -9999, 9999);
  else if (a === '--max-volatility-ratio') opts.maxVolatilityRatio = readFloat(args[++i], '--max-volatility-ratio', 0, 9999);
  else if (a === '--ci-summary') opts.ciSummary = true;
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

const bonusValues = parseCsvFloats(opts.bonusSet, '--bonus-set');
const costValues = parseCsvFloats(opts.costSet, '--cost-set');

const records = [];
for (const preferredBonus of bonusValues) {
  for (const planSwitchCost of costValues) {
    const cmd = [
      'scripts/run_macro_plan_regression_check.js',
      '--switches', String(opts.switches),
      '--seed', String(opts.seed),
      '--preferred-bonus', String(preferredBonus),
      '--plan-switch-cost', String(planSwitchCost),
      '--json',
    ];
    if (opts.minLiftPerSwitch !== null) cmd.push('--min-lift-per-switch', String(opts.minLiftPerSwitch));
    if (opts.maxVolatilityRatio !== null) cmd.push('--max-volatility-ratio', String(opts.maxVolatilityRatio));

    const run = spawnSync('node', cmd, { encoding: 'utf8' });
    if (!run.stdout) {
      console.error('子任务无输出，请检查回归脚本执行环境');
      process.exit(1);
    }

    let parsed;
    try {
      parsed = JSON.parse(run.stdout);
    } catch (err) {
      console.error('无法解析回归脚本输出为 JSON');
      console.error(run.stdout);
      process.exit(1);
    }

    records.push({
      preferredBonus,
      planSwitchCost,
      exitCode: run.status,
      passed: Boolean(parsed.thresholdGate?.passed),
      liftPerSwitch: parsed.comparison?.liftPerSwitch,
      volatilityRatio: parsed.comparison?.volatilityRatio,
      recommendation: parsed.recommendation,
    });
  }
}

const passing = records.filter((r) => r.passed);
const firstFailingCombo = records.find((r) => !r.passed) || null;
const safeZone = {
  preferredBonus: [...new Set(passing.map((r) => r.preferredBonus))].sort((a, b) => a - b),
  planSwitchCost: [...new Set(passing.map((r) => r.planSwitchCost))].sort((a, b) => a - b),
};

const best = [...passing].sort((a, b) => (b.liftPerSwitch - a.liftPerSwitch) || (a.volatilityRatio - b.volatilityRatio))[0] || null;

const result = {
  switches: opts.switches,
  seed: opts.seed,
  totalCombos: records.length,
  passCount: passing.length,
  failCount: records.length - passing.length,
  firstFailingCombo,
  records,
  safeZone,
  bestCandidate: best,
  recommendation: best
    ? `推荐优先参数：preferred-bonus=${best.preferredBonus}, plan-switch-cost=${best.planSwitchCost}`
    : '本轮参数集中未找到通过门禁组合，建议提高 bonus 或放宽波动阈值后重跑。',
};

if (opts.ciSummary) {
  console.log(JSON.stringify({
    totalCombos: result.totalCombos,
    passCount: result.passCount,
    failCount: result.failCount,
    bestCandidate: result.bestCandidate,
    firstFailingCombo: result.firstFailingCombo,
  }));
  process.exit(result.failCount > 0 ? 2 : 0);
}

if (opts.jsonOnly) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('MACRO_PLAN_SENSITIVITY_REPORT');
  console.log(JSON.stringify(result, null, 2));
}

process.exit(passing.length > 0 ? 0 : 2);
