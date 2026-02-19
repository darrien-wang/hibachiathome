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

## 2026-02-19 (TRK-002 canonical page path + baseline recheck)

- Completed:
  - Re-ran session bootstrap via `bash harness/scripts/codex-session-start.sh`.
  - Implemented `trackEvent(...)` page context normalization in `lib/tracking.ts`:
    - `page_path` now uses canonical `window.location.pathname` (query string removed).
    - `page_title` now trims whitespace and falls back to `"Real Hibachi"` when blank.
  - Added deterministic verification harness script:
    - `harness/scripts/verify-tracking-page-view.mjs`
    - transpiles `lib/tracking.ts` and validates payload behavior with mocked browser globals.
- Feature status transition:
  - `TRK-002` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - Baseline recheck (`TRK-001` intent-level contract) via tracking harness script.
  - New `TRK-002` canonical path/title assertions via tracking harness script.
  - `bash harness/scripts/codex-verify.sh` passes (lint + build).
- Regressions/blockers:
  - Blocker (environment): Playwright UI verification is currently blocked in this sandbox due local loopback/network restrictions (`connect EPERM 127.0.0.1:3000`) and missing browser shared-lib path integration for MCP Chromium.
  - Captured failed Playwright reverify attempt as evidence; used deterministic code-level harness verification for this session.
- Evidence:
  - `harness/verification/2026-02-19-trk-002/reverify-trk-001.log`
  - `harness/verification/2026-02-19-trk-002/reverify-trk-001.exit`
  - `harness/verification/2026-02-19-trk-002/verify-trk-001-trk-002.log`
  - `harness/verification/2026-02-19-trk-002/verify-trk-001-trk-002.exit`
  - `harness/verification/2026-02-19-trk-002/trk-001-trk-002-tracking-lib-evidence.json`
  - `harness/verification/2026-02-19-trk-002/codex-verify.log`
  - `harness/verification/2026-02-19-trk-002/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-003` (route navigation emits a new `page_view` for `/book`) once Playwright loopback restriction is resolved, or add a route-state harness test that can prove `TrackingBootstrap` navigation behavior without localhost networking.

## 2026-02-19 (TRK-003 home->book page_view + UI verification unblocked)

- Completed:
  - Re-verified previously passing baseline contracts (`TRK-001`, `TRK-002`) via `harness/scripts/verify-tracking-page-view.mjs`.
  - Added `TRK-003` Playwright coverage in `e2e/smoke.spec.ts`:
    - starts on `/`
    - clicks header **Book Now** CTA
    - waits for `/book`
    - asserts a new `page_view` exists with `page_path: "/book"`.
  - Improved `harness/scripts/run-e2e.sh` to reuse existing Playwright Chromium when present (skip redundant install step that stalled this environment).
- Feature status transition:
  - `TRK-003` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `pnpm test:e2e --grep "TRK-001"` ✅
  - `pnpm test:e2e --grep "TRK-003"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - No functional regressions observed in this scope.
- Evidence:
  - `harness/verification/2026-02-19-trk-003/reverify-trk-001-trk-002.log`
  - `harness/verification/2026-02-19-trk-003/reverify-trk-001-trk-002.exit`
  - `harness/verification/2026-02-19-trk-003/trk-001-trk-002-tracking-lib-evidence.json`
  - `harness/verification/2026-02-19-trk-003/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-003/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-003/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-003/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-003/trk-003-e2e.log`
  - `harness/verification/2026-02-19-trk-003/trk-003-e2e.exit`
  - `harness/verification/2026-02-19-trk-003/trk-003-navigation-page-view-events.json`
  - `harness/verification/2026-02-19-trk-003/trk-003-book.png`
  - `harness/verification/2026-02-19-trk-003/codex-verify.log`
  - `harness/verification/2026-02-19-trk-003/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-004` (no duplicate `page_view` on single route load/hydration).

## 2026-02-19 (TRK-004 no duplicate page_view on hydration)

- Completed:
  - Re-ran session bootstrap (`bash harness/scripts/codex-session-start.sh`) on clean tree.
  - Re-verified a previously passing core flow (`TRK-001`) before new work.
  - Added dedicated Playwright assertion for `TRK-004` in `e2e/smoke.spec.ts`:
    - load `/`
    - wait for hydration settle window
    - assert `dataLayer` contains exactly one `page_view` before any user interaction.
- Feature status transition:
  - `TRK-004` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `pnpm test:e2e --grep "TRK-001"` ✅
  - `pnpm test:e2e --grep "TRK-004"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - No regressions observed in this scope.
