from __future__ import annotations

import argparse
import json
import os
import random
from typing import Dict, Any, List, Tuple

from simulate import simulate_batch
from score import score_runs


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(path: str, data: Any) -> None:
    _ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _sample_param(space: Dict[str, Any], rng: random.Random) -> Any:
    if "choices" in space:
        return rng.choice(space["choices"])
    lo = space.get("min")
    hi = space.get("max")
    if lo is None or hi is None:
        raise ValueError(f"Invalid space spec: {space}")
    # if integer-ish (like hours cap), keep int
    if isinstance(lo, int) and isinstance(hi, int):
        return int(rng.randint(lo, hi))
    # float
    return float(lo + (hi - lo) * rng.random())


def sample_candidate(space: Dict[str, Any], rng: random.Random) -> Dict[str, Any]:
    cand: Dict[str, Any] = {}
    for k, spec in space.items():
        cand[k] = _sample_param(spec, rng)
    # make prestige fields consistent
    if not cand.get("prestige_enabled", False):
        # keep but irrelevant; still set sensible
        cand["prestige_unlock_hours"] = float(cand.get("prestige_unlock_hours", 24))
        cand["prestige_gain_scale"] = float(cand.get("prestige_gain_scale", 0.15))
    return cand


def mutate(candidate: Dict[str, Any], space: Dict[str, Any], rng: random.Random, strength: float = 0.15) -> Dict[str, Any]:
    """
    Mutate a candidate in-place: tweak a few numeric params by small random factor, flip boolean occasionally.
    """
    out = dict(candidate)
    keys = list(space.keys())
    rng.shuffle(keys)
    n_mut = max(1, int(len(keys) * 0.25))
    for k in keys[:n_mut]:
        spec = space[k]
        if "choices" in spec:
            if rng.random() < 0.25:
                out[k] = rng.choice(spec["choices"])
            continue
        lo = float(spec["min"])
        hi = float(spec["max"])
        v = float(out[k])
        # multiplicative jitter around current
        jitter = 1.0 + rng.uniform(-strength, strength)
        nv = v * jitter
        # sometimes additive in range
        if rng.random() < 0.3:
            nv = v + rng.uniform(-(hi - lo) * strength, (hi - lo) * strength)
        # clamp
        nv = max(lo, min(hi, nv))
        # if integer range, cast
        if isinstance(spec["min"], int) and isinstance(spec["max"], int):
            out[k] = int(round(nv))
        else:
            out[k] = float(nv)

    # keep consistency
    if not out.get("prestige_enabled", False):
        out["prestige_gain_scale"] = float(out.get("prestige_gain_scale", 0.15))
    return out


def evaluate_candidate(candidate: Dict[str, Any], runs: int, seed0: int) -> Dict[str, Any]:
    sims = simulate_batch(candidate, runs=runs, seed0=seed0)
    scored = score_runs(sims)
    return scored


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", default="balance/baseline.json")
    ap.add_argument("--space", default="balance/search_space.json")
    ap.add_argument("--runs", type=int, default=1000)
    ap.add_argument("--generations", type=int, default=10)
    ap.add_argument("--population", type=int, default=30)
    ap.add_argument("--topk", type=int, default=5)
    ap.add_argument("--seed", type=int, default=20260227)
    ap.add_argument("--out_report", default="output/tuning_report.json")
    ap.add_argument("--out_top", default="output/top_params.json")
    args = ap.parse_args()

    rng = random.Random(args.seed)

    baseline = _load_json(args.baseline) if os.path.exists(args.baseline) else None
    space = _load_json(args.space)

    # Determine per-candidate runs
    # Total runs budget split across population for speed.
    # Example: runs=1000, population=30 -> ~33 runs per candidate per generation.
    runs_per = max(10, args.runs // max(1, args.population))

    # Initial population includes baseline (if any) plus random candidates
    population: List[Dict[str, Any]] = []
    if baseline is not None:
        population.append(dict(baseline))
    while len(population) < args.population:
        population.append(sample_candidate(space, rng))

    history: List[Dict[str, Any]] = []
    seed_cursor = args.seed * 1000 + 7

    for gen in range(args.generations):
        scored_pop: List[Tuple[float, Dict[str, Any], Dict[str, Any]]] = []
        for idx, cand in enumerate(population):
            seed0 = seed_cursor + gen * 100000 + idx * 1000
            scored = evaluate_candidate(cand, runs=runs_per, seed0=seed0)
            v = float(scored.get("V_total", 0.0)) if scored.get("accepted") else 0.0
            scored_pop.append((v, cand, scored))

        scored_pop.sort(key=lambda x: x[0], reverse=True)
        top = scored_pop[: args.topk]

        # record generation summary
        gen_summary = {
            "generation": gen,
            "runs_per_candidate": runs_per,
            "top": [
                {
                    "rank": i + 1,
                    "V_total": v,
                    "accepted": sc.get("accepted", False),
                    "constraint_failed": sc.get("constraint_failed"),
                    "params": cand,
                    "score": sc,
                }
                for i, (v, cand, sc) in enumerate(top)
            ],
        }
        history.append(gen_summary)

        # Next generation: keep topk + mutated offsprings to refill population
        new_pop: List[Dict[str, Any]] = [dict(cand) for _, cand, _ in top]
        while len(new_pop) < args.population:
            parent = rng.choice(new_pop[: max(1, min(len(new_pop), args.topk))])
            child = mutate(parent, space, rng, strength=0.12)
            new_pop.append(child)
        population = new_pop

    # Final evaluate full-budget on top candidates (more runs) for stable ranking
    final_candidates: List[Dict[str, Any]] = []
    last_top = history[-1]["top"]
    for item in last_top:
        final_candidates.append(item["params"])

    final_scored: List[Dict[str, Any]] = []
    for i, cand in enumerate(final_candidates):
        scored = evaluate_candidate(cand, runs=max(args.runs, 500), seed0=args.seed * 9999 + i * 1234)
        final_scored.append({"params": cand, "score": scored})

    final_scored.sort(key=lambda x: float(x["score"].get("V_total", 0.0)) if x["score"].get("accepted") else 0.0, reverse=True)

    top1 = final_scored[0] if final_scored else {"params": baseline or {}, "score": {"accepted": False, "V_total": 0.0}}

    report = {
        "meta": {
            "runs_budget": args.runs,
            "generations": args.generations,
            "population": args.population,
            "topk": args.topk,
            "seed": args.seed,
            "runs_per_candidate": runs_per,
        },
        "evolution": history,
        "final_ranking": [
            {
                "rank": i + 1,
                "V_total": float(item["score"].get("V_total", 0.0)) if item["score"].get("accepted") else 0.0,
                "accepted": bool(item["score"].get("accepted", False)),
                "constraint_failed": item["score"].get("constraint_failed"),
                "params": item["params"],
                "score": item["score"],
            }
            for i, item in enumerate(final_scored[:10])
        ],
        "top1": {
            "params": top1["params"],
            "score": top1["score"],
        },
    }

    _save_json(args.out_report, report)
    _save_json(args.out_top, top1["params"])

    print(f"[OK] Wrote report: {args.out_report}")
    print(f"[OK] Wrote top params: {args.out_top}")
    if top1["score"].get("accepted"):
        print(f"Top1 V_total={top1['score'].get('V_total'):.4f}")
    else:
        print("Top1 not accepted (constraint failed). Consider widening search or adjusting constraints.")


if __name__ == "__main__":
    main()