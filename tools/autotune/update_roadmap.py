# tools/update_roadmap.py
from __future__ import annotations

import argparse
import difflib
import json
import os
from typing import Any, Dict

AUTO_START = "<!-- AUTO:METRICS-START -->"
AUTO_END = "<!-- AUTO:METRICS-END -->"

def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def save_text(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)

def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x

def pick_mode(north_star_pct: float, risk_level: str, accepted: bool, trend: str) -> str:
    # Recovery 优先级最高：不可运行或明显下降
    if (not accepted) or trend == "down":
        return "🚑 Recovery Mode（恢复模式）"
    if risk_level == "高" or north_star_pct >= 85.0:
        return "🛡 Hardening Mode（强化模式）"
    if 50.0 <= north_star_pct < 85.0:
        return "⚡ Optimization Mode（优化模式）"
    return "🔥 Acceleration Mode（加速模式）"

def risk_level_from(score: Dict[str, Any]) -> str:
    # 你也可以更严格：例如 fail_rate>1% 直接中风险
    if not score.get("accepted", False):
        return "高"
    fail_rate = float(score.get("fail_rate", 0.0))
    stall = float(score.get("bottleneck", {}).get("longest_stall_median_seconds", 0.0))
    if fail_rate > 0.01 or stall > 20 * 60:
        return "中"
    return "低"

def format_block(report: Dict[str, Any], prev_ns_pct: float | None) -> str:
    top1 = report.get("top1", {})
    score = top1.get("score", {}) or {}
    accepted = bool(score.get("accepted", False))

    v_total = float(score.get("V_total", 0.0)) if accepted else 0.0
    ns_pct = clamp01(v_total) * 100.0

    # trend：用上次写入的 North Star（prev_ns_pct）来判断
    trend = "flat"
    if prev_ns_pct is not None:
        if ns_pct > prev_ns_pct + 0.5:
            trend = "up"
        elif ns_pct < prev_ns_pct - 0.5:
            trend = "down"

    risk = risk_level_from(score)
    mode = pick_mode(ns_pct, risk, accepted, trend)

    comps = (score.get("components", {}) or {})
    def pct(x: Any) -> str:
        try:
            return f"{clamp01(float(x))*100:.1f}%"
        except Exception:
            return "N/A"

    constraint_failed = score.get("constraint_failed")
    fail_rate = score.get("fail_rate", 0.0)
    stall = (score.get("bottleneck", {}) or {}).get("longest_stall_median_seconds", 0.0)

    # Task：按模式给一个“单任务”示例（你可以换成自己的任务库/ID体系）
    if mode.startswith("🚑"):
        task_id = "fix-sim-constraints"
        acceptance = "Top1 accepted=true；fail_rate<=1%；stall_median<=20min"
        impact = "修复导致不可运行/下降的根因，恢复 North Star 到可评估区间。"
    elif mode.startswith("🔥"):
        task_id = "improve-growth-momentum"
        acceptance = "growth_momentum +5% 以上，且不触发 hard constraints"
        impact = "加速提升成长动量，直接拉升 North Star。"
    elif mode.startswith("⚡"):
        task_id = "improve-return-quality"
        acceptance = "return_quality +5% 以上，且 stability 不下降"
        impact = "提升回归后继续玩的比例，稳步推高 North Star。"
    else:
        task_id = "reduce-risk-debt"
        acceptance = "fail_rate<=0.5%，stall_median<=15min，constraint_failed=null"
        impact = "降低风险指标，避免 North Star 回落并提高可持续迭代速度。"

    # Verify：告诉怎么跑
    verify = "\n".join([
        "```bash",
        "python search.py --baseline balance/baseline.json --space balance/search_space.json --runs 2000 --generations 15 --population 40 --topk 5",
        "python tools/update_roadmap.py --report output/tuning_report.json --roadmap ROADMAP.md --diff-only",
        "```",
        "指标验证：对比本次写入的 North Star / Supporting / Risk 与上次记录。"
    ])

    # 生成区块（严格按你 AGENTS.md 的输出格式字段）
    lines = []
    lines += ["[Mode]", mode, ""]
    lines += ["[North Star]", f"{ns_pct:.1f}% (trend: {trend})", ""]
    lines += ["[Supporting Metrics]"]
    lines += [f"- growth_momentum: {pct(comps.get('growth_momentum'))}"]
    lines += [f"- return_quality: {pct(comps.get('return_quality'))}"]
    lines += [f"- upgrade_satisfaction: {pct(comps.get('upgrade_satisfaction'))}"]
    lines += [f"- progress_clarity: {pct(comps.get('progress_clarity'))}"]
    lines += [f"- stability_score: {pct(comps.get('stability_score'))}"]
    lines += ["", "[Risk Level]", risk, ""]
    lines += ["[Task]", f"{task_id} / {acceptance}", ""]
    lines += ["[Impact]", impact, ""]
    lines += ["[Do]"]
    lines += ["- 修改文件列表：balance/baseline.json（若应用 top_params），或评分/模拟逻辑相关文件"]
    lines += ["- 实现摘要：基于本轮 Mode 仅做 1 个任务，完成后重新跑 search + score 验证指标变化"]
    lines += ["", "[Verify]", verify, ""]
    lines += ["[RoadmapPatch]", "(diff only; generated by tools/update_roadmap.py)", ""]
    lines += ["[Next]", f"{task_id}"]
    lines += ["", "----", ""]
    lines += ["(raw)"]
    lines += [f"- accepted: {accepted}"]
    lines += [f"- constraint_failed: {constraint_failed}"]
    lines += [f"- fail_rate: {fail_rate}"]
    lines += [f"- longest_stall_median_seconds: {stall}"]
    return "\n".join(lines).strip() + "\n"

