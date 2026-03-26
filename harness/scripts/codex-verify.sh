#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAMP="$(date +%Y-%m-%d-%H%M%S)"
OUT_DIR="$ROOT_DIR/harness/verification/${STAMP}-codex-verify"
mkdir -p "$OUT_DIR"
cd "$ROOT_DIR"

echo "[codex:verify] Running lint..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm lint >>"$OUT_DIR/verify.log" 2>&1
else
  npm run lint >>"$OUT_DIR/verify.log" 2>&1
fi

echo "[codex:verify] Running build..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm next build --experimental-build-mode=compile >>"$OUT_DIR/verify.log" 2>&1
else
  npx next build --experimental-build-mode=compile >>"$OUT_DIR/verify.log" 2>&1
fi

echo "[codex:verify] Running e2e (required)..."
if [[ -n "${E2E_ARGS:-}" ]]; then
  # shellcheck disable=SC2086
  bash harness/scripts/run-e2e.sh $E2E_ARGS >>"$OUT_DIR/verify.log" 2>&1
else
  bash harness/scripts/run-e2e.sh >>"$OUT_DIR/verify.log" 2>&1
fi

echo "[codex:verify] Completed gates (lint + build + e2e required)."
echo "[codex:verify] log: $OUT_DIR/verify.log"
