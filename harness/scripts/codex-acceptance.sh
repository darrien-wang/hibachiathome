#!/usr/bin/env bash
set -euo pipefail

FEATURE_FILE="harness/feature_list.json"
VERIFICATION_DIR="harness/verification"

# Optional override for e2e command.
E2E_CMD="${CODEX_E2E_CMD:-}"

if [ ! -f "$FEATURE_FILE" ]; then
  echo "[codex:acceptance] ERROR: missing $FEATURE_FILE"
  exit 1
fi

if [ ! -d "$VERIFICATION_DIR" ]; then
  echo "[codex:acceptance] ERROR: missing $VERIFICATION_DIR/"
  exit 1
fi

done_count=$( (rg -n '"passes": true' "$FEATURE_FILE" || true) | wc -l | tr -d ' ' )
remaining_count=$( (rg -n '"passes": false' "$FEATURE_FILE" || true) | wc -l | tr -d ' ' )

echo "[codex:acceptance] feature_list status: $done_count passing / $remaining_count remaining"

if [ "$done_count" = "0" ]; then
  echo "[codex:acceptance] WARN: no passing baseline items."
  echo "[codex:acceptance] You cannot perform required regression re-checks until at least one item is marked passing."
fi

echo "[codex:acceptance] Gate 1/3: static quality (lint + build)"
bash harness/scripts/codex-verify.sh

if [ -z "$E2E_CMD" ]; then
  if command -v pnpm >/dev/null 2>&1 && pnpm run | rg -q '^\s*test:e2e\b'; then
    E2E_CMD="pnpm test:e2e"
  elif command -v npm >/dev/null 2>&1 && npm run | rg -q '^\s*test:e2e\b'; then
    E2E_CMD="npm run test:e2e"
  fi
fi

echo "[codex:acceptance] Gate 2/3: UI end-to-end regression"
if [ -z "$E2E_CMD" ]; then
  echo "[codex:acceptance] ERROR: no E2E command configured."
  echo "[codex:acceptance] Define CODEX_E2E_CMD or add package script test:e2e."
  exit 1
fi

# shellcheck disable=SC2086
$E2E_CMD

echo "[codex:acceptance] Gate 3/3: evidence presence"
if ! find "$VERIFICATION_DIR" -type f | rg -q .; then
  echo "[codex:acceptance] ERROR: no evidence files found under harness/verification/."
  echo "[codex:acceptance] Save screenshots/logs for the validated flow and rerun."
  exit 1
fi

echo "[codex:acceptance] PASS: acceptance gates satisfied."
