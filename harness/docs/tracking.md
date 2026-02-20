# Tracking System Contract (GTM + dataLayer)

Last updated: 2026-02-19
Source spec: `harness/prompts/tracking-improvement-spec.xml`

## 1) Architecture

- App code emits business events through `lib/tracking.ts` only.
- App code **must not** call `window.gtag` directly.
- GTM is the only in-code vendor entrypoint (`NEXT_PUBLIC_GTM_ID`).
- Selected conversion counting path: `GTM_WEBSITE_ONLY`.

## 2) Event Dictionary

| Event | Definition | Primary trigger point | Ads conversion |
| --- | --- | --- | --- |
| `page_view` | Route-level page view in SPA navigation | Tracking bootstrap on initial load + route changes | No |
| `quote_started` | User begins quote builder input | `/quote` first meaningful input | No |
| `quote_completed` | Quote builder shows estimate-ready state | `/quote` after required inputs present and range computed | No |
| `ab_test_exposure` | User is assigned/exposed to experiment variant | Hero experiment assignment | No |
| `ab_test_conversion` | User converts under a specific experiment variant | Hero primary CTA click | No |
| `lead_start` | User starts booking/lead intent | Primary booking CTA before navigation | No |
| `lead_submit` | User submits lead/contact form | Contact form successful submit path | Yes |
| `booking_funnel_start` | User enters estimation from booking page | `/book` Get Estimate CTA | No |
| `estimate_completed` | User reaches estimate result step | Estimation step transition into Step 5 | No |
| `booking_submit` | User submits booking details | Estimation order submission | Yes (import-eligible) |
| `location_selected` | Address/place selected from autocomplete | Google Places selection callback | No |
| `package_selected` | User chooses package CTA | Home / Hibachi-at-home package cards | No |
| `promotion_click` | User clicks promo banner CTA | Promotion banner button on booking funnel page | No |
| `social_video_engagement` | User interacts with Instagram videos | Play/open interactions in Instagram section | No |
| `phone_click` | User taps floating phone CTA | Floating contact: `Call Now` | No |
| `sms_click` | User taps floating SMS CTA | Floating contact: `Send SMS` | No |
| `contact_whatsapp_click` | User clicks WhatsApp CTA | Home/Hibachi contact row | No |
| `contact_sms_click` | User clicks SMS CTA | Home/Hibachi contact row | No |
| `contact_call_click` | User clicks call CTA | Home/Hibachi contact row | No |
| `menu_view` | User opens menu intent | Home/Hibachi “View Menu” action | No |
| `faq_view` | User opens FAQ intent | Home/Hibachi “FAQ” action | No |
| `deposit_started` | Deposit initiation intent | Deposit page Stripe CTA click | No |
| `deposit_completed` | Confirmed deposit success | Server-confirmed payment success callback | Yes (dedup by `transaction_id`) |

### Event naming convention

- Required format: `snake_case`.
- Domain-style prefixes are used where meaningful (`contact_*`).
- CTA interaction suffixes should remain verb-first and stable (`*_click`, `*_view`, `*_submit`, `*_started`, `*_completed`).

## 3) Parameter Schema

### Required base fields (all events)

- `event` (string)
- `page_path` (string)
- `page_title` (string)

### Attribution fields (optional)

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- `gclid`, `wbraid`, `gbraid`

### Conversion/value fields

- `value` (number, optional)
- `currency` (string, optional; default `USD` when `value` exists)
- `transaction_id` (string, **required for `deposit_completed`**)
- `event_id` (string, recommended)
- `debug_mode` (boolean, optional)

## 4) Attribution Persistence

- Capture on first landing from query params.
- Keys: `utm_*`, `gclid`, `wbraid`, `gbraid`.
- Preferred storage: cookie `realhibachi_attribution`.
- Fallback storage: `localStorage`.
- TTL: 90 days.

## 5) GTM Mapping (Container: `GTM-WQZNBK82`)

### Variables

- Data Layer Variables for every contract field above.

### Triggers

- Custom Event triggers named exactly as the event dictionary entries above.
- Minimum required GTM triggers for conversion-critical flows:
  - `lead_submit`
  - `booking_submit` (if mapped to Ads/GA4 conversion path)
  - `deposit_started`
  - `deposit_completed`

### Tags

- GA4 Configuration tag: all pages.
- GA4 Event tags: one per custom event trigger above.
- Google Ads conversion tags (only for `GTM_WEBSITE_ONLY`):
  - `lead_submit` conversion action
  - `deposit_completed` conversion action with `transaction_id` dedup

## 6) Ads Conversion Mapping (single counting path rule)

- Allowed values: `GA4_IMPORT_ONLY` or `GTM_WEBSITE_ONLY`.
- Current selected value: `GTM_WEBSITE_ONLY`.
- Guardrail:
  - If using `GTM_WEBSITE_ONLY`, disable GA4-imported Ads conversions.
  - If switching to `GA4_IMPORT_ONLY`, disable Ads conversion tags in GTM.

## 7) QA Checklist & Evidence

For each release/session, store artifacts under `verification/<date>/`:

1. GTM Preview screenshots showing trigger -> tag mapping.
2. GA4 DebugView screenshots for all required event parameters.
3. Ads conversion diagnostics screenshots (no duplicate conversions).
4. dataLayer console logs for:
   - home CTA
   - estimate flow
   - deposit flow
   - phone/sms/whatsapp CTA
5. Dedup proof: repeated callback/refresh does not duplicate `deposit_completed`.
6. Attribution proof: landing UTM/click IDs persist into subsequent events.

## 8) Naming Audit Procedure (TRK-020)

- Audit script: `harness/scripts/audit-tracking-event-names.mjs`
- Command:

  ```bash
  node harness/scripts/audit-tracking-event-names.mjs --output harness/verification/<date>/trk-020-event-name-audit.json
  ```

- Pass criteria:
  - no emitted event names outside `TrackingEventName` union
  - no non-`snake_case` event names
  - mismatches or planned exceptions must be documented in `harness/codex-progress.md`
