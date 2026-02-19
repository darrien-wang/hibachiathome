#!/usr/bin/env bash
set -euo pipefail

SPEC_FILE="harness/prompts/tracking-improvement-spec.xml"
FEATURE_FILE="harness/feature_list.json"
PROGRESS_FILE="harness/codex-progress.md"
TRACKING_DOC_FILE="harness/docs/tracking.md"
GTM_ENV_KEY="NEXT_PUBLIC_GTM_ID"

echo "[codex:session] pwd: $(pwd)"
echo "[codex:session] Checking required files..."

for f in "$SPEC_FILE" "$FEATURE_FILE" "$PROGRESS_FILE"; do
  if [ -f "$f" ]; then
    echo "  - OK: $f"
  else
    echo "  - MISSING: $f"
  fi
done

if [ -f "$TRACKING_DOC_FILE" ]; then
  echo "  - OK: $TRACKING_DOC_FILE"
else
  echo "  - WARN: missing $TRACKING_DOC_FILE (required by spec)"
fi

if [ -f "$FEATURE_FILE" ]; then
  remaining=$( (rg -n '"passes": false' "$FEATURE_FILE" || true) | wc -l | tr -d ' ' )
  done_count=$( (rg -n '"passes": true' "$FEATURE_FILE" || true) | wc -l | tr -d ' ' )
  echo "[codex:session] feature_list status: $done_count passing / $remaining remaining"
  if [ "$done_count" = "0" ]; then
    echo "[codex:session] WARN: no passing baseline items; regression rule is currently blocked."
  fi
fi

echo "[codex:session] Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

if git diff --quiet && git diff --cached --quiet; then
  echo "[codex:session] Working tree: clean"
else
  echo "[codex:session] WARN: working tree has local changes"
  git status --short || true
fi

if [ -n "${!GTM_ENV_KEY:-}" ]; then
  echo "[codex:session] Env: $GTM_ENV_KEY is set"
else
  echo "[codex:session] WARN: $GTM_ENV_KEY is not set in this shell"
fi

echo "[codex:session] Recent commits:"
git log --oneline -10 || true
