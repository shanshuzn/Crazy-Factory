#!/usr/bin/env python3
"""Create a structured iteration todo note for Crazy-Factory workflow."""
from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True, help="Iteration ID, e.g. G")
    parser.add_argument("--slice", required=True, help="Vertical slice, e.g. fx-event, ui-panel")
    parser.add_argument("--goal", required=True, help="One-sentence goal")
    parser.add_argument(
        "--out",
        default="docs/roadmaps/ITERATION_TODO.md",
        help="Output markdown path",
    )
    args = parser.parse_args()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    content = f"""# Iteration {args.id} TODO\n\n- 日期：{date.today().isoformat()}\n- 垂直切片：{args.slice}\n- 目标：{args.goal}\n\n## 任务清单\n- [ ] 仅修改一个垂直切片\n- [ ] 更新 `docs/roadmaps/MULTI_FILE_ARCH_ROADMAP.md`\n- [ ] 追加 `docs/roadmaps/ROLLING_UPDATE_LOG.md`\n- [ ] 运行 `npm run check`\n- [ ] 提交 commit\n- [ ] 创建 PR\n\n## 命令\n```bash\nnpm run check\npython3 skills/crazy-factory-iteration/scripts/add_iteration_log.py \\\n  --id {args.id} \\\n  --goal \"{args.goal}\" \\\n  --changes \"<填写改动>\" \\\n  --checks \"npm run check\" \\\n  --rollback \"<填写回滚点>\"\n```\n"""

    out.write_text(content, encoding="utf-8")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
