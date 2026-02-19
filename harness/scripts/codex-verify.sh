#!/usr/bin/env bash
set -euo pipefail

echo "[codex:verify] Running lint..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm lint
else
  npm run lint
fi

echo "[codex:verify] Running build..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm next build --experimental-build-mode=compile
else
  npx next build --experimental-build-mode=compile
fi

echo "[codex:verify] Completed static gates (lint + build)."
