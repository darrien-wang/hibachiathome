# Real Hibachi Marketing

## Codex Harness Quick Start

1. Run bootstrap:

```bash
bash harness/init.sh
```

2. Start a Codex session checklist:

```bash
bash harness/scripts/codex-session-start.sh
```

3. Run static quality gates:

```bash
bash harness/scripts/codex-verify.sh
```

4. Run full acceptance gates (aligned to autonomous-coding flow):

```bash
bash harness/scripts/codex-acceptance.sh
```

Notes:
- `codex-verify.sh` = lint + build only.
- `codex-acceptance.sh` = static gates + UI end-to-end test command + evidence check under `harness/verification/`.
- Configure UI E2E via `test:e2e` script or `CODEX_E2E_CMD`.
- `test:e2e` uses Playwright (`harness/scripts/run-e2e.sh`) and performs first-run Chromium/bootstrap setup automatically.

## Local Cross-Project Stack (Recommended)

Use one command to run the full local integration stack for manual E2E testing:
- marketing app (`http://127.0.0.1:3100`)
- invoice app (`http://127.0.0.1:3101`)
- Stripe webhook forwarder -> marketing `/api/stripe/webhook`

Start:

```bash
pnpm local:stack:start
```

Check status:

```bash
pnpm local:stack:status
```

View recent logs:

```bash
pnpm local:stack:logs
```

Stop all script-managed services:

```bash
pnpm local:stack:stop
```

Notes:
- The script stores pid/log files under `.codex/local-stack/`.
- If Stripe CLI prints a new `whsec_...`, update `STRIPE_WEBHOOK_SECRET` in `.env.local` and restart marketing.
- Override defaults when needed:
  - `MARKETING_PORT` (default `3100`)
  - `INVOICE_PORT` (default `3101`)
  - `INVOICE_DIR` (default `../v0-real-hibachi-invoice-generator`)

## Local Stripe Webhook Quickstart

1. Initialize local env file:

```bash
cp .env.example .env.local
```

2. Fill at least the required keys in `.env.local`:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_BASE_URL` (use `http://localhost:3000` locally)
- `CRM_INTEGRATION_BASE_URL`
- `CRM_INTEGRATION_SHARED_SECRET`
- `CRM_INTEGRATION_REPLAY_TOKEN`

Optional CRM keys:
- `CRM_INTEGRATION_PARTNER_ID` (default `official_website`)
- `CRM_INTEGRATION_SOURCE` (default `official_website`)
- `CRM_INTEGRATION_MAX_ATTEMPTS` (positive integer, default `10`)

3. Run env sanity check:

```bash
pnpm env:check
```

4. Start app:

```bash
pnpm dev
```

5. In another terminal, run Stripe CLI webhook forwarder:

```bash
stripe listen --events checkout.session.completed,charge.refunded --forward-to localhost:3000/api/stripe/webhook
```

6. Copy the CLI output `whsec_...` value into `.env.local` as `STRIPE_WEBHOOK_SECRET`, then restart `pnpm dev`.

Alternative helper command (auto-reads `NEXT_PUBLIC_BASE_URL` from `.env.local`):

```bash
pnpm stripe:listen:local
```

7. Replay pending CRM outbox events manually (for local integration retries):

```bash
curl -X POST "http://localhost:3000/api/integrations/crm/outbox/replay?limit=20" \
  -H "x-crm-replay-token: $CRM_INTEGRATION_REPLAY_TOKEN"
```

## Long-Running Workflow Files

- `harness/prompts/tracking-improvement-spec.xml`
- `harness/feature_list.json`
- `harness/codex-progress.md`
- `harness/verification/`
