from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple, Any
import math
import random


@dataclass
class SimConfig:
    # simulation horizon
    horizon_hours: float = 24.0
    dt_seconds: int = 5  # step seconds

    # gameplay knobs (not tuned directly, internal)
    base_income_per_sec: float = 1.0
    upgrade_count: int = 40

    # "meaningful upgrade" threshold
    meaningful_gain_ratio: float = 0.08  # +8% production is meaningful

    # stall detection
    stall_window_minutes: int = 30


def _clamp(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x


def _safe_log(x: float) -> float:
    return math.log(max(1e-12, x))


def generate_upgrade_table(params: Dict[str, Any], cfg: SimConfig) -> List[Dict[str, float]]:
    """
    Generate synthetic upgrades table:
    - cost grows with (price_scale, price_exp, softcap...)
    - reward grows with (reward_scale, reward_exp, softcap...)
    Returns list of upgrades: [{"cost":..., "mult":...}, ...] where mult multiplies production.
    """
    price_scale = float(params["price_scale"])
    price_exp = float(params["price_exp"])
    reward_scale = float(params["reward_scale"])
    reward_exp = float(params["reward_exp"])
    softcap_start = float(params["softcap_start"])
    softcap_strength = float(params["softcap_strength"])

    upgrades: List[Dict[str, float]] = []
    for i in range(cfg.upgrade_count):
        t = i / max(1, cfg.upgrade_count - 1)  # 0..1
        # cost curve with softcap: later upgrades more expensive
        softcap = 1.0 + softcap_strength * max(0.0, t - softcap_start) / max(1e-9, (1.0 - softcap_start))
        cost = price_scale * (10.0 ** (price_exp * (t * 2.0))) * (1.0 + 4.0 * t) * softcap

        # reward: multiplicative boost to production
        raw = reward_scale * (1.0 + t) ** (reward_exp * 3.0)
        # keep per-upgrade multiplier within sane range
        mult = _clamp(1.0 + raw * 0.25, 1.01, 3.0)

        upgrades.append({"cost": float(cost), "mult": float(mult)})
    # Ensure monotonically increasing costs
    for i in range(1, len(upgrades)):
        upgrades[i]["cost"] = max(upgrades[i]["cost"], upgrades[i - 1]["cost"] * 1.03)
    return upgrades


def simulate_one(params: Dict[str, Any], seed: int, cfg: SimConfig) -> Dict[str, Any]:
    """
    Simulate an idle run with:
    - active play: purchases upgrades if affordable, otherwise waits
    - intermittent "offline" breaks and claim
    - optional prestige if enabled & beneficial
    Produces telemetry-like outputs for scoring.
    """
    rng = random.Random(seed)

    # Extract tuned params
    offline_rate = float(params["offline_rate"])
    offline_cap_hours = float(params["offline_cap_hours"])
    prestige_enabled = bool(params["prestige_enabled"])
    prestige_unlock_hours = float(params["prestige_unlock_hours"])
    prestige_gain_scale = float(params["prestige_gain_scale"])

    upgrades = generate_upgrade_table(params, cfg)

    # player state
    t = 0.0  # seconds
    cash = 0.0
    prod = cfg.base_income_per_sec
    prestige_mult = 1.0
    purchased = 0

    # telemetry
    times: List[float] = []
    prods: List[float] = []
    cashes: List[float] = []
    meaningful_upgrades: int = 0
    total_upgrades: int = 0
    stall_seconds: int = 0
    longest_stall_seconds: int = 0

    offline_claims: int = 0
    offline_total_seconds: int = 0
    claim_then_actions: int = 0
    claim_then_stops: int = 0

    # Simple "session" model: every ~3-8 minutes decide if go offline for 5-60 minutes
    next_break_at = rng.uniform(180, 480)

    def record():
        times.append(t)
        prods.append(prod * prestige_mult)
        cashes.append(cash)

    record()

    dt = cfg.dt_seconds
    horizon_seconds = cfg.horizon_hours * 3600.0

    # For stall detection: track last time we purchased
    last_purchase_t = 0.0

    # For "claim then play" proxy: after claim, we simulate a few decisions
    after_claim_action_budget = 0

    while t < horizon_seconds:
        # earn
        cash += prod * prestige_mult * dt

        # buy as many upgrades as possible (greedy)
        bought = False
        while purchased < len(upgrades) and cash >= upgrades[purchased]["cost"]:
            cost = upgrades[purchased]["cost"]
            mult = upgrades[purchased]["mult"]
            cash -= cost
            oldp = prod
            prod *= mult
            total_upgrades += 1
            if (prod - oldp) / max(1e-9, oldp) >= cfg.meaningful_gain_ratio:
                meaningful_upgrades += 1
            purchased += 1
            bought = True
            last_purchase_t = t

            # after claim: count "actions"
            if after_claim_action_budget > 0:
                claim_then_actions += 1
                after_claim_action_budget -= 1

            # prevent infinite loop due to weird params
            if total_upgrades > cfg.upgrade_count + 10:
                break

        # stall tracking
        if not bought:
            stall_seconds = int(t - last_purchase_t)
            longest_stall_seconds = max(longest_stall_seconds, stall_seconds)

        # prestige decision (very simplified):
        # If enabled and past unlock time, and current next upgrade time too long, prestige.
        if prestige_enabled and (t / 3600.0) >= prestige_unlock_hours and purchased > 8:
            # estimate time to next upgrade
            if purchased < len(upgrades):
                need = max(0.0, upgrades[purchased]["cost"] - cash)
                rate = max(1e-9, prod * prestige_mult)
                ttnu = need / rate
            else:
                ttnu = 999999.0
            # if next upgrade looks too far, do prestige
            if ttnu > 900.0:  # >15min
                # prestige resets cash, upgrades; increases prestige_mult modestly
                gain = 1.0 + prestige_gain_scale * math.sqrt(max(0.0, purchased))
                prestige_mult *= gain
                cash = 0.0
                prod = cfg.base_income_per_sec
                purchased = 0
                last_purchase_t = t
                # small "cooldown" to avoid immediate prestige loops
                next_break_at = t + rng.uniform(240, 600)

        # offline break
        if t >= next_break_at:
            offline_hours = rng.uniform(0.1, 1.0)  # 6-60 min
            offline_seconds = int(min(offline_hours, offline_cap_hours) * 3600.0)
            offline_total_seconds += offline_seconds
            # simulate offline accumulation: offline_rate * online production
            reward = prod * prestige_mult * offline_rate * offline_seconds
            cash += reward
            offline_claims += 1

            # After claim, simulate whether player keeps playing:
            # We'll give them a small action budget (attempt to buy upgrades).
            after_claim_action_budget = rng.randint(1, 6)
            # If no action happens before action budget expires (i.e., can't afford anything),
            # count as "claim then stop".
            pre_actions = claim_then_actions

            # advance time by offline period (no stepping)
            t += offline_seconds
            record()

            # If they didn't manage to do any purchase actions soon, mark stop.
            # We'll check later: if after_claim_action_budget runs out without incrementing actions.
            if claim_then_actions == pre_actions:
                # proxy: assume "stop" if right after claim still can't do anything meaningful
                claim_then_stops += 1

            # schedule next break
            next_break_at = t + rng.uniform(180, 480)
            continue

        # time step forward
        t += dt

        # periodic record every 1 minute
        if int(t) % 60 == 0:
            record()

        # numeric safety
        if cash > 1e300 or prod * prestige_mult > 1e300 or math.isnan(cash) or math.isnan(prod) or math.isinf(cash):
            return {
                "ok": False,
                "reason": "overflow_or_nan",
                "times": times,
                "prods": prods,
                "cashes": cashes,
            }

    # final "session depth": active time excludes offline
    active_seconds = max(0, int(horizon_seconds) - offline_total_seconds)

    return {
        "ok": True,
        "seed": seed,
        "active_seconds": active_seconds,
        "offline_seconds": offline_total_seconds,
        "offline_claims": offline_claims,
        "claim_then_actions": claim_then_actions,
        "claim_then_stops": claim_then_stops,
        "total_upgrades": total_upgrades,
        "meaningful_upgrades": meaningful_upgrades,
        "longest_stall_seconds": longest_stall_seconds,
        "times": times,
        "prods": prods,
        "cashes": cashes,
    }


def simulate_batch(params: Dict[str, Any], runs: int, seed0: int = 1234, cfg: SimConfig | None = None) -> List[Dict[str, Any]]:
    cfg = cfg or SimConfig()
    out: List[Dict[str, Any]] = []
    for i in range(runs):
        out.append(simulate_one(params, seed=seed0 + i, cfg=cfg))
    return out