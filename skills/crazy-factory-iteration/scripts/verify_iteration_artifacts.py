#!/usr/bin/env python3
"""Validate required iteration artifacts for the current iteration id."""
from __future__ import annotations

import argparse
from pathlib import Path


REQUIRED_FILES = [
    Path("docs/roadmaps/MULTI_FILE_ARCH_ROADMAP.md"),
    Path("docs/roadmaps/ROLLING_UPDATE_LOG.md"),
    Path("docs/roadmaps/ITERATION_TODO.md"),
]


def _contains_iteration_id(path: Path, iteration_id: str) -> bool:
    text = path.read_text(encoding="utf-8")
    return f"Iteration {iteration_id}" in text


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True, help="Iteration ID, e.g. H")
    parser.add_argument(
        "--require-vibe-note",
        action="store_true",
        help="Require a 'Vibe' note in rolling log for this iteration",
    )
    args = parser.parse_args()

    missing = [path for path in REQUIRED_FILES if not path.exists()]
    if missing:
        print("missing required files:")
        for path in missing:
            print(f"- {path}")
        return 1

    no_iteration_id = [
        path for path in REQUIRED_FILES if not _contains_iteration_id(path, args.id)
    ]
    if no_iteration_id:
        print(f"iteration id 'Iteration {args.id}' not found in:")
        for path in no_iteration_id:
            print(f"- {path}")
        return 1

    if args.require_vibe_note:
        rolling = Path("docs/roadmaps/ROLLING_UPDATE_LOG.md")
        block = rolling.read_text(encoding="utf-8").split(f"Iteration {args.id}", 1)[-1]
        if "Vibe" not in block and "vibe" not in block:
            print("missing vibe note in ROLLING_UPDATE_LOG.md for this iteration")
            return 1

    print(f"iteration artifacts OK for Iteration {args.id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

