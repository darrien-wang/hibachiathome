# Tracking System Contract (GTM + dataLayer)

Last updated: 2026-02-18
Source spec: `harness/prompts/tracking-improvement-spec.xml`

## 1) Architecture

- App code emits business events through `lib/tracking.ts` only.
- App code **must not** call `window.gtag` directly.
- GTM is the only in-code vendor entrypoint (`NEXT_PUBLIC_GTM_ID`).
- Selected conversion counting path: `GTM_WEBSITE_ONLY`.

## 2) Event Dictionary

| Event | Definition | Trigger point | Ads conversion |
| --- | --- | --- | --- |
| `lead_start` | User starts lead/booking intent | Primary booking CTA intent before navigation | No |
| `lead_submit` | User submits lead/contact form | Successful form submit callback | Yes |
| `contact_whatsapp_click` | WhatsApp contact intent | WhatsApp CTA click before navigation | No |
| `contact_sms_click` | SMS contact intent | SMS CTA click before navigation | No |
| `contact_call_click` | Call contact intent | Phone CTA click before navigation | No |
| `menu_view` | User opens menu intent | Menu CTA click/open action | No |
| `faq_view` | User opens FAQ intent | FAQ CTA click/open action | No |
| `deposit_started` | Deposit initiation | Deposit flow starts with amount known | No |
| `deposit_completed` | Confirmed deposit success | Server-confirmed payment success | Yes (dedup by `transaction_id`) |

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

- Custom Event triggers named exactly:
  - `lead_start`
  - `lead_submit`
  - `contact_whatsapp_click`
  - `contact_sms_click`
  - `contact_call_click`
  - `menu_view`
  - `faq_view`
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
