#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
INVOICE_DIR_DEFAULT="${MARKETING_DIR}/../v0-real-hibachi-invoice-generator"
INVOICE_DIR="${INVOICE_DIR:-${INVOICE_DIR_DEFAULT}}"

MARKETING_PORT="${MARKETING_PORT:-3100}"
INVOICE_PORT="${INVOICE_PORT:-3101}"
WEBHOOK_EVENTS="${WEBHOOK_EVENTS:-checkout.session.completed,charge.refunded}"
WEBHOOK_FORWARD_URL="${WEBHOOK_FORWARD_URL:-http://127.0.0.1:${MARKETING_PORT}/api/stripe/webhook}"

STATE_DIR="${MARKETING_DIR}/.codex/local-stack"
mkdir -p "${STATE_DIR}"

MARKETING_PID_FILE="${STATE_DIR}/marketing.pid"
INVOICE_PID_FILE="${STATE_DIR}/invoice.pid"
STRIPE_PID_FILE="${STATE_DIR}/stripe.pid"

MARKETING_LOG="${STATE_DIR}/marketing.log"
INVOICE_LOG="${STATE_DIR}/invoice.log"
STRIPE_LOG="${STATE_DIR}/stripe.log"

usage() {
  cat <<'EOF'
Usage: bash harness/scripts/local-stack.sh <start|status|stop|logs>

Environment overrides:
  MARKETING_PORT      default: 3100
  INVOICE_PORT        default: 3101
  INVOICE_DIR         default: ../v0-real-hibachi-invoice-generator
  WEBHOOK_EVENTS      default: checkout.session.completed,charge.refunded
  WEBHOOK_FORWARD_URL default: http://127.0.0.1:${MARKETING_PORT}/api/stripe/webhook
EOF
}

pid_from_file() {
  local pid_file="$1"
  if [ -f "${pid_file}" ]; then
    cat "${pid_file}"
    return 0
  fi
  return 1
}

is_pid_running() {
  local pid="$1"
  if [ -z "${pid}" ]; then
    return 1
  fi
  kill -0 "${pid}" >/dev/null 2>&1
}

is_port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :${port} )" 2>/dev/null | rg -q ":${port}[[:space:]]"
    return $?
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  return 1
}

is_external_stripe_listen_running() {
  if command -v pgrep >/dev/null 2>&1; then
    pgrep -f "stripe listen .*api/stripe/webhook" >/dev/null 2>&1
    return $?
  fi

  ps -ef | rg -q "stripe listen .*api/stripe/webhook"
}

start_service() {
  local name="$1"
  local workdir="$2"
  local cmd="$3"
  local port="$4"
  local pid_file="$5"
  local log_file="$6"

  local existing_pid=""
  if existing_pid="$(pid_from_file "${pid_file}" 2>/dev/null)" && is_pid_running "${existing_pid}"; then
    echo "[local-stack] ${name} already running (pid=${existing_pid})."
    return 0
  fi

  if [ "${port}" != "none" ] && is_port_in_use "${port}"; then
    echo "[local-stack] ${name} port ${port} is already in use (likely started outside this script). Skipping start."
    return 0
  fi

  if [ ! -d "${workdir}" ]; then
    echo "[local-stack] ERROR: ${name} workdir not found: ${workdir}"
    exit 1
  fi

  echo "[local-stack] starting ${name}..."
  (
    cd "${workdir}"
    nohup bash -lc "${cmd}" >>"${log_file}" 2>&1 &
    echo $! > "${pid_file}"
  )

  sleep 1
  local new_pid
  new_pid="$(cat "${pid_file}")"
  if is_pid_running "${new_pid}"; then
    echo "[local-stack] ${name} started (pid=${new_pid}). log=${log_file}"
  else
    echo "[local-stack] ERROR: failed to start ${name}. recent log:"
    tail -n 40 "${log_file}" || true
    rm -f "${pid_file}"
    exit 1
  fi
}

stop_service() {
  local name="$1"
  local pid_file="$2"

  if [ ! -f "${pid_file}" ]; then
    echo "[local-stack] ${name} not managed by script (no pid file)."
    return 0
  fi

  local pid
  pid="$(cat "${pid_file}")"
  if ! is_pid_running "${pid}"; then
    echo "[local-stack] ${name} already stopped (stale pid file removed)."
    rm -f "${pid_file}"
    return 0
  fi

  echo "[local-stack] stopping ${name} (pid=${pid})..."
  kill "${pid}" >/dev/null 2>&1 || true
  sleep 1

  if is_pid_running "${pid}"; then
    kill -9 "${pid}" >/dev/null 2>&1 || true
  fi

  rm -f "${pid_file}"
  echo "[local-stack] ${name} stopped."
}

