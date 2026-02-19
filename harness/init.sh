#!/usr/bin/env bash
set -euo pipefail

echo "[codex:init] Installing dependencies..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
else
  npm install
fi

mkdir -p harness/verification

echo "[codex:init] Environment ready."
echo "[codex:init] Next commands:"
echo "  bash harness/scripts/codex-session-start.sh"
echo "  pnpm dev    # or npm run dev"
