// Score simulation runs for autotuning

function clamp(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
}

function safeLog(x) {
    return Math.log(Math.max(1e-12, x));
}

function mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function slopeLogGrowth(times, values) {
    if (times.length < 3) return 0;
    const xs = times;
    const ys = values.map(safeLog);
    const mx = mean(xs);
    const my = mean(ys);
    let denom = 0;
    for (const x of xs) {
        denom += (x - mx) ** 2;
    }
    if (denom <= 1e-12) return 0;
    let num = 0;
    for (let i = 0; i < xs.length; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
    }
    return num / denom;
}

function movingAverage(xs, window) {
    if (window <= 1) return xs.slice();
    const out = [];
    let s = 0;
    const q = [];
    for (const x of xs) {
        q.push(x);
        s += x;
        if (q.length > window) {
            s -= q.shift();
        }
        out.push(s / q.length);
    }
    return out;
}

function scoreRuns(runs) {
    const okRuns = runs.filter(r => r.ok);
    const failRuns = runs.filter(r => !r.ok);

    const failRate = failRuns.length / Math.max(1, runs.length);
    if (failRate > 0.02) {
        return {
            accepted: false,
            constraint_failed: "sim_fail_rate",
            fail_rate: failRate,
            V_total: 0,
        };
    }

    const growthSlopes = [];
    const longestStalls = [];
    const activeSecs = [];
    const offlineSecs = [];
    const claimStops = [];
    const claimActions = [];
    const totalUpgrades = [];
    const meaningfulUpgrades = [];
    const curveHealths = [];

    for (const r of okRuns) {
        const times = r.times;
        const prods = r.prods;

        const slope = slopeLogGrowth(times, prods);
        growthSlopes.push(slope);

        longestStalls.push(r.longest_stall_seconds || 0);
        activeSecs.push(r.active_seconds || 0);
        offlineSecs.push(r.offline_seconds || 0);
        claimStops.push(r.claim_then_stops || 0);
        claimActions.push(r.claim_then_actions || 0);
        totalUpgrades.push(r.total_upgrades || 0);
        meaningfulUpgrades.push(r.meaningful_upgrades || 0);

        // curve health: use moving average of log prod
        const logProds = prods.map(safeLog);
        const smoothed = movingAverage(logProds, 5);
        let bad = 0;
        for (let i = 1; i < smoothed.length; i++) {
            if (smoothed[i] < smoothed[i - 1] * 0.99) bad++;
        }
        const health = clamp(1.0 - bad / Math.max(1, smoothed.length), 0, 1);
        curveHealths.push(health);
    }

    const medianStall = longestStalls.sort((a, b) => a - b)[Math.floor(longestStalls.length / 2)] || 0;

    // Constraints
    const constraintFailed = null;

    // V_idle components
    // Use final/initial production ratio for growth momentum (handles prestige resets)
    const finalProds = runs.filter(r => r.ok).map(r => r.prods[r.prods.length - 1] || 1);
    const initialProd = runs.filter(r => r.ok)[0]?.prods[0] || 1;
    const meanFinalProd = mean(finalProds);
    const growthRatio = Math.log10(Math.max(1, meanFinalProd)) / Math.log10(Math.max(1, initialProd * 1000));
    const growthMomentum = clamp(growthRatio, 0, 1);

    const meanClaimActions = mean(claimActions);
    const returnQuality = clamp(meanClaimActions * 0.15, 0, 1);

    const meanMu = mean(meaningfulUpgrades);
    const upgradeSatisfaction = clamp(meanMu / 15, 0, 1);

    const meanCurveHealth = mean(curveHealths);
    const progressClarity = clamp(meanCurveHealth, 0, 1);

    const meanActive = mean(activeSecs);
    const meanOffline = mean(offlineSecs);
    const activityRatio = meanActive / Math.max(1, meanActive + meanOffline);
    const stabilityScore = clamp(activityRatio * meanCurveHealth, 0, 1);

    // Time-discounted V_total (simplified)
    const decay = 0.98;
    const V_total = (growthMomentum * 0.35 + returnQuality * 0.25 + upgradeSatisfaction * 0.2 + progressClarity * 0.1 + stabilityScore * 0.1) * decay;

    return {
        accepted: true,
        constraint_failed: constraintFailed,
        fail_rate: failRate,
        V_total: V_total,
        components: {
            growth_momentum: growthMomentum,
            return_quality: returnQuality,
            upgrade_satisfaction: upgradeSatisfaction,
            progress_clarity: progressClarity,
            stability_score: stabilityScore,
        },
        bottleneck: {
            longest_stall_median_seconds: medianStall,
        },
    };
}

module.exports = { scoreRuns };