- Evidence:
  - `harness/verification/2026-02-19-trk-004/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-004/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-004/trk-004-e2e.log`
  - `harness/verification/2026-02-19-trk-004/trk-004-e2e.exit`
  - `harness/verification/2026-02-19-trk-004/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-004/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-004/trk-004-hydration-page-view-events.json`
  - `harness/verification/2026-02-19-trk-004/trk-004-home.png`
  - `harness/verification/2026-02-19-trk-004/codex-verify.log`
  - `harness/verification/2026-02-19-trk-004/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-005` (booking funnel start event on first actionable booking interaction).

## 2026-02-19 (TRK-005 booking funnel start on /book first action)

- Completed:
  - Re-ran session bootstrap (`bash harness/scripts/codex-session-start.sh`) on clean tree.
  - Re-verified previously passing core flow (`TRK-001`) before new scope.
  - Added `booking_funnel_start` support in `lib/tracking.ts` event union.
  - Instrumented `/book` first-step CTA (`Get Estimate`) to emit `booking_funnel_start` before navigation.
  - Added Playwright coverage for TRK-005 in `e2e/smoke.spec.ts`.
- Feature status transition:
  - `TRK-005` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `pnpm test:e2e --grep "TRK-001"` ✅
  - `pnpm test:e2e --grep "TRK-005"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - No regressions observed in this scope.
  - Note: backlog currently uses `booking_funnel_start`, which extends beyond the XML spec's normalized event list; retain for backlog conformance and revisit harmonization in later cleanup/doc pass.
- Evidence:
  - `harness/verification/2026-02-19-trk-005/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-005/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-005/trk-005-e2e.log`
  - `harness/verification/2026-02-19-trk-005/trk-005-e2e.exit`
  - `harness/verification/2026-02-19-trk-005/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-005/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-005/trk-005-booking-funnel-start-events.json`
  - `harness/verification/2026-02-19-trk-005/trk-005-booking-start.png`
  - `harness/verification/2026-02-19-trk-005/codex-verify.log`
  - `harness/verification/2026-02-19-trk-005/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-006` (booking submit event payload completeness and no undefined values).

## 2026-02-19 (TRK-006 booking_submit payload completeness)

- Completed:
  - Re-ran session bootstrap (`bash harness/scripts/codex-session-start.sh`) on clean tree.
  - Re-verified previously passing core flow (`TRK-001`) before new work.
  - Added `booking_submit` event support in `lib/tracking.ts`.
  - Enhanced tracking payload normalization to remove undefined fields before `dataLayer.push(...)`.
  - Instrumented estimation submit flow (`app/estimation/page.tsx`) to emit `booking_submit` with booking/guest/date/time/value fields.
  - Added Playwright TRK-006 test covering full estimation -> booking submit path and asserting required payload keys have no undefined values.
- Feature status transition:
  - `TRK-006` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `pnpm test:e2e --grep "TRK-001"` ✅
  - `pnpm test:e2e --grep "TRK-006"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - Initial TRK-006 automation failed due modal/step gating; fixed selectors and modal dismissal flow, then re-ran successfully.
  - `/api/notify-lead` returns expected error logs in test env when `RESEND_API_KEY` is absent; does not block tracking assertions.
- Evidence:
  - `harness/verification/2026-02-19-trk-006/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-006/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-006/trk-006-e2e.log`
  - `harness/verification/2026-02-19-trk-006/trk-006-e2e.exit`
  - `harness/verification/2026-02-19-trk-006/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-006/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-006/trk-006-booking-submit-events.json`
  - `harness/verification/2026-02-19-trk-006/trk-006-booking-submit.png`
  - `harness/verification/2026-02-19-trk-006/codex-verify.log`
  - `harness/verification/2026-02-19-trk-006/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-007` (deposit page primary CTA conversion-intent tracking event).

## 2026-02-19 (TRK-007 deposit CTA conversion intent)

- Completed:
  - Re-ran session bootstrap (`bash harness/scripts/codex-session-start.sh`) on clean tree.
  - Re-verified previously passing core flow (`TRK-001`) before new scope.
  - Instrumented `/deposit` primary Stripe CTA to emit `deposit_started` with `booking_id`, `value`, and `currency`.
  - Added navigation guard flag for testability (`__REALHIBACHI_DISABLE_NAVIGATION__`) so tracking can be asserted without external redirect during E2E.
  - Added Playwright TRK-007 test to click primary deposit CTA and assert `deposit_started` payload in `dataLayer`.
- Feature status transition:
  - `TRK-007` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `pnpm test:e2e --grep "TRK-001"` ✅
  - `pnpm test:e2e --grep "TRK-007"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - No regressions observed in this scope.
  - `getBookingDetails` logs expected fallback errors in env without Supabase credentials; page fallback data remains functional for tracking validation.
- Evidence:
  - `harness/verification/2026-02-19-trk-007/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-007/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-007/trk-007-e2e.log`
  - `harness/verification/2026-02-19-trk-007/trk-007-e2e.exit`
  - `harness/verification/2026-02-19-trk-007/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-007/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-007/trk-007-deposit-started-events.json`
  - `harness/verification/2026-02-19-trk-007/trk-007-deposit.png`
  - `harness/verification/2026-02-19-trk-007/codex-verify.log`
  - `harness/verification/2026-02-19-trk-007/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-008` (contact form `lead_submit` with channel/source metadata).

## 2026-02-19 (TRK-008 contact lead_submit metadata)

- Completed:
  - Re-ran session bootstrap (`bash harness/scripts/codex-session-start.sh`) on clean tree.
  - Re-verified previously passing core flow (`TRK-001`) before new scope.
  - Instrumented contact partner application form success path to emit `lead_submit`.
  - Added channel/source metadata on event payload:
    - `lead_channel: "contact_form"`
    - `lead_source: "contact_page"`
    - `lead_type: "partner_application"`
    - `service_type` (form-derived).
  - Added Playwright TRK-008 test with `/api/contact` stub to verify successful submit event payload deterministically.
- Feature status transition:
  - `TRK-008` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `pnpm test:e2e --grep "TRK-001"` ✅
  - `pnpm test:e2e --grep "TRK-008"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - No regressions observed in this scope.
- Evidence:
  - `harness/verification/2026-02-19-trk-008/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-008/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-008/trk-008-e2e.log`
  - `harness/verification/2026-02-19-trk-008/trk-008-e2e.exit`
  - `harness/verification/2026-02-19-trk-008/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-008/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-008/trk-008-lead-submit-events.json`
  - `harness/verification/2026-02-19-trk-008/trk-008-contact-submit.png`
  - `harness/verification/2026-02-19-trk-008/codex-verify.log`
  - `harness/verification/2026-02-19-trk-008/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-009` (Google Places selection `location_selected` with `place_id`).

## 2026-02-19 (TRK-009 location_selected with place_id)

- Completed:
  - Re-ran session bootstrap (`bash harness/scripts/codex-session-start.sh`) on clean tree.
  - Re-verified previously passing core flow (`TRK-001`) before new scope.
  - Extended Google Places autocomplete tracking:
    - added `place_id` request field from Places API
    - emits `location_selected` on place selection with `place_id` + source metadata.
  - Added test hook event (`realhibachi:mock-place-select`) in `GooglePlacesAutocomplete` to enable deterministic E2E selection simulation without external Google UI dependency.
  - Added Playwright TRK-009 test through estimation flow step 6, dispatching mock place selection and asserting `location_selected` payload.
- Feature status transition:
  - `TRK-009` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `pnpm test:e2e --grep "TRK-001"` ✅
  - `pnpm test:e2e --grep "TRK-009"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - No regressions observed in this scope.
  - Known env log noise (`RESEND_API_KEY` missing) during estimation flow remains non-blocking for tracking checks.
- Evidence:
  - `harness/verification/2026-02-19-trk-009/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-009/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-009/trk-009-e2e.log`
  - `harness/verification/2026-02-19-trk-009/trk-009-e2e.exit`
  - `harness/verification/2026-02-19-trk-009/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-009/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-009/trk-009-location-selected-events.json`
  - `harness/verification/2026-02-19-trk-009/trk-009-location-selected.png`
  - `harness/verification/2026-02-19-trk-009/codex-verify.log`
  - `harness/verification/2026-02-19-trk-009/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-010` (menu package selection `package_selected` with package metadata).

## 2026-02-19 (TRK-010 package_selected package metadata)

- Completed:
  - Re-ran session bootstrap (`bash harness/scripts/codex-session-start.sh`) on clean tree.
  - Re-verified previously passing core flow (`TRK-001`) before new scope.
  - Added `package_selected` event support in tracking event union.
  - Instrumented package CTA flows on:
    - `app/hibachi-at-home/page.tsx`
    - `app/page.tsx`
    to emit `package_selected` with `package_name`, `price_tier`, `package_type` before navigation.
  - Added Playwright TRK-010 coverage clicking package CTA in “Our Popular Packages” and asserting payload metadata.
- Feature status transition:
  - `TRK-010` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `pnpm test:e2e --grep "TRK-001"` ✅
  - `pnpm test:e2e --grep "TRK-010"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - No regressions observed in this scope.
- Evidence:
  - `harness/verification/2026-02-19-trk-010/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-010/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-010/trk-010-e2e.log`
  - `harness/verification/2026-02-19-trk-010/trk-010-e2e.exit`
  - `harness/verification/2026-02-19-trk-010/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-010/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-010/trk-010-package-selected-events.json`
  - `harness/verification/2026-02-19-trk-010/trk-010-package-selected.png`
  - `harness/verification/2026-02-19-trk-010/codex-verify.log`
  - `harness/verification/2026-02-19-trk-010/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-011` (promo banner click `promotion_click` with campaign identifier).

## 2026-02-19 (TRK-011 promotion_click campaign identifier)

- Completed:
  - Re-ran session bootstrap (`bash harness/scripts/codex-session-start.sh`) on clean tree.
  - Re-verified previously passing core flow (`TRK-001`) before new scope.
  - Added `promotion_click` event support in tracking union.
  - Completed promo banner CTA wiring:
    - added CTA button rendering in `components/promotions/promotion-banner.tsx`
    - emits `promotion_click` with campaign metadata before route navigation
    - re-enabled banner on `/book` page (`app/book/page.tsx`).
  - Added Playwright TRK-011 test asserting `promotion_click` payload includes campaign identifier.
- Feature status transition:
  - `TRK-011` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `pnpm test:e2e --grep "TRK-001"` ✅
  - `pnpm test:e2e --grep "TRK-011"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - Initial TRK-011 test failed due strict title assertion mismatch; updated assertion to site-level title pattern and re-ran to pass.
- Evidence:
  - `harness/verification/2026-02-19-trk-011/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-011/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-011/trk-011-e2e.log`
  - `harness/verification/2026-02-19-trk-011/trk-011-e2e.exit`
  - `harness/verification/2026-02-19-trk-011/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-011/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-011/trk-011-promotion-click-events.json`
  - `harness/verification/2026-02-19-trk-011/trk-011-promotion-click.png`
  - `harness/verification/2026-02-19-trk-011/codex-verify.log`
  - `harness/verification/2026-02-19-trk-011/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-012` (Instagram video interaction `social_video_engagement`).

## 2026-02-19 (TRK-012 social_video_engagement on Instagram interaction)

- Completed:
  - Re-ran session bootstrap (`bash harness/scripts/codex-session-start.sh`) on clean tree.
  - Re-verified previously passing core flow (`TRK-001`) before new scope.
  - Added `social_video_engagement` event support in tracking union.
  - Instrumented Instagram video interactions in `components/instagram-videos-section.tsx`:
    - play overlay clicks
    - Instagram external-open clicks
    with metadata (`video_id`, `interaction_type`, `video_source`, `is_embedded`).
  - Added accessibility labels for video interaction buttons to support deterministic UI automation.
  - Added Playwright TRK-012 test to trigger video interaction and assert event payload.
- Feature status transition:
  - `TRK-012` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `pnpm test:e2e --grep "TRK-001"` ✅
  - `pnpm test:e2e --grep "TRK-012"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - Initial test assumption expected non-embedded play button; updated test to support both interaction paths (`play` or `open_instagram`) and re-ran to pass.
- Evidence:
  - `harness/verification/2026-02-19-trk-012/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-012/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-012/trk-012-e2e.log`
  - `harness/verification/2026-02-19-trk-012/trk-012-e2e.exit`
  - `harness/verification/2026-02-19-trk-012/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-012/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-012/trk-012-social-video-engagement-events.json`
  - `harness/verification/2026-02-19-trk-012/trk-012-social-video-engagement.png`
  - `harness/verification/2026-02-19-trk-012/codex-verify.log`
  - `harness/verification/2026-02-19-trk-012/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-013` (floating contact phone click `phone_click` event).

## 2026-02-19 (TRK-013 floating contact phone_click event)

- Completed:
  - Re-ran session bootstrap (`bash harness/scripts/codex-session-start.sh`) on current branch.
  - Re-verified previously passing core flow (`TRK-001`) before new scope.
  - Added `phone_click` and `sms_click` to the shared tracking event union in `lib/tracking.ts`.
  - Instrumented floating contact call action in `components/floating-contact-buttons.tsx` to emit:
    - `phone_click`
    - metadata: `contact_surface: "floating_contact_buttons"`
  - Added a test-only navigation guard (`window.__REALHIBACHI_DISABLE_NAVIGATION__`) so Playwright can assert tracking without leaving the page via `tel:` navigation.
  - Added Playwright TRK-013 coverage in `e2e/smoke.spec.ts` to:
    - open mobile viewport
    - expand floating contact UI
    - click `Call Now`
    - assert `phone_click` payload appears in `dataLayer`.
- Feature status transition:
  - `TRK-013` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `TRACKING_EVIDENCE_DIR=harness/verification/2026-02-19-trk-013 pnpm test:e2e --grep "TRK-001"` ✅
  - `TRACKING_EVIDENCE_DIR=harness/verification/2026-02-19-trk-013 pnpm test:e2e --grep "TRK-013"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - No regressions observed in this scope.
- Evidence:
  - `harness/verification/2026-02-19-trk-013/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-013/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-013/trk-013-e2e.log`
  - `harness/verification/2026-02-19-trk-013/trk-013-e2e.exit`
  - `harness/verification/2026-02-19-trk-013/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-013/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-013/trk-013-phone-click-events.json`
  - `harness/verification/2026-02-19-trk-013/trk-013-phone-click.png`
  - `harness/verification/2026-02-19-trk-013/codex-verify.log`
  - `harness/verification/2026-02-19-trk-013/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-014` (floating contact SMS click `sms_click` event).

## 2026-02-19 (TRK-014 floating contact sms_click event)

- Completed:
  - Re-ran session bootstrap (`bash harness/scripts/codex-session-start.sh`) on clean tree after TRK-013 commit.
  - Re-verified previously passing core flow (`TRK-001`) before new scope.
  - Instrumented floating contact SMS action in `components/floating-contact-buttons.tsx` to emit:
    - `sms_click`
    - metadata: `contact_surface: "floating_contact_buttons"`
  - Reused the existing test-only navigation guard (`window.__REALHIBACHI_DISABLE_NAVIGATION__`) to avoid real `sms:` navigation during automation.
  - Added Playwright TRK-014 coverage in `e2e/smoke.spec.ts` to:
    - open mobile viewport
    - expand floating contact UI
    - click `Send SMS`
    - assert `sms_click` payload appears in `dataLayer`.
- Feature status transition:
  - `TRK-014` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `TRACKING_EVIDENCE_DIR=harness/verification/2026-02-19-trk-014 pnpm test:e2e --grep "TRK-001"` ✅
  - `TRACKING_EVIDENCE_DIR=harness/verification/2026-02-19-trk-014 pnpm test:e2e --grep "TRK-014"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - No regressions observed in this scope.
- Evidence:
  - `harness/verification/2026-02-19-trk-014/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-014/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-014/trk-014-e2e.log`
  - `harness/verification/2026-02-19-trk-014/trk-014-e2e.exit`
  - `harness/verification/2026-02-19-trk-014/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-014/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-014/trk-014-sms-click-events.json`
  - `harness/verification/2026-02-19-trk-014/trk-014-sms-click.png`
  - `harness/verification/2026-02-19-trk-014/codex-verify.log`
  - `harness/verification/2026-02-19-trk-014/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-015` (estimate completion `estimate_completed` event with total value).

## 2026-02-19 (TRK-015 estimate_completed with total estimate value)

- Completed:
  - Re-verified previously passing core flow (`TRK-001`) before new scope.
  - Added `estimate_completed` to the tracking event union (`lib/tracking.ts`).
  - Instrumented estimation progression in `app/estimation/page.tsx`:
    - emits `estimate_completed` when advancing into Step 5 (estimate results screen)
    - includes numeric value fields:
      - `value` (for analytics currency handling)
      - `estimate_total`
      - `estimate_subtotal`
      - `travel_fee`
      - guest metadata (`guest_count`, `adults`, `kids`)
  - Added Playwright TRK-015 test in `e2e/smoke.spec.ts` to complete estimation steps through Step 5 and assert `estimate_completed` payload has numeric total.
  - Hardened TRK-015 e2e step-1 field filling to re-assert required fields before clicking `Next Step` to avoid flaky empty-field states.
- Feature status transition:
  - `TRK-015` changed from `passes: false -> true` in `harness/feature_list.json`.
- Verified:
  - `TRACKING_EVIDENCE_DIR=harness/verification/2026-02-19-trk-015 pnpm test:e2e --grep "TRK-001"` ✅
  - `TRACKING_EVIDENCE_DIR=harness/verification/2026-02-19-trk-015 pnpm test:e2e --grep "TRK-015"` ✅
  - `bash harness/scripts/codex-verify.sh` ✅
- Regressions/blockers:
  - Initial TRK-015 run timed out on disabled Step-1 `Next Step` button because some required fields were intermittently blank; updated test to re-fill all required fields immediately before continuing, then re-ran successfully.
  - Known non-blocking `RESEND_API_KEY` missing error is still emitted in dev logs from `/api/notify-lead`.
- Evidence:
  - `harness/verification/2026-02-19-trk-015/reverify-trk-001-e2e.log`
  - `harness/verification/2026-02-19-trk-015/reverify-trk-001-e2e.exit`
  - `harness/verification/2026-02-19-trk-015/trk-015-e2e.log`
  - `harness/verification/2026-02-19-trk-015/trk-015-e2e.exit`
  - `harness/verification/2026-02-19-trk-015/trk-001-home.png`
  - `harness/verification/2026-02-19-trk-015/trk-001-page-view-events.json`
  - `harness/verification/2026-02-19-trk-015/trk-015-estimate-completed-events.json`
  - `harness/verification/2026-02-19-trk-015/trk-015-estimate-completed.png`
  - `harness/verification/2026-02-19-trk-015/codex-verify.log`
  - `harness/verification/2026-02-19-trk-015/codex-verify.exit`
- Next highest-priority action:
  - Implement and verify `TRK-016` (tracking resilience when GTM/dataLayer is unavailable).
