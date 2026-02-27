#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'USAGE'
用法:
  bash scripts/verify_soak_thresholds.sh [OUT_DIR]

参数:
  OUT_DIR  归档目录（可选），默认 artifacts/soak-thresholds

说明:
  - 执行一个预期通过的 run_soak_check（exit 0）
  - 执行一个预期失败的 run_soak_check（exit 1）
  - 归档每次执行的原始日志与 SOAK_REPORT JSON

输出:
  <OUT_DIR>/pass.log
  <OUT_DIR>/fail.log
  <OUT_DIR>/pass.json
  <OUT_DIR>/fail.json
USAGE
  exit 0
fi

OUT_DIR="${1:-artifacts/soak-thresholds}"
PASS_CMD=(node scripts/run_soak_check.js --seconds 120 --max-writes-std 2)
FAIL_CMD=(node scripts/run_soak_check.js --seconds 10)
mkdir -p "$OUT_DIR"

extract_report_json() {
  python -c 'import json,sys
text=sys.stdin.read()
marker="SOAK_REPORT"
idx=text.find(marker)
if idx < 0:
    raise SystemExit("SOAK_REPORT marker not found")
json_text=text[idx+len(marker):].strip()
obj=json.loads(json_text)
print(json.dumps(obj, ensure_ascii=False, indent=2))'
}

run_case() {
  local label="$1"
  local expect_exit="$2"
  shift 2
  local -a cmd=("$@")

  echo "[soak-threshold] ${label}: expecting exit ${expect_exit}: ${cmd[*]}"
  set +e
  local output
  output="$(${cmd[@]} 2>&1)"
  local status=$?
  set -e

  printf '%s\n' "$output" | tee "$OUT_DIR/${label}.log"

  if [[ $status -ne $expect_exit ]]; then
    echo "[soak-threshold] ${label}: expected exit ${expect_exit}, got ${status}" >&2
    exit 1
  fi

  printf '%s\n' "$output" | extract_report_json > "$OUT_DIR/${label}.json"
  echo "[soak-threshold] ${label}: wrote $OUT_DIR/${label}.json"
}

run_case pass 0 "${PASS_CMD[@]}"
run_case fail 1 "${FAIL_CMD[@]}"

echo "[soak-threshold] pass/fail paths verified and archived under: $OUT_DIR"