print_status_line() {
  local name="$1"
  local pid_file="$2"
  local port="$3"
  local url="$4"

  if [ -f "${pid_file}" ]; then
    local pid
    pid="$(cat "${pid_file}")"
    if is_pid_running "${pid}"; then
      echo "[local-stack] ${name}: running (pid=${pid})${url:+ url=${url}}"
      return
    fi
    echo "[local-stack] ${name}: stopped (stale pid file)"
    return
  fi

  if [ "${port}" != "none" ] && is_port_in_use "${port}"; then
    echo "[local-stack] ${name}: running (external process on port ${port})${url:+ url=${url}}"
    return
  fi

  echo "[local-stack] ${name}: stopped"
}

start_all() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "[local-stack] ERROR: pnpm is required."
    exit 1
  fi

  start_service "marketing" "${MARKETING_DIR}" "pnpm dev --hostname 127.0.0.1 --port ${MARKETING_PORT}" "${MARKETING_PORT}" "${MARKETING_PID_FILE}" "${MARKETING_LOG}"
  start_service "invoice" "${INVOICE_DIR}" "pnpm dev --hostname 127.0.0.1 --port ${INVOICE_PORT}" "${INVOICE_PORT}" "${INVOICE_PID_FILE}" "${INVOICE_LOG}"

  if ! command -v stripe >/dev/null 2>&1; then
    echo "[local-stack] WARN: Stripe CLI not found; webhook forwarder not started."
  else
    local stripe_pid=""
    if stripe_pid="$(pid_from_file "${STRIPE_PID_FILE}" 2>/dev/null)" && is_pid_running "${stripe_pid}"; then
      echo "[local-stack] stripe-listen already running (pid=${stripe_pid})."
    elif is_external_stripe_listen_running; then
      echo "[local-stack] stripe-listen already running (external process). Skipping start."
    else
      start_service "stripe-listen" "${MARKETING_DIR}" "stripe listen --events ${WEBHOOK_EVENTS} --forward-to ${WEBHOOK_FORWARD_URL}" "none" "${STRIPE_PID_FILE}" "${STRIPE_LOG}"
    fi

    if [ -f "${STRIPE_LOG}" ]; then
      local whsec=""
      whsec="$(rg -o "whsec_[A-Za-z0-9]+" "${STRIPE_LOG}" -N --no-heading | tail -n1 || true)"
      if [ -n "${whsec}" ]; then
        echo "[local-stack] stripe webhook secret detected: ${whsec}"
        echo "[local-stack] set STRIPE_WEBHOOK_SECRET=${whsec} in .env.local, then restart marketing service."
      else
        echo "[local-stack] stripe webhook secret not yet detected. run: bash harness/scripts/local-stack.sh logs"
      fi
    elif is_external_stripe_listen_running; then
      echo "[local-stack] stripe webhook secret is managed by an external stripe listen process."
    fi
  fi

  echo "[local-stack] done."
}

status_all() {
  print_status_line "marketing" "${MARKETING_PID_FILE}" "${MARKETING_PORT}" "http://127.0.0.1:${MARKETING_PORT}"
  print_status_line "invoice" "${INVOICE_PID_FILE}" "${INVOICE_PORT}" "http://127.0.0.1:${INVOICE_PORT}"
  if [ -f "${STRIPE_PID_FILE}" ]; then
    print_status_line "stripe-listen" "${STRIPE_PID_FILE}" "none" ""
  elif is_external_stripe_listen_running; then
    echo "[local-stack] stripe-listen: running (external process)"
  else
    echo "[local-stack] stripe-listen: stopped"
  fi

  local whsec=""
  if [ -f "${STRIPE_LOG}" ]; then
    whsec="$(rg -o "whsec_[A-Za-z0-9]+" "${STRIPE_LOG}" -N --no-heading | tail -n1 || true)"
  fi
  if [ -n "${whsec}" ]; then
    echo "[local-stack] latest stripe webhook secret in log: ${whsec}"
  fi
}

stop_all() {
  stop_service "stripe-listen" "${STRIPE_PID_FILE}"
  stop_service "invoice" "${INVOICE_PID_FILE}"
  stop_service "marketing" "${MARKETING_PID_FILE}"
}

logs_all() {
  echo "[local-stack] logs:"
  echo "  marketing: ${MARKETING_LOG}"
  echo "  invoice:   ${INVOICE_LOG}"
  echo "  stripe:    ${STRIPE_LOG}"
  echo
  tail -n 60 "${MARKETING_LOG}" "${INVOICE_LOG}" "${STRIPE_LOG}" 2>/dev/null || true
}

main() {
  local cmd="${1:-}"
  case "${cmd}" in
    start)
      start_all
      ;;
    status)
      status_all
      ;;
    stop)
      stop_all
      ;;
    logs)
      logs_all
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "${1:-}"
