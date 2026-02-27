#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'USAGE'
用法:
  bash scripts/verify_soak_thresholds.sh [OUT_DIR]

参数:
  OUT_DIR  归档目录（可选），默认 artifacts/soak-thresholds

说明:
  - 执行一个预期通过的 run_soak_check（默认 60s，exit 0）
  - 执行一个预期失败的 run_soak_check（默认 60s 严格阈值，exit 1）
  - 执行一个预期失败的 run_soak_check（非法参数，exit 1）
  - 归档每次执行的原始日志与 SOAK_REPORT JSON（非法参数仅归档日志）
  - JSON 解析优先使用 python（python3/python），不可用时自动回退到 node
  - 支持总耗时超时保护，超时时返回非零退出码

可选环境变量:
  VERIFY_SOAK_PASS_CMD     覆盖 pass 示例命令
  VERIFY_SOAK_FAIL_CMD     覆盖 fail 示例命令
  VERIFY_SOAK_INVALID_CMD  覆盖 invalid 示例命令
  VERIFY_SOAK_DISABLE_PYTHON=1 强制使用 node 解析 JSON
  VERIFY_SOAK_TIMEOUT_SEC  verify 总超时秒数（默认 180）

输出:
  <OUT_DIR>/pass.log
  <OUT_DIR>/fail.log
  <OUT_DIR>/invalid.log
  <OUT_DIR>/pass.json
  <OUT_DIR>/fail.json
USAGE
  exit 0
fi

OUT_DIR="${1:-artifacts/soak-thresholds}"
PASS_CMD="${VERIFY_SOAK_PASS_CMD:-node scripts/run_soak_check.js --seconds 60 --max-writes-std 3}"
FAIL_CMD="${VERIFY_SOAK_FAIL_CMD:-node scripts/run_soak_check.js --seconds 60 --max-writes-std 1}"
INVALID_CMD="${VERIFY_SOAK_INVALID_CMD:-node scripts/run_soak_check.js --bad-flag}"
TIMEOUT_SEC="${VERIFY_SOAK_TIMEOUT_SEC:-180}"

if ! [[ "$TIMEOUT_SEC" =~ ^[0-9]+$ ]] || [[ "$TIMEOUT_SEC" -le 0 ]]; then
  echo "[soak-threshold] VERIFY_SOAK_TIMEOUT_SEC must be a positive integer" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
START_TS=$SECONDS

check_timeout() {
  local elapsed=$((SECONDS - START_TS))
  if (( elapsed > TIMEOUT_SEC )); then
    echo "[soak-threshold] timeout: elapsed ${elapsed}s > limit ${TIMEOUT_SEC}s" >&2
    exit 1
  fi
}

extract_report_json_with_python() {
  local py_bin="$1"
  "$py_bin" -c 'import json,sys
text=sys.stdin.read()
marker="SOAK_REPORT"
idx=text.find(marker)
if idx < 0:
    raise SystemExit("SOAK_REPORT marker not found")
json_text=text[idx+len(marker):].strip()
obj=json.loads(json_text)
print(json.dumps(obj, ensure_ascii=False, indent=2))'
}

extract_report_json_with_node() {
  node -e 'const fs=require("fs");
const text=fs.readFileSync(0,"utf8");
const marker="SOAK_REPORT";
const idx=text.indexOf(marker);
if (idx < 0) {
  console.error("SOAK_REPORT marker not found");
  process.exit(1);
}
const jsonText=text.slice(idx + marker.length).trim();
const obj=JSON.parse(jsonText);
process.stdout.write(JSON.stringify(obj, null, 2) + "\n");'
}

extract_report_json() {
  local disable_python="${VERIFY_SOAK_DISABLE_PYTHON:-0}"

  if [[ "$disable_python" != "1" ]]; then
    if command -v python3 >/dev/null 2>&1; then
      extract_report_json_with_python python3
      return
    fi
    if command -v python >/dev/null 2>&1; then
      extract_report_json_with_python python
      return
    fi
  fi

  extract_report_json_with_node
}

run_case() {
  local label="$1"
  local expect_exit="$2"
  local cmd="$3"

  check_timeout
  echo "[soak-threshold] ${label}: expecting exit ${expect_exit}: ${cmd}"
  set +e
  local output
  output="$(bash -lc "$cmd" 2>&1)"
  local status=$?
  set -e

  printf '%s\n' "$output" | tee "$OUT_DIR/${label}.log"

  if [[ $status -ne $expect_exit ]]; then
    echo "[soak-threshold] ${label}: expected exit ${expect_exit}, got ${status}" >&2
    exit 1
  fi

  printf '%s\n' "$output" | extract_report_json > "$OUT_DIR/${label}.json"
  echo "[soak-threshold] ${label}: wrote $OUT_DIR/${label}.json"
  check_timeout
}

run_case pass 0 "$PASS_CMD"
run_case fail 1 "$FAIL_CMD"

run_invalid_case() {
  local label=invalid

  check_timeout
  echo "[soak-threshold] ${label}: expecting exit 1 and invalid-arg hint: ${INVALID_CMD}"
  set +e
  local output
  output="$(bash -lc "$INVALID_CMD" 2>&1)"
  local status=$?
  set -e

  printf '%s\n' "$output" | tee "$OUT_DIR/${label}.log"

  if [[ $status -ne 1 ]]; then
    echo "[soak-threshold] ${label}: expected exit 1, got ${status}" >&2
    exit 1
  fi

  if [[ "$output" != *"未知参数"* ]]; then
    echo "[soak-threshold] ${label}: missing invalid-arg hint" >&2
    exit 1
  fi

  echo "[soak-threshold] ${label}: verified invalid-arg path"
  check_timeout
}

run_invalid_case

echo "[soak-threshold] pass/fail/invalid paths verified and archived under: $OUT_DIR"
