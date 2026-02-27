from __future__ import annotations

import argparse
import difflib
import json
import os
from typing import Any, Dict


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(path: str, data: Any) -> None:
    _ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _json_lines(obj: Any) -> list[str]:
    return json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True).splitlines(keepends=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", default="balance/baseline.json")
    ap.add_argument("--top", default="output/top_params.json")
    ap.add_argument("--out_diff", default="output/balance.patch.diff")
    ap.add_argument("--emit-diff", action="store_true", help="Emit diff only (do not overwrite baseline).")
    ap.add_argument("--apply", action="store_true", help="Apply top params to baseline.json.")
    args = ap.parse_args()

    if not os.path.exists(args.baseline):
        raise FileNotFoundError(f"Missing baseline: {args.baseline}")
    if not os.path.exists(args.top):
        raise FileNotFoundError(f"Missing top params: {args.top}")

    baseline = _load_json(args.baseline)
    top = _load_json(args.top)

    before = _json_lines(baseline)
    after = _json_lines(top)

    diff = list(
        difflib.unified_diff(
            before,
            after,
            fromfile=f"a/{args.baseline}",
            tofile=f"b/{args.baseline}",
            lineterm="",
        )
    )
    diff_text = "\n".join(diff) + ("\n" if diff else "")

    _ensure_dir(os.path.dirname(args.out_diff))
    with open(args.out_diff, "w", encoding="utf-8") as f:
        f.write(diff_text)

    if args.apply:
        _save_json(args.baseline, top)
        print(f"[OK] Applied top params to {args.baseline}")

    print(f"[OK] Wrote diff: {args.out_diff}")
    if args.emit_diff and diff_text.strip():
        print(diff_text)


if __name__ == "__main__":
    main()