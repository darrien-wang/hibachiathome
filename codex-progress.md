# Real Hibachi Codex Progress

Updated: 2026-06-02

## DATA-001 - Clean GA4 Primary Booking Conversion Tracking

Status: completed and verified.

What changed:
- Added server-side GA4 Measurement Protocol fallback for `booking_submit` in `app/api/booking-request/route.ts`.
- Added `trackBookingSubmitServer` in `lib/ga4-measurement-protocol.ts`.
- Passed the same frontend `bookingEventId` into the booking request API, so client-side and server-side `booking_submit` share one dedupe key.
- Removed active `lead_submit` tracking from quote SMS, call, and email clicks.
- Removed active `lead_submit` tracking from live chat. Live chat keeps the more specific `chat_lead_submitted` event.
- Changed contact booking inquiry form tracking from `lead_submit` to `contact_booking_inquiry_submit`.
- Removed `customer_name` from quote contact click tracking payloads.
- Removed `customer_name` and `customer_email` from the post-booking deposit link query string to reduce GA4 page path PII risk.

Why this matters:
- Google Ads should optimize toward the real booking request signal, not a mixed legacy lead event.
- GA4 should receive a cleaner primary event with booking context such as source page, city or ZIP, guest count, quote tier, estimated value, and event time.
- Server-side fallback reduces the chance that ad blockers, browser issues, or GTM misconfiguration lose the most important conversion.

Verification completed:
- Code search confirmed there are no active `trackEvent("lead_submit")` calls in `app`, `components`, or `lib`.
- Code search confirmed `lead_submit` is removed from the client tracking event union.
- Targeted ESLint passed for the modified tracking, booking API, quote, live chat, contact, and tracking type files.
- `git diff --check` passed.
- `growth-task-list.json` parses successfully and was updated with the DATA-001 status.
- Vercel production environment for `realhibachi-marketing` now has `GA4_MEASUREMENT_ID` and `GA4_MP_API_SECRET` configured.
- Production deployment `dpl_8CUq9xhv5ZJH7HTNoYzLhzPb3cxy` completed successfully.
- Production aliases for the deployed project include `www.realhibachi.com` and `realhibachi.com`.
- Controlled production booking request returned `success=true`.
- Controlled production booking request returned `serverTracking.bookingSubmit.delivered=true` with GA4 Measurement Protocol status `204`.
- GA4 Realtime Data API returned `booking_submit` with event count `1`.
- Production `www.realhibachi.com` quote bundle contains `booking_submit` and no `lead_submit`.
- GA4 Admin API confirmed `booking_submit` and `deposit_completed` are Key Events.
- GA4 Admin API also confirmed legacy `lead_submit` is still listed as a Key Event.
- Google Ads API confirmed `LA Search - Clean Leads` is paused, budget is $80/day, and bidding strategy is Maximize Conversions.
- Google Ads API confirmed `LA Search - Clean Leads` campaign-level goals bid on `DEFAULT / WEBSITE` and do not bid on `SUBMIT_LEAD_FORM / WEBSITE`.
- Google Ads API confirmed `gothic-standard-378909 (web) booking_submit` is enabled and primary.
- Google Ads API confirmed `gothic-standard-378909 (web) lead_submit` is hidden and secondary.
- Changed old Google Ads conversion action `conversion_event_submit_lead_form_1` from primary to secondary; verification confirmed it is no longer included in conversions.
- Google Ads API reported the serving account time zone as `America/Chicago`.
- Exchanged the GA4 `analytics.edit` OAuth authorization code.
- Removed legacy `lead_submit` from GA4 Key Events through the Analytics Admin API.
- GA4 Admin API verification confirmed `lead_submit` is no longer a Key Event, while `booking_submit` and `deposit_completed` remain Key Events.
- Refreshed the Google Ads OAuth token after the GA4 consent flow rotated the old token.
- Verified the `LA Search - Clean Leads` ad schedule in the `America/Chicago` serving account.
- Confirmed Saturday is scheduled for Chicago 11:00-14:00, equivalent to Los Angeles 09:00-12:00 during daylight saving time, so Saturday afternoon and evening are paused as intended.
- Updated the daily Ads report automation to explicitly interpret Google Ads dayparts in `America/Los_Angeles` while reading the serving account data in `America/Chicago`.

Verification blocked or still needed:
- Full `tsc --noEmit` is blocked by pre-existing syntax errors in `examples/instagram-carousel-example.tsx`.
- Continue using the existing `America/Chicago` serving account. Treat Los Angeles time as the business interpretation layer for ad schedule and reporting.

## DATA-002 - Conversion Attribution Gaps

Status: implemented and realtime verified; waiting for GA4 standard report refresh.

What changed:
- Hardened server-side `booking_submit` Measurement Protocol attribution.
- Booking request API now reads the browser `_ga` cookie for GA client ID when available.
- Booking request API now reads `_ga_9852R0HD0R` for GA session ID when available.
- Server-side `booking_submit` now sends `page_location`, `page_referrer`, `source_page`, UTM fields, `gclid`, `wbraid`, and `gbraid` where available.
- Quote flow now sends `document.referrer` as `pageReferrer` in the booking request payload.
- Daily Ads report automation now flags GA4 `booking_submit` and `deposit_completed` rows where landing page or page path is `(not set)`.

Verification completed:
- Targeted ESLint passed for `lib/ga4-measurement-protocol.ts`, `app/api/booking-request/route.ts`, and `app/quote/QuoteBuilderClient.tsx`.
- `git diff --check` passed.
- Production deployment `3dU4FNh3S625wUQW8yckp6FkjB2y` completed successfully.
- Controlled production booking request with GA cookies, UTM attribution cookie, referer, and page referrer returned `serverTracking.bookingSubmit.delivered=true` with status `204`.
- GA4 Realtime Data API returned `booking_submit` with event count `1` after the DATA-002 test.

Verification still needed:
- GA4 standard reports did not yet return `booking_submit` or `deposit_completed` rows for the last 30 days immediately after the change.
- Recheck standard GA4 source/medium plus landing-page report after report processing catches up.
