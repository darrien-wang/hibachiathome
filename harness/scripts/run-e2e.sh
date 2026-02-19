#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCAL_LIB_ROOT="$ROOT_DIR/.cache/playwright-libs"
LOCAL_LIB_DIR="$LOCAL_LIB_ROOT/usr/lib/x86_64-linux-gnu"
PLAYWRIGHT_CACHE_DIR="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"

needs_local_nss_libs=0
if command -v ldconfig >/dev/null 2>&1; then
  if ! ldconfig -p 2>/dev/null | grep -q "libnspr4.so"; then
    needs_local_nss_libs=1
  fi
fi

if [ "$needs_local_nss_libs" = "1" ]; then
  if [ ! -f "$LOCAL_LIB_DIR/libnspr4.so" ] || [ ! -f "$LOCAL_LIB_DIR/libnss3.so" ]; then
    if command -v apt >/dev/null 2>&1 && command -v dpkg-deb >/dev/null 2>&1; then
      mkdir -p "$ROOT_DIR/.cache/apt"
      (
        cd "$ROOT_DIR/.cache/apt"
        apt download libnspr4 libnss3 >/dev/null
        mkdir -p "$LOCAL_LIB_ROOT"
        dpkg-deb -x libnspr4_*_amd64.deb "$LOCAL_LIB_ROOT"
        dpkg-deb -x libnss3_*_amd64.deb "$LOCAL_LIB_ROOT"
      )
    fi
  fi

  if [ -f "$LOCAL_LIB_DIR/libnspr4.so" ] && [ -f "$LOCAL_LIB_DIR/libnss3.so" ]; then
    export LD_LIBRARY_PATH="$LOCAL_LIB_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  fi
fi

cd "$ROOT_DIR"

should_install_playwright=1
if [ "${CODEX_SKIP_PLAYWRIGHT_INSTALL:-0}" = "1" ]; then
  should_install_playwright=0
elif compgen -G "$PLAYWRIGHT_CACHE_DIR/chromium-*" >/dev/null 2>&1 \
  && compgen -G "$PLAYWRIGHT_CACHE_DIR/chromium_headless_shell-*" >/dev/null 2>&1; then
  should_install_playwright=0
fi

if [ "$should_install_playwright" = "1" ]; then
  pnpm exec playwright install chromium
else
  echo "[run-e2e] Reusing existing Playwright Chromium from $PLAYWRIGHT_CACHE_DIR"
fi

pnpm exec playwright test "$@"
