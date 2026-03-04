#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.local}"
WEBHOOK_PATH="/api/stripe/webhook"
EVENTS="checkout.session.completed,charge.refunded"

if ! command -v stripe >/dev/null 2>&1; then
  echo "[stripe:listen] ERROR: Stripe CLI not found."
  echo "[stripe:listen] Install: https://docs.stripe.com/stripe-cli/install"
  exit 1
fi

if [ ! -f "${ENV_FILE}" ]; then
  echo "[stripe:listen] ERROR: ${ENV_FILE} not found."
  echo "[stripe:listen] Hint: cp .env.example .env.local"
  exit 1
fi

raw_base_url="$(rg -n '^NEXT_PUBLIC_BASE_URL=' "${ENV_FILE}" -N --no-heading --color=never | head -n1 || true)"
if [ -z "${raw_base_url}" ]; then
  base_url="http://localhost:3000"
else
  base_url="${raw_base_url#*=}"
  base_url="$(echo "${base_url}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
fi

if ! echo "${base_url}" | rg -q '^https?://'; then
  echo "[stripe:listen] ERROR: NEXT_PUBLIC_BASE_URL must start with http:// or https://"
  exit 1
fi

forward_to="${base_url%/}${WEBHOOK_PATH}"

echo "[stripe:listen] Forward target: ${forward_to}"
echo "[stripe:listen] Events: ${EVENTS}"
echo "[stripe:listen] After start, copy the printed whsec_... into STRIPE_WEBHOOK_SECRET in ${ENV_FILE}"
echo

exec stripe listen --events "${EVENTS}" --forward-to "${forward_to}"
