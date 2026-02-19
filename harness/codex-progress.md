# Codex Progress Log

## 2026-02-18

- Established Codex long-running harness baseline.
- Added required workflow assets:
  - `AGENTS.md`
  - `feature_list.json`
  - `init.sh`
  - `scripts/codex-session-start.sh`
  - `scripts/codex-verify.sh`
  - `verification/.gitkeep`
- Added project-level Codex configuration:
  - `.codex/config.toml`
  - `.codex/instructions/coding_agent.md`
  - `.codex/instructions/initializer_agent.md`
- Next: implement and verify highest-priority tracking items from `feature_list.json`.

## 2026-02-18 (harness hardening pass)

- Completed:
  - Added non-interactive ESLint setup (`.eslintrc.json`, `eslint`, `eslint-config-next`) so `pnpm lint` can run in CI/agent loops.
  - Updated `scripts/codex-session-start.sh` with guardrails:
    - `docs/tracking.md` presence check
    - warning when `feature_list.json` has no passing baseline
    - branch + working-tree status
    - `NEXT_PUBLIC_GTM_ID` environment warning
  - Added `docs/tracking.md` contract scaffold from `prompts/tracking-improvement-spec.xml`.
  - Stabilized build verification path:
    - Updated `scripts/codex-verify.sh` to use `next build --experimental-build-mode=compile` (avoids sandbox EXDEV rename failure).
    - Removed `next/font/google` build-time fetch dependency from `app/layout.tsx` and added CSS font variable fallbacks in `app/globals.css`.
    - Deferred env-dependent service initialization to request/runtime in:
      - `app/api/contact/route.ts`
      - `app/api/notify-lead/route.ts`
      - `app/api/booking/create/route.ts`
      - `app/actions/payment.ts`
- Verified:
  - `bash scripts/codex-session-start.sh` executes and reports new guardrails.
  - `pnpm lint` exits `0` (warnings only).
  - `pnpm next build --experimental-build-mode=compile` exits `0`.
  - `bash scripts/codex-verify.sh` exits `0`.
- Regressions/blockers:
  - Blocker: no `passes: true` items in `feature_list.json`, so “re-verify previously passing flow” rule is currently blocked.
- Evidence:
  - `verification/2026-02-18-harness-fixes/session-start.log`
  - `verification/2026-02-18-harness-fixes/codex-verify.log`
  - `verification/2026-02-18-harness-fixes/codex-verify.exit`
  - `verification/2026-02-18-harness-fixes/lint.log`
  - `verification/2026-02-18-harness-fixes/lint.exit`
  - `verification/2026-02-18-harness-fixes/build.log`
  - `verification/2026-02-18-harness-fixes/build.exit`
  - `verification/2026-02-18-harness-fixes/README.md`
- Next highest-priority action:
  - Implement and verify first P0 tracking item to establish baseline `passes: true`.
  - Start spec/backlog alignment notes inside `feature_list.json` entries to reduce event-contract drift.

## 2026-02-19 (real E2E wiring + first P0 baseline)

- Completed:
  - Wired true Playwright E2E execution into `test:e2e` via `harness/scripts/run-e2e.sh`.
    - Handles Playwright Chromium install.
    - Adds Linux NSS/NSPR shared-library bootstrap fallback for environments missing system libs.
  - Fixed Playwright web server startup command in `playwright.config.ts` (`pnpm dev --hostname 127.0.0.1 --port 3000`).
  - Implemented route-level `page_view` emission through `trackEvent(...)` in `TrackingBootstrap` with dedupe guard to prevent duplicate pushes on remount/hydration.
  - Replaced placeholder smoke check with a real P0 tracking E2E assertion:
    - verifies exactly one `page_view` on home load
    - verifies payload includes `page_path` (`/`) and non-empty `page_title`
    - writes JSON payload + screenshot into `harness/verification/`
- Feature status transition:
  - `TRK-001` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `pnpm test:e2e` passes (Playwright Chromium).
  - `bash harness/scripts/codex-verify.sh` passes (lint + build).
  - `bash harness/scripts/codex-acceptance.sh` passes (all 3 gates).
- Evidence:
  - `harness/verification/2026-02-19-e2e-p0/trk-001-home.png`
  - `harness/verification/2026-02-19-e2e-p0/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-e2e-p0/test-e2e.log`
  - `harness/verification/2026-02-19-e2e-p0/test-e2e.exit`
  - `harness/verification/2026-02-19-e2e-p0/codex-verify.log`
  - `harness/verification/2026-02-19-e2e-p0/codex-verify.exit`
  - `harness/verification/2026-02-19-e2e-p0/codex-acceptance.log`
  - `harness/verification/2026-02-19-e2e-p0/codex-acceptance.exit`
  - `harness/verification/2026-02-19-e2e-p0/EVIDENCE-MANIFEST.md` (含 commit hash + sha256 清单)
- Next highest-priority action:
  - Re-verify `TRK-001` as the newly established regression baseline at session start, then implement the next failing P0 item (`TRK-002`).

## Template For Future Sessions

- Date:
- Completed items:
- Verified flows:
- Regressions found/fixed:
- Evidence files (screenshots/logs):
- Next highest-priority item:
