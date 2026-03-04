#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.local}"

echo "[env:check] Using env file: ${ENV_FILE}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "[env:check] ERROR: ${ENV_FILE} not found."
  echo "[env:check] Hint: cp .env.example .env.local"
  exit 1
fi

get_env_value() {
  local key="$1"
  local raw
  local value
  raw="$(rg -n "^${key}=" "${ENV_FILE}" -N --no-heading --color=never | head -n1 || true)"
  if [ -z "${raw}" ]; then
    echo ""
    return 0
  fi
  value="${raw#*=}"
  value="$(echo "${value}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  # Strip one layer of matching single/double quotes around the full value.
  if echo "${value}" | rg -q '^".*"$'; then
    value="${value#\"}"
    value="${value%\"}"
  elif echo "${value}" | rg -q "^'.*'$"; then
    value="${value#\'}"
    value="${value%\'}"
  fi

  echo "${value}"
}

is_placeholder() {
  local value="$1"
  if [ -z "${value}" ]; then
    return 0
  fi
  if echo "${value}" | rg -q "replace_me|replace-me|GTM-XXXXXXX|_replace_me"; then
    return 0
  fi
  return 1
}

errors=0
warnings=0

check_required() {
  local key="$1"
  local value
  value="$(get_env_value "${key}")"

  if [ -z "${value}" ]; then
    echo "[env:check] ERROR: ${key} is missing."
    errors=$((errors + 1))
    return
  fi

  if is_placeholder "${value}"; then
    echo "[env:check] ERROR: ${key} is using a placeholder value."
    errors=$((errors + 1))
    return
  fi

  echo "[env:check] OK: ${key} is set"
}

check_optional() {
  local key="$1"
  local value
  value="$(get_env_value "${key}")"
  if [ -z "${value}" ]; then
    echo "[env:check] WARN: ${key} is not set (optional)."
    warnings=$((warnings + 1))
    return
  fi

  if is_placeholder "${value}"; then
    echo "[env:check] WARN: ${key} is still a placeholder."
    warnings=$((warnings + 1))
    return
  fi

  echo "[env:check] OK: ${key} is set"
}

check_required "STRIPE_SECRET_KEY"
check_required "STRIPE_WEBHOOK_SECRET"
check_required "NEXT_PUBLIC_BASE_URL"

stripe_secret_key="$(get_env_value STRIPE_SECRET_KEY)"
stripe_webhook_secret="$(get_env_value STRIPE_WEBHOOK_SECRET)"
base_url="$(get_env_value NEXT_PUBLIC_BASE_URL)"

if [ -n "${stripe_secret_key}" ] && ! echo "${stripe_secret_key}" | rg -q '^sk_(test|live)_'; then
  echo "[env:check] ERROR: STRIPE_SECRET_KEY should start with sk_test_ or sk_live_."
  errors=$((errors + 1))
fi

if [ -n "${stripe_webhook_secret}" ] && ! echo "${stripe_webhook_secret}" | rg -q '^whsec_'; then
  echo "[env:check] ERROR: STRIPE_WEBHOOK_SECRET should start with whsec_."
  errors=$((errors + 1))
fi

if [ -n "${base_url}" ] && ! echo "${base_url}" | rg -q '^https?://'; then
  echo "[env:check] ERROR: NEXT_PUBLIC_BASE_URL should start with http:// or https://."
  errors=$((errors + 1))
fi

check_optional "SUPABASE_URL"
check_optional "SUPABASE_SERVICE_ROLE_KEY"
check_optional "NEXT_PUBLIC_SUPABASE_URL"
check_optional "NEXT_PUBLIC_SUPABASE_ANON_KEY"
check_optional "RESEND_API_KEY"
check_optional "EMAIL_FROM"
check_optional "NEXT_PUBLIC_GTM_ID"

if command -v stripe >/dev/null 2>&1; then
  echo "[env:check] OK: Stripe CLI detected ($(stripe --version | head -n1))."
else
  echo "[env:check] WARN: Stripe CLI not found. Install it for local webhook forwarding."
  warnings=$((warnings + 1))
fi

echo "[env:check] Summary: errors=${errors}, warnings=${warnings}"

if [ "${errors}" -gt 0 ]; then
  exit 1
fi