def extract_prev_ns_pct(roadmap_text: str) -> float | None:
    # 很轻量的解析：在自动块里找形如 "xx.x%"
    if AUTO_START not in roadmap_text or AUTO_END not in roadmap_text:
        return None
    blk = roadmap_text.split(AUTO_START, 1)[1].split(AUTO_END, 1)[0]
    for token in blk.split():
        if token.endswith("%"):
            try:
                return float(token[:-1])
            except Exception:
                pass
    return None

def replace_auto_block(roadmap_text: str, new_block: str) -> str:
    if AUTO_START not in roadmap_text or AUTO_END not in roadmap_text:
        # 没有锚点就追加到文件末尾
        return roadmap_text.rstrip() + "\n\n" + AUTO_START + "\n" + new_block + AUTO_END + "\n"
    before = roadmap_text.split(AUTO_START, 1)[0]
    after = roadmap_text.split(AUTO_END, 1)[1]
    return before + AUTO_START + "\n" + new_block + AUTO_END + after

def unified_diff(a: str, b: str, fromfile: str, tofile: str) -> str:
    al = a.splitlines(keepends=True)
    bl = b.splitlines(keepends=True)
    diff = difflib.unified_diff(al, bl, fromfile=fromfile, tofile=tofile, lineterm="")
    out = "\n".join(diff) + "\n"
    return out

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", default="output/tuning_report.json")
    ap.add_argument("--roadmap", default="ROADMAP.md")
    ap.add_argument("--diff-only", action="store_true")
    ap.add_argument("--apply", action="store_true", help="Write updated ROADMAP.md")
    args = ap.parse_args()

    report = load_json(args.report)
    roadmap = load_text(args.roadmap) if os.path.exists(args.roadmap) else ""

    prev = extract_prev_ns_pct(roadmap)
    block = format_block(report, prev)
    updated = replace_auto_block(roadmap, block)

    diff = unified_diff(roadmap, updated, f"a/{args.roadmap}", f"b/{args.roadmap}")
    if args.diff_only:
        print(diff)
        return
    if args.apply:
        save_text(args.roadmap, updated)
    print(diff)

if __name__ == "__main__":
    main()