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

## Local Stripe Webhook Quickstart

1. Initialize local env file:

```bash
cp .env.example .env.local
```

2. Fill at least the required keys in `.env.local`:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_BASE_URL` (use `http://localhost:3000` locally)

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

## Long-Running Workflow Files

- `harness/prompts/tracking-improvement-spec.xml`
- `harness/feature_list.json`
- `harness/codex-progress.md`
- `harness/verification/`
