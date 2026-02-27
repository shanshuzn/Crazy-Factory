from __future__ import annotations

from typing import Dict, Any, List, Tuple
import math
import statistics


def _clamp(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x


def _safe_log(x: float) -> float:
    return math.log(max(1e-12, x))


def _slope_log_growth(times: List[float], values: List[float]) -> float:
    """
    Compute approximate slope of log(values) over time (seconds) using simple linear regression.
    Returns slope per second.
    """
    if len(times) < 3:
        return 0.0
    xs = times
    ys = [_safe_log(v) for v in values]
    mx = statistics.mean(xs)
    my = statistics.mean(ys)
    denom = sum((x - mx) ** 2 for x in xs)
    if denom <= 1e-12:
        return 0.0
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return num / denom


def _moving_average(xs: List[float], window: int) -> List[float]:
    if window <= 1:
        return xs[:]
    out = []
    s = 0.0
    q = []
    for x in xs:
        q.append(x)
        s += x
        if len(q) > window:
            s -= q.pop(0)
        out.append(s / len(q))
    return out


def score_runs(runs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Score a batch of simulation runs.
    Output includes:
      - V_idle components
      - Curve health / stability
      - constraints flags
      - shadow metrics
      - V_total (time-discounted)
    """
    ok_runs = [r for r in runs if r.get("ok")]
    fail_runs = [r for r in runs if not r.get("ok")]

    # Hard constraints: if too many failures, reject
    fail_rate = len(fail_runs) / max(1, len(runs))
    if fail_rate > 0.02:
        return {
            "accepted": False,
            "constraint_failed": "sim_fail_rate",
            "fail_rate": fail_rate,
            "V_total": 0.0,
        }

    # Aggregate signals
    growth_slopes = []
    longest_stalls = []
    active_secs = []
    offline_secs = []
    claim_stops = []
    claim_actions = []
    total_upgrades = []
    meaningful_upgrades = []

    # Per-run curve health: penalize huge volatility / early plateau
    curve_healths = []

    for r in ok_runs:
        times = r["times"]
        prods = r["prods"]

        slope = _slope_log_growth(times, prods)
        growth_slopes.append(slope)

        longest_stalls.append(float(r.get("longest_stall_seconds", 0)))
        active_secs.append(float(r.get("active_seconds", 0)))
        offline_secs.append(float(r.get("offline_seconds", 0)))
        claim_stops.append(float(r.get("claim_then_stops", 0)))
        claim_actions.append(float(r.get("claim_then_actions", 0)))
        total_upgrades.append(float(r.get("total_upgrades", 0)))
        meaningful_upgrades.append(float(r.get("meaningful_upgrades", 0)))

        # curve health: use moving average of log prod; penalize sharp drops (shouldn't happen) and huge spikes
        logs = [_safe_log(p) for p in prods]
        ma = _moving_average(logs, window=max(3, len(logs) // 20))
        diffs = [ma[i + 1] - ma[i] for i in range(len(ma) - 1)]
        if diffs:
            vol = statistics.pstdev(diffs)
            neg = sum(1 for d in diffs if d < -1e-6) / len(diffs)
        else:
            vol, neg = 0.0, 0.0

        # health: low volatility good, negative diffs bad
        h = 1.0
        h *= _clamp(1.0 - vol * 5.0, 0.0, 1.0)
        h *= _clamp(1.0 - neg * 5.0, 0.0, 1.0)
        curve_healths.append(h)

    # Constraints: "long stall" too frequent / too long
    longest_stall_med = statistics.median(longest_stalls) if longest_stalls else 0.0
    if longest_stall_med > 30 * 60:  # >30 minutes
        return {
            "accepted": False,
            "constraint_failed": "long_bottleneck",
            "longest_stall_median_seconds": longest_stall_med,
            "V_total": 0.0,
        }

    # Compute V_idle components normalized to 0..1
    # Growth Momentum: slope of log(prod) per hour -> map to 0..1
    slope_med = statistics.median(growth_slopes) if growth_slopes else 0.0
    slope_per_hour = slope_med * 3600.0
    # typical good range for idle: 0.02..0.12 log-units/hour
    growth_momentum = _clamp((slope_per_hour - 0.02) / (0.12 - 0.02), 0.0, 1.0)

    # Return Quality: after offline claim, do they take actions vs stop?
    stops = sum(claim_stops)
    actions = sum(claim_actions)
    # proxy: good if actions dominate stops
    return_quality = 0.0
    if (stops + actions) > 0:
        return_quality = _clamp(actions / (actions + stops), 0.0, 1.0)
    else:
        return_quality = 0.5  # if no offline, neutral

    # Upgrade Satisfaction: meaningful upgrades ratio
    mu = statistics.mean(meaningful_upgrades) if meaningful_upgrades else 0.0
    tu = statistics.mean(total_upgrades) if total_upgrades else 0.0
    ratio = mu / max(1e-9, tu)
    # good if 30%-80% upgrades feel meaningful
    upgrade_satisfaction = _clamp(1.0 - abs(ratio - 0.55) / 0.55, 0.0, 1.0)

    # Progress Clarity: shorter typical bottleneck is better (but not zero)
    # map median longest stall 0..1800 seconds to 1..0
    progress_clarity = _clamp(1.0 - (longest_stall_med / (30 * 60)), 0.0, 1.0)

    V_idle = (
        0.35 * growth_momentum
        + 0.25 * return_quality
        + 0.20 * upgrade_satisfaction
        + 0.20 * progress_clarity
    )

    # Temporal/stability scores
    curve_health = statistics.mean(curve_healths) if curve_healths else 0.5
    stability_score = curve_health  # already 0..1

    # In this purely simulated setting, MA5 ~ current (no multi-version history), so approximate:
    MA5 = V_idle
    V_total = 0.5 * V_idle + 0.3 * MA5 + 0.2 * stability_score

    # Shadow metrics
    claim_then_stop_rate = 0.0
    if (stops + actions) > 0:
        claim_then_stop_rate = _clamp(stops / (stops + actions), 0.0, 1.0)

    # "upgrade then stall": proxy by longest stall normalized
    upgrade_then_stall_rate = _clamp(longest_stall_med / (30 * 60), 0.0, 1.0)

    return {
        "accepted": True,
        "fail_rate": fail_rate,
        "components": {
            "growth_momentum": growth_momentum,
            "return_quality": return_quality,
            "upgrade_satisfaction": upgrade_satisfaction,
            "progress_clarity": progress_clarity,
            "stability_score": stability_score,
            "curve_health": curve_health,
        },
        "V_idle": V_idle,
        "V_total": V_total,
        "bottleneck": {
            "longest_stall_median_seconds": longest_stall_med,
        },
        "shadow": {
            "claim_then_stop_rate": claim_then_stop_rate,
            "upgrade_then_stall_rate": upgrade_then_stall_rate,
        },
    }