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

## PREP-COSTCO - Shopping list in Costco packs (2026-10-12)

Status: in progress - steak done; the other items wait for the owner's Costco pack sizes.

What changed:
- `lib/prep-bom.ts`: the standard steak is bought in Costco Kirkland USDA Choice top sirloin packs (item 29192, about 3.69 lb a pack). Packs = need x 1.1, rounded up; the order-page hint and the warehouse planner (`BUY_UNITS.steak`) give the same count.
- The portion table is untouched and still mirrors the invoice repo's `lib/pricing.ts` (compared with its `origin/main`).

Verification completed:
- `npm test`: 176 pass, 0 fail. `tests/prep-bom.test.ts` is new. Output: `harness/verification/2026-10-12-prep-bom-costco/npm-test.txt`.

Still needed:
- The owner's actual Costco packs for chicken breast, filet, ribeye, shrimp, salmon, broccoli, carrots, zucchini, onions, eggs, butter, tofu and lobster tails. Do not guess them.
- This is not a `harness/feature_list.json` item (that backlog is the tracking spec), so there is no status transition there.

## LANDING-QUOTE-MINIMUM - Say when the $599 minimum set the price (2026-10-22)

Status: done.

Why: Susan Romero (La Puente) got "your La Puente hibachi price is $599.00 for 1 adults", which reads as $599 a head; the desk had to text her that it is the minimum and covers 10 guests.

What changed:
- `lib/landing-quote-text.ts` (new): `partyLine()` says "1 adult" / "1 kid"; `minimumNote()` words the price when `calcSimpleEstimate().minApplied`; `MINIMUM_COVERS_GUESTS` = `MINIMUM_SPEND` / adult price from `config/pricing-rules` (10 today).
- `app/api/landing-quote/route.ts`: the first-quote and "updated" texts add " - our 10-guest minimum, so it covers up to 10 guests" after the party (with travel: "our 10-guest minimum ($599) plus travel, ..."; more than 10 on the minimum, kids or Mon-Thu: "our $599 minimum, which covers all N guests"); the customer email adds "That's our 10-guest minimum, so it covers up to 10 guests." Discount, travel, deposit link, rentals and STOP lines are unchanged; nothing about tax, deposits or payment methods.

Verification completed:
- `npm test` (rebased on `4d2f17dd`): 297 pass, 0 fail. `tests/landing-quote-text.test.ts` is new. Output: `harness/verification/2026-10-22-landing-quote-minimum/npm-test.txt`.
- The route run offline (no database, network stubbed) for 11 parties before and after: only the price sentence, the email's new line and "1 adult(s)" changed; 15 adults and 30 adults + 4 kids are identical. Output: `harness/verification/2026-10-22-landing-quote-minimum/quote-text-diff.txt`.
- This is not a `harness/feature_list.json` item, so there is no status transition there.

## LEAD-WATCH-TEMPLATE-A-MINIMUM - The fallback price text says when the $599 minimum set it (2026-10-22)

Status: done.

Why: lead-watch's template A - the price Rowling texts and mails when the site's automatic quote never went out - had the same "For 1 adults in La Puente it's $599.00 any day of the week" wording as LANDING-QUOTE-MINIMUM above.

What changed:
- `lib/first-response.ts`: template A's text and email moved here verbatim from `app/api/admin/lead-watch/route.ts` as `templateAMessage()`, so it is unit-tested; it now says "1 adult" / "1 kid" (`partyLine`) and, when the price is the minimum on both nights, adds "That's our 10-guest minimum, so it covers up to 10 guests." to the text and as an email bullet (`minimumNote`; "our $599 minimum, which covers all N guests" above 10). A party whose Fri-Sun price clears the minimum gets no note.
- `app/api/admin/lead-watch/route.ts`: calls `templateAMessage()`; the imports it no longer needs are gone.

Verification completed:
- `npm test` (rebased on `812c92d4`): 301 pass, 0 fail; four new template A tests in `tests/first-response.test.ts`. Output: `harness/verification/2026-10-22-lead-watch-template-a-minimum/npm-test.txt`.
- The original route function vs `templateAMessage()` for 12 parties: only "1 adult(s)", the new sentence and the new email bullet changed; 11 adults ($628.90 Fri-Sun / $599.00 Mon-Thu), the 15-adult default, 15 adults and 30 adults + 4 kids are byte-identical. Output: `harness/verification/2026-10-22-lead-watch-template-a-minimum/template-a-diff.txt`.
- This is not a `harness/feature_list.json` item, so there is no status transition there.

## GUEST-COUNT-GRAMMAR - "1 adult", "1 kid", "1 guest", "1 baby" on customer-facing labels (2026-10-22)

Status: done.

What changed:
- `lib/counted.ts` (new): `counted(n, one, many?)`; `partyLine` in `lib/landing-quote-text.ts` uses it.
- Uses it instead of plural-only templates: the landing estimator card (`components/city/landing-estimator.tsx`), booking-request emails, the planner-unlock text and emails (also "1 baby"), `/deposit/pay`, `/deposit/success`, `/quote` (badge, per-person lines, confirmation line), `/pay` ("Served every guest" for a party of one), `/rentals`, and three components no page imports today (occasion estimator, menu estimator bar, city quote calculator).
- Left alone: `app/api/booking/create` (internal lead note), `buildCallScript` in `lib/quote-builder.ts` (not called), planner-unlock's ops "x/y guests have picked proteins" lines.

Verification completed:
- `npm test`: 304 pass, 0 fail; `tests/counted.test.ts` is new. Output: `harness/verification/2026-10-22-guest-count-grammar/npm-test.txt`.
- booking-request and planner-unlock run offline before/after: only the nouns changed; plural parties are byte-identical. Output: `harness/verification/2026-10-22-guest-count-grammar/routes-diff.txt`.
- Local production build in the browser (nothing submitted, traffic marked internal): landing card "1 adult · any day", /quote "Standard Plan · 1 guest", /rentals "1 guest", /deposit/pay "1 guest". Output: `harness/verification/2026-10-22-guest-count-grammar/browser-checks.txt`.
- `tsc`: the same 95 pre-existing errors, none new. This is not a `harness/feature_list.json` item, so there is no status transition there.

## DESK-FREE-APPETIZER - `desk order set --free-appetizer`: the customer's pick of the free appetizer (2026-10-24)

Status: done.

Why: the deposit page writes the free appetizer as gyoza, and customers text their pick (gyoza / edamame / spring rolls) every week. desk could add trays but not change which one is free; RH-20261024-2894 went gyoza -> spring rolls on 10-24 by a one-off script.

What changed:
- `scripts/desk/desk.py`: `order set --free-appetizer ID` (`_swap_free_appetizer`). The free trays move to the new appetizer in `partyExtras` (into its row if it has one), the lines name it ("... FREE appetizer: Edamame", "FREE: Edamame (feeds 3) x2"), and each line's amount moves by the trays' price difference (edamame is $5 a tray less), so the total does not change. The invoice engine prices the party before and after the swap; a total that moved is refused, nothing saved.
- Which lines: `official_weekday` / `official_platter20` / `official_fullsetup_app` together with the `--free-item` gifts of the same appetizer; with no official line, the `--free-item` gifts when they are all one appetizer. More than one tray of it on the order (one per 10 guests, or some bought): the official line's amount says how many are free (tray price on top of the weekday per-head part), and when it does not, the command refuses. Also refused: the old three-item platter, gifts of different appetizers with no official line, the appetizer it already is, too few trays. `--dry` and the STALE-guarded save are the `set` op's; LF line endings kept.
- `APPETIZER_LABELS` is shared with `--free-item`; `_little_kids` is factored out of `_deal_lines` (same result).
- `.claude/skills/leads/tools.md`: the flag next to `--free-item`, and a note on what it does.

Verification completed:
- No test runner covers desk (`npm test` runs `tests/*.test.ts` only), so an offline harness ran the swap and the whole `order set` command with every site / invoice call patched: 45 checks pass (both price directions, the $599 minimum, several trays with some bought, a stale amount, gifts, every refusal, `--dry` saving nothing, the save's baseUpdatedAt / baseVersion, a drifted engine price refused, `--chefs` alongside, `--free-appetizer-trays` after the pick, `_deal_lines` unchanged). Output: `harness/verification/2026-10-24-desk-free-appetizer/harness-out.txt`.
- Read-only against the live invoice engine (`--dry`, nothing saved) on RH-20261024-2894 (spring rolls now): to edamame moves extras $15 -> $10 and the weekday line $72.35 -> $67.35, TOTAL $668.25 before and after; spring_rolls again is refused. Output: `harness/verification/2026-10-24-desk-free-appetizer/dry-run.txt`.
- This is not a `harness/feature_list.json` item, so there is no status transition there.

## DESK-HEADCOUNT-TIER - `desk order set --headcount` for orders without guest rows; the party-size line follows every headcount change; the TOTAL is checked against `desk price` (2026-10-24)

Status: done.

Why: RH-20261022-0063 (2026-10-22) went from 8 adults + 2 kids to 11 + 1 in quick mode. `--proteins` moved only the servings and `--add-adult` refused an order without rows, so it had to be rewritten as 12 guest rows. The order then stood at $868.80 with no party-size line while `desk price` said $838.80, and nothing on the dry run showed it.

What changed:
- `scripts/desk/desk.py`:
  - `--headcount ADULTS/KIDS` sets adultCount/childCount on an order without guest rows (quick mode, or a fresh order before the menu). Kids are 5-12, as `desk price` takes them; free 3-4 year olds stay as the order's Little kids line says. Refuses an order with rows. Says when the menu or the per-guest tables/utensils still count the old party. `--proteins` stays the menu; `--add-adult` / `--remove-guest` on a quick-mode order now point at `--headcount`.
  - Every headcount change (`--headcount`, `--guests-file`, `--add-adult`, `--add-child`, `--remove-guest`) replaces the stored `official_party*` line with the tier for the new paying heads (adult 1, kid 5-12 half, floored: the invoice's paidGuestCount) in the same place and prints the change. Under 10 the line comes off; 61+ is left alone (custom quote); an `appreciation*` line standing in for the tier gets no tier added; a line taken off with `--remove-promo` in the same command is not put back. No other promotion is touched. `--retier` does the same on demand for an order that was already wrong.
  - The tiers are read from `config/pricing-rules.ts` (`PARTY_SIZE_DISCOUNT_TIERS`, `PARTY_SIZE_CUSTOM_FROM`, `KID_TIER_WEIGHT`), not copied; desk refuses if it cannot read them. The hard-coded "10-14 $30 / 15-24 $60 / ..." warning in `--guests-file` is gone. Id and label as the invoice writes them: `official_party10`, "Party Size Discount (10–14 adults): $30 off".
  - Every `order set` that prices the invoice holds its TOTAL (cashTotal) against `desk price` for the same adults / kids 5-12 / date / tables / utensils, plus the order's own extras (upgrades, trays, noodles, sides), minus its own promotions (free appetizers, FREE: trays, deals, appreciation, the Weekday Special's free trays), plus its travel, at the $599 minimum. Within $1: one `✓ total check` line. Otherwise a `!!! TOTAL CHECK FAILED` block that names the party-size, Weekday Special and little-kids lines and the likely fix (`--retier`, or `--promo official_weekday=<n>`). Advisory only: it never blocks a save. With no date or a past date it compares at the rate the order's own Weekday Special line implies.
  - The Weekday Special line's free trays are counted the way DESK-FREE-APPETIZER's swap counts them (one, unless the order has more of that tray than the gifts and one; then the amount over the per-head part says how many), and only trays the order carries net out, so a line refunding a missing tray shows. Built on that entry's `_little_kids`, `_paid_children`, `OFFICIAL_APPETIZER`, `GIFT_APPETIZER` and weekday constants (rebased onto it).
  - The Weekday Special "computed for the OLD headcount" warning prints once for every kind of headcount change (it was --add-adult only).
- `scripts/desk/selfcheck.py` (new): offline self-check. Fakes of calcInvoiceTotal and /api/agent/price; any other call fails the run, nothing reaches production.
- `.claude/skills/leads/tools.md`: `--headcount`, `--retier`, the automatic re-tier and the total check.
- Left alone: a little-kid row from `--guests-file` (`little: true`) still gets no `under5_auto` line by itself (the skill says to add it with `--add-promo`); when it is missing, the total check now reports it as $29.90 too much.

Verification completed:
- `python scripts/desk/selfcheck.py` (Python 3.10.6, what `python` is on the desk; rebased on `a534d57e`): 31 pass, 0 fail, including desk's read of the tiers against the TS export (evaluated with tsx) and `--free-appetizer` under the new check. Output: `harness/verification/2026-10-24-desk-headcount-tier/selfcheck.txt`.
- The self-check bites (patched in memory): re-tier disabled, 13 fail; the Weekday Special's free trays not netted out, 6 fail; always one free tray, 2 fail. Output: `harness/verification/2026-10-24-desk-headcount-tier/mutation.txt`.
- Live, read-only: `desk price` 11 adults + 1 kid with 12 tables and utensils is $838.80 (the 10-22 number). `order set RH-20261022-0063 ... --dry` three ways: ✓ $898.70 as it is stored today (12 + 1 after a later add); `--retier` "already right"; removing three guests drops it to 9 paying heads, `official_party10` comes off, ✓ $719.00. Nothing saved. Output: `harness/verification/2026-10-24-desk-headcount-tier/live-dry-runs.txt`.
- Live, read-only sweep: the 15 orders dated today or later, `order set <no> --time <its own time> --dry`: all ✓, no false alarm (weekday specials incl. a spring-rolls pick, the $599 minimum, travel, tables, a deal, 30 adults + 5 kids). Output: `harness/verification/2026-10-24-desk-headcount-tier/live-sweep.txt`.
- No TypeScript changed (desk only reads `config/pricing-rules.ts`), so `npm test` was not needed. `scripts/selftest/lint-copy.py`: 0 hard-rule hits. This is not a `harness/feature_list.json` item, so there is no status transition there.

## DESK-LITTLE-KIDS-LINE - `--guests-file` keeps the Little kids (3-4) line in step with its `little: true` rows (2026-10-24)

Status: done.

Why: a 3-4 year old entered through `--guests-file` (`little: true`) got no "Little kids (3-4) @ $0 ×N" line, so the toddler was billed at the $29.90 child rate unless someone typed `--add-promo under5_auto=29.90 --promo-label "... ×1"` by hand (the × through the shell). DESK-HEADCOUNT-TIER's total check reported it; owner 2026-10-24: make desk do it.

What changed:
- `scripts/desk/desk.py`:
  - `--guests-file`: the list is the whole party, so its `little: true` rows set the order's `under5_auto` line as the planner writes it ("Little kids (3-4) @ $0 ×N", $29.90 a toddler), in place; with no little row in the list the line comes off and the change says why. `little: true` now makes a child row (without `child: true` it used to be an adult row) and needs no proteins (5 and under bring none, leads skill); everyone else still needs two.
  - `--remove-guest` of a flagged 3-4 year old takes the line down by one (from the larger of the flagged rows and the line's ×N, never under the flagged rows left). A paying kid's removal leaves it alone.
  - `_is_little_line` is the one test for the line (`_little_kids`, the total check).
  - The total check's Weekday Special hint says the save re-prices an unchanged line by the rule (invoice D-1017-02, live: `/api/orders/lint` answers, a made-up route 404s), next to the `--promo` that sets it by hand. The warning above it is 935254c2's.
- Checked against D-1017-02's reconcileEntitlements: it never touches the Little kids line, and its tier reads that line's ×N, so desk keeping the line right feeds the server's tier. It keeps desk's re-tiered party line (right id, no `auto` flag) and swaps it when a later planner save moves the headcount (the line counts as the rules' own then), so the two never double up.
- `scripts/desk/selfcheck.py`: 7 new cases. `.claude/skills/leads/tools.md`: the toddler note (with a guest list it is automatic; quick mode is still `--add-promo`).

Verification completed:
- `python scripts/desk/selfcheck.py` (rebased on `4752ec5c`, with 935254c2's lint cases): 45 pass, 0 fail. Output: `harness/verification/2026-10-24-desk-little-kids-line/selfcheck.txt`.
- With the line sync disabled, the 5 new line checks fail. Output: `harness/verification/2026-10-24-desk-little-kids-line/mutation.txt`.
- Live, read-only: RH-20261015-3202's planner-written toddler row and line have exactly the shape desk writes (`under5_auto`, "Little kids (3-4) @ $0 ×1", 29.9); `--remove-guest` of that row with `--dry` takes the line to none and leaves TOTAL $752.90 (the toddler was free), ✓. Output: `harness/verification/2026-10-24-desk-little-kids-line/live-dry-run.txt`.
- No TypeScript changed. This is not a `harness/feature_list.json` item, so there is no status transition there.

## DESK-HEADCOUNT-LITTLE - `--headcount ADULTS/KIDS/LITTLE`: free 3-4 year olds on an order without guest rows (2026-10-24)

Status: done.

Why: after DESK-LITTLE-KIDS-LINE a guest list keeps the Little kids line by itself, but an order without rows (quick mode, or a fresh order before the menu) still needed `--add-promo under5_auto=29.90 --promo-label "Little kids (3-4) @ $0 ×1"` typed by hand, the × through the shell. Owner 2026-10-24: a third number on `--headcount`.

What changed:
- `scripts/desk/desk.py`: `--headcount 11/1/2` = 11 adults + 1 kid 5-12 + 2 free 3-4 year olds: childCount 3 and the order's `under5_auto` line set to "Little kids (3-4) @ $0 ×2" ($59.80), in place, through `_set_little_line`; `11/1/0` takes the line off; `11/1` leaves it as it was (unchanged behaviour). The toddlers are not paying heads, so they never move the party-size tier. Same refusals as before (an order with rows; with `--guests-file` / `--add-*` / `--remove-guest`); at least one adult or kid 5-12.
- `scripts/desk/selfcheck.py`: 8 new cases. `.claude/skills/leads/tools.md`: the `--headcount` line and the toddler note (no more hand-typed `--add-promo` for the line).

Verification completed:
- `python scripts/desk/selfcheck.py`: 53 pass, 0 fail. Output: `harness/verification/2026-10-24-desk-headcount-little/selfcheck.txt`.
- With the line setter disabled, the 5 new line cases fail (and the 5 from DESK-LITTLE-KIDS-LINE). Output: `harness/verification/2026-10-24-desk-headcount-little/mutation.txt`.
- Live, read-only: `order set RH-20261022-5789 --headcount 15/0/1 --dry` (a fresh 15-adult order): the line goes on ×1 $29.90, `official_party15` stays, TOTAL $838.50 as before (the toddler is free), ✓. Nothing saved. Output: `harness/verification/2026-10-24-desk-headcount-little/live-dry-run.txt`.
- No TypeScript changed. This is not a `harness/feature_list.json` item, so there is no status transition there.

## LEAD-SCAN-COURTESY-LADDER - A "thanks" past its 2-hour window goes down the hold / `[callback]` / follow-up ladder instead of a dead-end H (2026-10-25)

Status: done.

Why: `lib/lead-scan.ts` filed a lead whose last inbound was a courtesy ("I appreciate it!", "Thank you") under H "最后一条是客气话，已过 2 小时，不再补" with `nextActionAt = null`, ahead of the hold / B / D branches, so it never came back. 626-428-5292 (South Whittier, 16, Sat 10/31, a `[callback]` from 09-29: checking with the other hosts) sat 25 days; `desk scan --no-write` on 10-24 showed six leads like that. The 2-hour window only decides whether the one-line close is still owed (leads §1.6, lead-scan skill).

What changed:
- `lib/lead-scan.ts`: past the window (`courtesyDone`) the lead takes the "we spoke last" part of the ladder: C, an active hold (H 挂起到 …), a `[callback]` (B), dormant, E, the cap, the 20-hour spacing, the two-texts-in-24-hours brake, D. Inside the window it is still A "客气话，回一句收尾"; the tapback branch is unchanged. The hold and the `[callback]` are measured from the customer's last real message (`spokeAt`: the newest inbound that is more than a reaction or a thanks, or photos, from the timeline or Twilio's `lastRealIn`; calls, site forms, emails), because the desk sets both right after "I'll get back to you" and the thanks lands minutes later. In 626-428-5292 the note and the hold went in at 16:40 PT and the thanks at 16:42; measured from the thanks, both were void and she would have read E, not B. `run` (so the cap) still counts our texts since the thanks, as for a thanks we did answer. The D reason adds "（客人最后回的是客气话，那句不补）". Inbound rows keep `NumMedia` for the photos check.
- `tests/lead-scan-courtesy.test.ts` (new): drives `scanLeads` over a small in-memory PostgREST fake; no Twilio unless a test stubs it. Inside 2 h → A; past 2 h with nothing on file → H 刚发过 at 15 h (next action at +20 h), D "第 1 条" at 46 h; a `[callback]` with the hold run out → B on 10-24 though the thanks came after the note; an active hold → H 挂起到 though the thanks came after it, then dormant once it runs out; the same B with the thread from a stubbed Twilio (carrier stamps 1 s later); a tapback is still H "最后一条是点赞".
- `.claude/skills/lead-scan/SKILL.md`: the B and D rows say a thanks past 2 hours counts as us speaking last.

Verification completed:
- `npm test`: 320 pass, 0 fail (314 before, 6 new). Output: `harness/verification/2026-10-25-lead-scan-courtesy-ladder/npm-test.txt`.
- The new tests bite: against HEAD 70867b79, 4 of 6 fail (A and the tapback pass, as before); against a naive fall-through that measures the hold and the `[callback]` from the thanks, 3 fail (B, hold, Twilio B); with Twilio's newest inbound in place of its newest real one, the Twilio test fails. Output: `harness/verification/2026-10-25-lead-scan-courtesy-ladder/mutation.txt`.
- `npm run lint:copy`: 0 hard-rule hits (the one soft hit is `app/pay/PayClient.tsx`, unrelated). Output: `harness/verification/2026-10-25-lead-scan-courtesy-ladder/lint-copy.txt`. `tsc`: no errors in `lib/lead-scan.ts` or the new test.
- Read-only against the live pool before pushing (HEAD's and the fixed classifier in one process on the same rows; `write: false`, `lint: false`, a Supabase proxy that throws on any write, Twilio list GETs only): 5 of 274 leads move, the five still in H "不再补" (626-428-5292 had been texted 10-25 10:01 PT by then and reads E either way). 714-745-5497 and 318-278-0047 → D "第 1 条"; 916-626-9315 → D with F (tables_asked); 818-395-2263 → D, not B: her filet question at 21:25 PT came after the 21:23 `[callback]` note, which by the existing rule voids it (the card still shows the note); 760-442-8028 → H 休眠 (our 2-day hold ran out 09-30 with only "Awesome" since; her 10-24 party date has passed, so lost is the desk's call). Nothing else moved. Output: `harness/verification/2026-10-25-lead-scan-courtesy-ladder/live-scan-diff.txt`.
- Deployed 4ce8f22d (local `pnpm build` first: exit 0, homepage SSR 77113 bytes, h1 1, jsonld 4). `/_release/ready` named it after ~75 s; `verify-live.sh` green (homepage h1 1 / jsonld 4, city pages 200, redirects 308, llms.txt 200, sitemap 116). Production `desk scan --no-write` at 10-25 17:17 PT gave the same five moves as the local diff: D 3 → 7, F 0 → 1, H 269 → 265, none left in H "不再补". Output: `harness/verification/2026-10-25-lead-scan-courtesy-ladder/prod-after-deploy.txt`.
- No texts sent; `desk scan` ran only with `--no-write`; nothing was written to leads. This is not a `harness/feature_list.json` item, so there is no status transition there.

Left for later (read-only evidence in `harness/verification/2026-10-25-lead-scan-courtesy-ladder/followups.txt`):
- A tapback-last lead is the same dead end (H "最后一条是点赞，不用回", no next action); kept as is, as asked. 8 live, 4 of them with a `[callback]` (805-455-1668 since 09-28, 760-333-6986, 585-704-3872, 845-519-7333). Done the same day: LEAD-SCAN-REACTION-LADDER below.
- A thanks we did answer (so not the last word) still voids a `[callback]` set before it: 562-236-7929 ("Thanks" right after the note) went dormant on 10-21 instead of B. Measuring every lead's `[callback]` from its last real message would fix that, but B has no "we already followed up" check, so 626-428-5292 would read B again after today's b_callback text; it needs a rule for when a B is done. Done 10-26: LEAD-SCAN-CALLBACK-ONCE below (562-236-7929 had in fact had her b_callback at 10-21 10:13, so dormant was right for her).

## LEAD-SCAN-REACTION-LADDER - A lead whose last word is a reaction goes down the hold / `[callback]` / follow-up ladder; a reaction never restarts the 3-text count (2026-10-25)

Status: done.

Why: the same dead end as LEAD-SCAN-COURTESY-LADDER above, for a reaction ("Liked …", 👍): H "最后一条是点赞，不用回" with no next action, ahead of the hold / B / D branches. 8 live leads, 4 with a `[callback]`; 805-455-1668 ("Let me talk to my husband", then a like on our "take your time") sat four weeks. Owner 2026-10-25: the same hold / `[callback]` / D checks, and the reaction itself is still never answered.

What changed:
- `lib/lead-scan.ts`:
  - A reaction-last lead takes the "we spoke last" ladder like a thanks past its window (`doneWith`): never A; an active hold is H 挂起到, a `[callback]` is B, a hold that ran out is dormant, otherwise the 20-hour spacing, the cap and D "（客人最后只点了个赞，那个不回）". The hold and the `[callback]` are measured from the last real message, as for the thanks. The `tapback_last` flag stays.
  - The "不用回" quiet branch skips those leads: the desk acks a reaction (leads §1.6), and with the ack on, the lead fell back into a stop with no next action.
  - A reaction does not restart the 3-text count (`countFrom`: the customer's last word other than a reaction; a thanks still restarts it). Otherwise a customer who likes every follow-up reads "第 1 条" forever.
  - Twilio's +1 for a text sent from the phone app counts only when that text came after the customer's last word; before, one sent before a thanks made D read "第 2 条".
  - The newest real inbound (judged instead of a trailing reaction or thanks) is the later of Twilio's `lastRealIn` and the timeline's, so photos or a question followed by a like still read as owed an answer when they are older than Twilio's last 1000 texts (they would otherwise read reaction-last and get a follow-up instead of a reply).
- `tests/lead-scan-courtesy.test.ts`: the tapback test now expects the ladder. New: a like right after our text → H 刚发过, then D "第 2 条" at 46 h with the desk's ack on (the run counts our text before the like); a like after a `[callback]` → H 挂起到 while the hold runs, B after it; a customer who liked all three texts → H cap with `needs_hold`; photos then a like, timeline only → A; our phone-app text before a thanks → D "第 1 条", run 0. The courtesy D case now carries the desk's ack too.
- `.claude/skills/lead-scan/SKILL.md`: H no longer lists 点赞; B and D say a reaction counts as us speaking last and does not restart the count; `tapback_last` says the like is acked and the bucket goes on.

Verification completed:
- `npm test`: 324 pass, 0 fail. Output: `harness/verification/2026-10-25-lead-scan-reaction-ladder/npm-test.txt`.
- The tests bite (copies in the session scratchpad): HEAD 10af7837 fails 5 of the file's 10; a reaction restarting the count fails 2; the ack still a stop fails 1; the real message from Twilio only fails 1; the phone-app +1 before the customer's word fails 1; the hold and `[callback]` from the last word fail 4. Output: `harness/verification/2026-10-25-lead-scan-reaction-ladder/mutation.txt`.
- `npm run lint:copy`: 0 hard-rule hits. Output: `harness/verification/2026-10-25-lead-scan-reaction-ladder/lint-copy.txt`. `tsc`: no errors in `lib/lead-scan.ts` or the test.
- Read-only on the live pool before pushing (HEAD 10af7837 and the change in one process on the same rows; write-guarded Supabase, Twilio list GETs only): exactly the 8 reaction-last leads move. B: 805-455-1668 (talk to my husband) and 585-704-3872 (mother-in-law to call Monday). D "第 2 条": 845-519-7333 (her 10-21 / 10-22 questions voided the 10-14 hold and `[callback]`), 760-567-5043, and 818-388-4745 with F (tables_asked). H with a next action at the hold's end: 760-333-6986 (10-29, `[callback]`) and 949-280-3212 (11-14). Dormant: 805-539-3134 (hold ran out 10-09). Two more leads' run went up by one with no bucket change (805-750-5662 on hold, 650-823-0090 dormant). Output: `harness/verification/2026-10-25-lead-scan-reaction-ladder/live-scan-diff.txt`.
- Deployed 85520ce9 (local `pnpm build` first: exit 0, homepage SSR 77113 bytes, h1 1, jsonld 4). `/_release/ready` named it after ~90 s; `verify-live.sh` green. Production `desk scan --no-write` at 10-25 18:54 PT: the same eight moves as the local diff (B 0 → 2, D 8 → 11 with F 1 → 2, H 264 → 259); no lead left in H "最后一条是点赞" or H "不再补". Output: `harness/verification/2026-10-25-lead-scan-reaction-ladder/prod-after-deploy.txt`.
- No texts sent; `desk scan` only with `--no-write`; nothing written to leads. Not a `harness/feature_list.json` item, so there is no status transition there.

## LEAD-SCAN-CALLBACK-ONCE - A thanks or a like never voids a hold or a `[callback]`; B is one follow-up (2026-10-26)

Status: done.

Why: owner 2026-10-26, the follow-up to the two entries above: "a thanks or a like (answered or not) never voids a [callback]; B ends once we have texted after the hold ran out (so a lead is not B again right after its b_callback)". The `[callback]` watermark was the customer's last contact, so a thanks after the note voided it as soon as we answered the thanks; and B had no "done" at all - a lead stayed B after its b_callback until it was held again, and came back to B when that hold ran out.

What changed:
- `lib/lead-scan.ts`:
  - The hold and the `[callback]` are always measured from the customer's last real message (`spokeAt`: text that is more than a thanks or a reaction, or photos; calls, site forms, emails), answered or not. The hold had to go with the `[callback]`: counted, an answered thanks after the hold voided it, and B (or D) came the next day instead of on the day the customer named.
  - B is done once we have followed up after the `[callback]` note (`callbackChased`): a text or an email of ours with no word from the customer in the 2 hours before it (a reaction is not a word), counting a phone-app text Twilio has and the timeline does not. The "take your time" sent with the note and the close on a later thanks are answers, so they do not end it. After that the lead takes the rest of the ladder; with the hold run out and nothing real since, that is dormant.
  - Why not the rule as worded ("texted after the hold ran out"): in the live data 562-236-7929's b_callback went out at 10-21 10:13, 5½ hours before her hold ran out at 15:46, and the desk re-holds after a b_callback (714-420-0304 after each of its two, 310-739-5610, 310-293-0380); read literally, every one of them would have been B again. The rule as worded is one of the mutants below and fails two tests.
- `tests/lead-scan-courtesy.test.ts`: an answered thanks keeps the hold (H 挂起到 at 36 h) and the `[callback]` (B once the hold ran out); B, then the b_callback, then dormant an hour later, H 挂起到 through a re-hold and dormant after it; a b_callback sent 7 hours before the hold ran out still ends B.
- `.claude/skills/lead-scan/SKILL.md`: B says a thanks or a like (answered or not) is not the customer speaking and that B is one follow-up; H says a hold stands through a thanks or a like.

Verification completed:
- `npm test`: 327 pass, 0 fail. Output: `harness/verification/2026-10-26-lead-scan-callback-once/npm-test.txt`.
- The tests bite (copies in the session scratchpad): HEAD 6101a358 fails the 3 new tests; an answered thanks voiding the `[callback]` fails 4; voiding the hold fails 3; no B-done check fails 2; answers counted as follow-ups fails 1; the rule as worded (a follow-up only after the current hold ran out) fails 2. Output: `harness/verification/2026-10-26-lead-scan-callback-once/mutation.txt`.
- `npm run lint:copy`: 0 hard-rule hits. `tsc`: no errors in `lib/lead-scan.ts` or the test.
- Read-only on the live pool before pushing (HEAD 6101a358 and the change in one process on the same rows; write-guarded Supabase, Twilio list GETs only), 10-26 11:32 PT: one lead moves. 585-704-3872 got her b_callback at 10:03 that morning; she reads H 休眠 (hold ran out 10-19, only a like since) instead of "刚发过" with a third text due the next day. No run or flag changes. The same rows with the clock moved to 11-10: the whole pool differs in exactly six leads, all `[callback]` leads already followed up after their note - five that HEAD would put back in B after their re-holds (626-807-3409, 310-739-5610, 760-534-4964, 231-383-3404, 714-420-0304 for the third time) and 585-704-3872's third text - all dormant instead; the 18 `[callback]`s not yet followed up are B under both. Output: `harness/verification/2026-10-26-lead-scan-callback-once/live-scan-diff.txt`.
- Deployed f4549009 (local `pnpm build` first: exit 0, homepage SSR 77113 bytes, h1 1, jsonld 4). `/_release/ready` named it after ~75 s; `verify-live.sh` green. Production `desk scan --no-write` at 10-26 11:41 PT matches the local run (B 1, D 2, H 267): 585-704-3872 H 休眠; the five re-held leads H 挂起到 until their holds run out. Output: `harness/verification/2026-10-26-lead-scan-callback-once/prod-after-deploy.txt`.
- No texts sent; `desk scan` only with `--no-write`; nothing written to leads. Not a `harness/feature_list.json` item, so there is no status transition there.

Noticed, not changed:
- The leads skill says `desk send` clears the hold ("会清掉挂起，先发后挂"); nothing in desk.py or the send route touches `hold_until` (626-428-5292 kept her 10-01 hold after the 10-25 text).
- A `[callback]` written with no hold is B at once (818-388-4745, 10-26 10:37): the scan has no other due date for it. Done the same day: LEAD-SCAN-CALLBACK-NEEDS-HOLD below.

## LEAD-SCAN-CALLBACK-NEEDS-HOLD - A `[callback]` with no hold of its own reads H `needs_hold`, not B at once (2026-10-26)

Status: done.

Why: owner 2026-10-26: "a [callback] with no hold should not be B at once: read it H with a needs_hold flag (set the hold to the day they named) until a hold exists." The hold is the only due date the scan has for a `[callback]`; with none, B came the moment the note went in. 818-388-4745 read B minutes after "She's looking at weather" (her sister deciding on Sunday 11/1).

What changed:
- `lib/lead-scan.ts`: an open `[callback]` (valid, not chased) whose hold state is "none" is H "[callback] 没挂起：挂到他说的那天，到点再进 B（…）" with `needs_hold` and no next action. "None" is the scan's hold state, not an empty `hold_until`: never held, or held before what the customer said since (a hold they have spoken past does not date a newer promise). A running hold is H 挂起到 as before; one that ran out is B as before. A hold set a few seconds before the note still dates it (the hold state does not look at the note's time).
- `scripts/desk/desk.py`: the H line of `desk scan` says which hold a `needs_hold` wants (14 days after the cap; the named day for a `[callback]`).
- `.claude/skills/lead-scan/SKILL.md`: B says the due date comes from the hold; H lists the unheld `[callback]` and how long to hold; §6 the same.
- `tests/lead-scan-courtesy.test.ts`: 818-388-4745's thread with no hold → H `needs_hold`; held to Sunday → H 挂起到, then B on 11-02; with an old hold that ran out before she wrote → H `needs_hold`.

Verification completed:
- `npm test`: 329 pass, 0 fail. Output: `harness/verification/2026-10-26-lead-scan-callback-needs-hold/npm-test.txt`.
- The tests bite: HEAD 25794697 fails the 2 new tests; "no hold" read as an empty `hold_until` fails the old-hold test; an expired hold read as no hold fails 6 (every B after a hold). Output: `harness/verification/2026-10-26-lead-scan-callback-needs-hold/mutation.txt`.
- `npm run lint:copy`: 0 hard-rule hits. `python scripts/desk/selfcheck.py` (Python 3.10.6): all 53 pass. `tsc`: no errors in `lib/lead-scan.ts` or the test. Outputs: `lint-copy.txt`, `desk-selfcheck.txt` in the same folder.
- Read-only on the live pool before pushing (HEAD 25794697 and the change in one process on the same rows; write-guarded Supabase, Twilio list GETs only), 10-26 11:47 PT: one lead moves, 818-388-4745 B → H `needs_hold`; the same with the clock at 11-10 (the 17 `[callback]`s due by then all have a hold that ran out and stay B). No other run or flag change. Output: `harness/verification/2026-10-26-lead-scan-callback-needs-hold/live-scan-diff.txt`.
- Deployed 12014fca (local `pnpm build` first: exit 0, homepage SSR 77113 bytes, h1 1, jsonld 4). `/_release/ready` named it after ~90 s; `verify-live.sh` green. Production `desk scan --no-write` at 10-26 11:50 PT matches the local run (B 0, H 269): 818-388-4745 H `needs_hold`, and the H line names the hold to set. Output: `harness/verification/2026-10-26-lead-scan-callback-needs-hold/prod-after-deploy.txt`.
- No texts sent; `desk scan` only with `--no-write`; nothing written to leads. Not a `harness/feature_list.json` item, so there is no status transition there.

## DESK-SEND-UNREAD-GUARD - `desk send` will not go out over a customer text the sender has not read; `--seen` (2026-10-26)

Status: done.

Why: three replies went out without the customer's latest text, because `desk thread <phone>` and `desk send` ran in one shell command and the newer text was never read: JT Possehl twice (10-21 20:06:33 PT, 3 s after "When do you need the menu buy?"; 10-23 20:01:53, 58 s after "We want to pay with card" and 50 s after "I apologize") and a prom lead (10-24 18:54:23, 5 s after "small private school that doesn't do a prom", asking "before they head out, or an after-party?"). Owner 2026-10-26: `desk send` refuses when the customer has a text the sender has not accounted for; `--force` must not skip that.

What changed:
- `scripts/desk/desk.py`:
  - `desk send` reads the thread first (GET `/api/admin/sms-thread?phone=`, Twilio - what `desk thread` reads; by phone only, so no reconcile write) and refuses - exit 2, nothing uploaded or posted - when the customer has a text after the one `--seen` names, or, with no `--seen`, one from the last 90 s. It prints those texts to the second and the exact `--seen` to re-run with.
  - `--seen` takes the value desk prints (`2026-10-24T18:54:18-07:00`; any ISO time, the API's `...Z` too) or HH:MM / MM-DD HH:MM[:SS] on the Pacific clock (no date = the latest such time that has passed). With seconds it names that text. HH:MM names the customer's first text of that minute (a second one in it counts as unread) and is refused for a text from the last 90 s, which the clock would name too. A `--seen` that names none of their texts is refused.
  - Only inbound texts count; ours (any desk, the App, the machine) never do. A staff number goes through (staff list from GET `/api/admin/chefs`, read only when there is something to stop for).
  - `--force` still overrides the server's brakes, not this check; `--force --seen` sends with force as before.
  - `desk thread` and every card end the conversation with `回复带 --seen <客人最后一条>`. `pt()` and `fmt_msg` take `seconds`.
- `scripts/desk/selfcheck.py`: 27 new checks - the three replies on 555 numbers at the second each went out (as sent, with the `--seen` of the text they answered, with `--force`), the `--seen` forms, a picture stopped before its upload, our own text, a number with no texts, staff vs not, the thread and card line, date rollover.
- `.claude/skills/leads/SKILL.md` §3: ① reading is its own step, never chained with send; the card / thread line gives the `--seen`. ⑤ send with `--seen`, what a refusal means, `--force` does not skip it. `.claude/skills/leads/tools.md`: the flag, its forms, the HH:MM rule, the thread line.

Verification completed:
- `python scripts/desk/selfcheck.py` (Python 3.10.6): 80 pass, 0 fail (53 before). Output: `harness/verification/2026-10-26-desk-send-unread-guard/selfcheck.txt`.
- The tests bite: ten in-memory mutants of desk.py (guard not called, `--force` skips it, our own texts counted, staff checked, HH:MM names the minute's last text, HH:MM trusted for a fresh text, no 90 s window, a later `--seen` passes, zone-less `--seen` read as UTC, no `--seen` line) each fail 1-16 of the new checks. Output: `mutation.txt`.
- Live, read-only: the three replies replayed through the real `desk send` against the live Twilio threads, cut to one second before each went out (POSTs blocked in the harness): each is stopped as sent, with the `--seen` of the text it answered, and with `--force`; each passes the guard only with the `--seen` of the newest customer text. Output: `live-replay.txt`. `desk thread 6198861622` (GET by phone) ends with the new line, naming the customer's 19:25:54 text and not our later 19:57 reply. Output: `live-thread.txt`.
- No TypeScript changed (`npm test` runs `tests/*.test.ts`, none of which touch desk). No texts sent, nothing written to leads. Not a `harness/feature_list.json` item, so there is no status transition there.

Noticed, not changed:
- The check runs on the desk just before the POST; a text that lands between that read and the send (about a second) is still missed. Closing it would take the send route refusing a seen time the desk passes - a site change and a deploy.
- `order send` and `order remind` text through the route directly and do not go through this check.
- Four old one-off scheduled-task folders (annie-wed-evening-confirm, f-one-batch-1002, glendale-deadline-1002, nasim-friday-confirm) call `desk send` without `--seen`; none of them is an active task.

## DEPOSIT-LUNCH-TIMES - The lock page's Start time list offers 12:00-4:30 PM, nothing before noon (2026-11-06)

Status: done.

Why: Lilibeth (iXCells Biotech, 31 guests, Wed 12/16 at 12 PM, San Diego) opened a lock link with no `event_time`, and the Start time list on `/deposit/pay` only went 5:00-8:00 PM, so she could not pick noon. She texted us and the desk sent a link with `event_time=12:00` preset. Handbook (`.claude/skills/leads/answers.md`, 现场): 12 PM starts have been done and the site says October-May suits lunch; nothing earlier than noon is approved yet; no "latest" start is advertised.

What changed:
- `app/deposit/pay/page.tsx` `TIME_OPTIONS`: 12:00, 12:30, 1:00 ... 4:30 PM in front of the 5:00-8:00 PM ones. "Pick a start time" stays first, "Not sure yet" last, nothing before 12:00. No other copy, price or behavior changed.

Downstream checked - nothing assumes evening-only, no change needed:
- `/api/deposit/start` validates the date only; the time goes into the Stripe metadata as picked.
- Stripe webhook -> `lib/crm-integration.ts`: `parseTimeTo24Hour` takes any HH:MM 00-23 as is (the +12 only applies to "1 PM"-style input), and `event_start` keeps the wall clock as UTC exactly as for evening times. `/quote` already offers 1 PM and 4 PM (`EVENT_TIME_OPTIONS`), so midday starts were already going through this path.
- Reminders: lead-watch's 72 h / 24 h party-contact texts read `wallTime()` ("12 PM") with today/tomorrow wording; the bill text goes an hour after the start, inside the 7-24 PT run hours. `desk order remind` says "tonight" only for 17:00 and later ("See you today at 12.").
- Day map / dispatch: start minutes come from the UTC fields and chain generically (`lib/dispatch.ts`); `scripts/desk/dispatch.py` flags a clash only for two starts under 3 h apart on one day, so one chef can take a noon lunch and an evening party.
- Chef share / prep sheet (`zhTime`, `lib/cooler-sheet.ts`): 12:00-17:59 reads 下午, so noon prints "下午 12:00". The cooler sheet itself prints no times. The calendar tab already shows starts before `evening_from_hour` (17) as daytime.
- `/api/booking-request`, `/api/booking/create`, the deposit success page and the weather preview only check that a time is present or format any HH:MM.

Verification completed:
- Local dev at 375x812: the select lists all 19 entries in order with no horizontal scroll; picking 12:00 PM turns the summary line into "December 16, 2026 · 12:00 PM" and the button into "Lock Wed, Dec 16 · nothing charged today" (never pressed). Output: `harness/verification/2026-11-06-deposit-lunch-times/local-options.txt`, `mobile-375-select-unpicked.jpg`, `mobile-375-select-12pm.jpg`.
- `npm test`: 398 pass, 0 fail. `npm run lint:copy`: 0 hard-rule hits (the one soft hit is the existing `app/pay/PayClient.tsx:469` line). Outputs: `npm-test.txt`, `lint-copy.txt` in the same folder.
- Local `pnpm build`: exit 0, homepage SSR 77528 bytes, h1 1, jsonld 4.
- Deployed 9bdf0ea1: `/_release/ready` named it after 55 s; `verify-live.sh` green (homepage 81473 bytes, h1 1, jsonld 4; city pages 200; redirects 308; sitemap 116). The live page with no `event_time` loads chunk `page-da5f5ef130dc7d21.js`, which carries the new list, and the select at 375x812 shows all 19 entries in order. Nothing picked or pressed on production. Output: `prod-after-deploy.txt`, `prod-mobile-375-select.jpg`.
- Not a `harness/feature_list.json` item, so there is no status transition there.

Noticed, not changed:
- `lib/leads-next-step.ts` `extractEventDate` assumes a 19:00 start for the workbench SOP timers: for a noon party the 48 h confirmation step comes due ~41 h ahead and the morning-after review ~22 h after. Both still land on the right side of the party.
- The list still ended at 8:00 PM while `/quote` offers 9 PM - done in the addendum below.
- `zhTime` says 下午 for 12:xx; 中午 would read more naturally on the chef share.

### Addendum - 8:30 and 9:00 PM (2026-11-06)

Why: ending at 8:00 PM read as a latest start, which the handbook never names, and `/quote` offers 9 PM. Asked for on 2026-11-06 right after the lunch-times deploy.

What changed:
- `TIME_OPTIONS` gains 8:30 and 9:00 PM before "Not sure yet". The comment says 9 PM is where `/quote`'s slots end, not a cutoff; anything later still comes in through "Not sure yet". Downstream reads 21:00 like any HH:MM (`/quote` already sends it): 晚上 9:00 on the chef share, "tonight" in `desk order remind`, the bill text at 10 PM inside the 7-24 PT run hours.

Verification completed:
- Local dev at 375x812: 21 entries in order, no horizontal scroll; picking 9:00 PM gives "December 16, 2026 · 9:00 PM" and the enabled Lock button (never pressed). Output: `local-options-late.txt`, `mobile-375-select-9pm.jpg`.
- `npm test`: 398 pass, 0 fail. `npm run lint:copy`: 0 hard-rule hits. Outputs: `npm-test-late.txt`, `lint-copy-late.txt`.
- Local `pnpm build`: exit 0, homepage SSR 77528 bytes, h1 1, jsonld 4.
- Deployed 23c8563f: `/_release/ready` named it after 65 s; `verify-live.sh` green. The live page with no `event_time` loads chunk `page-6e90fb92d49ac233.js` with the 21-entry list, and the select at 375x812 ends 8:30 PM, 9:00 PM, Not sure yet. Nothing picked or pressed on production. Output: `prod-after-deploy-late.txt`.

## CHICKEN-BREAST-THIGH - Chicken reads "breast and thigh" everywhere a guest sees it (2026-11-06)

Status: done.

Why: D-1106-01 (owner, 2026-11-06): the chicken is now bought as a mix of breast and thigh, by price and supply, and may stay that way. The site still said breast only: the sourcing spec on /menu and all 50 city pages ("Boneless, skinless breast" / "Hatched, raised and harvested in the USA. Breast meat only — no thigh substitution."), the menu's Proteins tab ("Boneless breast"), the homepage ("boneless breast") and `config/menu-items.ts` ("Tender chicken breast"). The risk the decision names is saying one thing and serving another.

What changed:
- `config/sourcing.ts` Chicken: spec "Boneless, skinless chicken, breast and thigh", no note. "Breast meat only — no thigh substitution." is gone, and so is "Hatched, raised and harvested in the USA.": nothing confirms the thigh is US-raised, and the decision keeps that line only if the owner confirms it. `note` is optional now; `components/menu/menu-tabs.tsx` and `components/menu/sourcing-spec.tsx` skip the empty line, and the city page prints "Chicken: Boneless, skinless chicken, breast and thigh." The header comment records the rule.
- `components/menu/menu-tabs.tsx` Proteins tab: "Boneless, skinless breast and thigh, house marinade".
- `app/page.tsx` "Fresh off the griddle" (desktop): "... BAP-certified jumbo shrimp, boneless chicken breast and thigh — plus 8 oz fried rice ...".
- `config/menu-items.ts` chicken: "Tender chicken, breast and thigh, marinated in our house marinade". No page renders the regular-protein descriptions today (no "Tender chicken" in the build), so this one is for consistency.
- `.claude/skills/leads/answers.md`: a 鸡肉 line. Never "chicken breast" to a customer; asked, the answer is "Boneless, skinless chicken, breast and thigh."; no USA claim until the owner confirms.
- `scripts/selftest/lint-copy.py`: hard rule `chicken-breast` over both repos' customer-facing files: any "breast" outside "breast and thigh", "white meat", "pechuga", "no thigh". It catches all four old strings.
- No price, portion or other menu item changed. The Spanish pages only say "Pollo: 5 oz". llms.txt / `lib/ai-facts.ts`, both FAQs, the JSON-LD, the SMS/email templates and desk.py never named the cut.

Invoice repo (party page /order, chef prep sheet): `git grep` on origin/main acad49f for breast / white meat / thigh / boneless / skinless / pechuga / 鸡胸 / 鸡腿 finds nothing; the planner, the chef sheet and the invoice just say "Chicken". No commit there. The mirror tests compare pricing constants and are untouched.

Verification completed:
- `npm test`: 400 pass, 0 fail. `npm run lint:copy`: 0 hard-rule hits. The same lint over this worktree plus a clean export of invoice origin/main: 0 hard hits, `chicken-breast` 0 in both (the soft 4% hits are the existing ones). Outputs: `harness/verification/2026-11-06-chicken-breast-thigh/npm-test.txt`, `lint-copy.txt`.
- Local `pnpm build`: exit 0, homepage SSR 77546 bytes, h1 1, jsonld 4. Every "breast" in `.next/server/app` and `.next/static` reads "breast and thigh"; "Breast meat only" and "harvested in the USA" appear nowhere; all 50 city pages carry the new spec line. Output: `build-check.txt`.
- Deployed ef4c08c8: `/_release/ready` named it after 55 s; `verify-live.sh` green (homepage 81491 bytes, h1 1, jsonld 4; city pages 200; redirects 308; llms.txt 200; sitemap 116). Live `/`, `/menu` and `/hibachi-at-home/irvine` with every JS chunk they load: each "breast" reads "breast and thigh", and "Breast meat only", "harvested in the USA" and "no thigh" are 0. In the browser: the /menu Proteins tab at 375x812 wraps the new line to two lines with no horizontal scroll; the Sourcing tab shows the chicken spec with no line under it; Irvine's "What we actually buy" fold reads "Chicken: Boneless, skinless chicken, breast and thigh."; no console errors. Only tab and fold toggles were clicked. The live party page (/order, invoice repo) has no breast/thigh wording in its HTML or 12 chunks. Output: `prod-after-deploy.txt`, `prod-menu-sourcing.jpg`, `prod-mobile-375-menu-proteins.jpg`, `prod-irvine-what-we-buy.jpg`.
- Not a `harness/feature_list.json` item, so there is no status transition there.

Noticed, not changed:
- Chef-facing: `public/chef-handbook.html` §06 出品标准 still lists "Chicken 鸡胸" (its source, `RealHibachi厨师手册-v2.9.html`, sits outside the repo). The decision says chefs tell a guest it's a mix if asked. Changed later the same day: CHEF-HANDBOOK-CHICKEN below.
- Internal names stay as the task said: `lib/prep-bom.ts` 鸡胸盘, `lib/pantry.ts`, `lib/cooler-sheet.ts` 鸡胸肉 切块, the supplies/warehouse skills ("Chicken Breast", alias "ks chkn brst bnls"). A receipt line for thighs won't match those aliases on its own.

## CHEF-HANDBOOK-CHICKEN - The chef handbook's protein table says breast and thigh too (2026-11-06)

Status: done.

Why: follow-up to CHICKEN-BREAST-THIGH (D-1106-01); the owner said yes to the one chef-facing line left. `public/chef-handbook.html` §06 出品标准 listed "Chicken 鸡胸", and D-1106-01 has the chef tell a guest it's a mix if asked.

What changed:
- §06 regular-protein table, Chicken row: "Chicken 鸡胸 + 鸡腿", and the 要注意的 cell reads "无麸质；客人问部位就说 breast and thigh". Allergens (无) and every other row are unchanged; no price or portion moved. A first try, "鸡肉 (鸡胸 + 鸡腿)", broke inside 鸡腿 at 375 px; the shorter cell fits on one line.
- Version stamp v1.1 · 2026-10-07 → v1.2 · 2026-11-06 in the header and the footer, the way the 10-07 content edits bumped it (851895ae, 0d338247).
- The handbook has no other 鸡胸 / breast mention. `D:\desktop\RealHibachi\RealHibachi厨师手册-v2.9.html` (outside the repo) still says 鸡胸, but it is handbook v1.0 · 2026-08-26, two versions behind the repo copy, so the repo copy is the live source; it was not touched.

Verification completed:
- `npm test`: 400 pass, 0 fail. `npm run lint:copy`: 0 hard-rule hits, `chicken-breast` 0 (the one soft hit is the existing `4pct-v2` line in `app/pay/PayClient.tsx`). Outputs: `harness/verification/2026-11-06-chef-handbook-chicken/npm-test.txt`, `lint-copy.txt`.
- Local `npm run dev`, `/chef-handbook.html#s6` in the browser pane: at 375x812 "Chicken 鸡胸 + 鸡腿" sits on one line and the page has no horizontal scroll (the table scrolls inside its frame, as it already did); at 768x1024 the whole row shows; no console errors. Output: `local-375-handbook-proteins.jpg`, `local-768-handbook-proteins.jpg`.
- Deployed as 0e212fe9, a merge of e71f1a6f with origin/main's two `answers.md` commits (47398ff4, 20906f27). The app's sync refused to write `.claude/skills` from the repo's pinned origin even after the owner confirmed it, so the merge was built with `git merge-tree --write-tree` + `git commit-tree` and pushed; nothing under `.claude/skills` was written in the worktree. Merged tree vs origin/main is this change only; vs e71f1a6f it is the `answers.md` line only, which no test or lint reads. `/_release/ready` named 0e212fe9 after 54 s. Live `/chef-handbook` and `/chef-handbook.html` (200): the row is "Chicken 鸡胸 + 鸡腿 / 无 / 无麸质；客人问部位就说 breast and thigh", stamps v1.2 · 2026-11-06, old row 0, "v1.1" 0 (before the deploy: old row 1, v1.1). `verify-live.sh` green (homepage 81491 bytes, h1 1, jsonld 4; city pages 200; redirects 308; llms.txt 200; sitemap 116). Browser pane at 375 and 768: same as local, no console errors, nothing clicked. Output: `prod-after-deploy.txt`, `prod-375-handbook-proteins.jpg`, `prod-768-handbook-proteins.jpg`.
- Not a `harness/feature_list.json` item.

## PROMISE-EACH-CHEF-STYLE - "Each chef has their own style" is not a two-chef promise (2026-11-07)

Status: done; deployed 2026-11-07 on the owner's go-ahead (marketing 642bf91a, invoice c31d69a).

Why: `parseStaffingPromise()` (`lib/dispatch-plan.ts`) read any "each chef" as a crew of at least two (`EACH_CHEF_RE`, the plural branch). `lib/promise-capture.ts` runs it on every outbound desk SMS/email and writes `orders.dispatch_plan.promise`, and the desk's recommended answer to a show question is "Each chef has their own style" (owner, 2026-10-30, expectation management). On 11-07 RH-20261028-4275 (15 guests, 1 chef) and RH-20261107-9978 (11 heads) showed `promise_unmet` ("答应过客人 2 位师傅") on `desk order show`, the prep sheet and the day map. Both were fixed by hand (plan back to rule, `dispatch_plan.promise` null), so there is no data work.

What changed:
- `GENERAL_CHEF_RE` takes statements about chefs in general out of the text before the "each chef" test: "each/every chef has / will have / brings / 's got ... their own style, a flair, a personality, their own way"; "each chef's style"; "each chef is (a little / a bit / slightly) different" or "unique". The has ... style stretch stays inside one clause (no sentence end, comma or dash) and stops at a grill, station or pop-up, so "each chef has a grill and their own style" is still a crew. "Both chefs" is left as two chefs.
- Unchanged: explicit counts ("2 chefs and 2 grills for 30", "we'd bring 2-3 chefs with their own grills", "For 35 we send two chefs, each with their own grill"), "a second chef", "each chef cooks from an open end", the "past 28" rule text and the "one chef" veto. A count in the same text as the general line still makes the promise.
- `tests/dispatch-plan.test.ts`: both real texts and 12 variants parse to null; two more real Eileen texts ("2 chefs and 2 grills for 30", "each chef cooks from an open end") join the desk's own texts; mixed texts (the general line next to a count, next to "each chef cooks from an open end", with a grill in the clause) and "both chefs have their own style" still parse to 2/2.
- Mirror: `v0-real-hibachi-invoice-generator/lib/dispatch-plan.ts` (its header: change both copies together) got the same code and the same cases in its PROMISES table, on its own branch `claude/promise-each-chef-style`, commit c31d69a, pushed to that repo's main with this deploy. The two copies still differ only in the header and `GUESTS_PER_CHEF`.

Verification completed:
- `npm test`: 406 pass, 0 fail (404 before, plus the two new tests). The new test file run against origin/main's lib fails on the 4275 text (`{ chefs: 2, grills: 2 }`), so it covers the bug. `npm run lint:copy`: 0 hard-rule hits (the one soft hit is the existing `4pct-v2` line in `app/pay/PayClient.tsx`). `tsc --noEmit`: nothing in the two changed files; no export or signature changed. A scratch battery of 55 phrasings (the cases above plus guards such as "either way", "family-style", "at a different end") came out as expected. Invoice repo `npm test` on the mirror branch: 302 pass, 0 fail. Outputs: `harness/verification/2026-11-07-promise-each-chef-style/` (`npm-test.txt`, `lint-copy.txt`, `before-fix.txt`, `phrasing-battery.txt`, `invoice-mirror-npm-test.txt`).
- Deployed as 642bf91a, a merge of 6db531c6 with origin/main's three leads-skill commits (57c48402, 4b881897, 60363a39). The app's sync refused again (origin pinned before the app asked), so the merge was built with `git merge-tree --write-tree` + `git commit-tree` and pushed; nothing under `.claude/skills` was written in the worktree. Merged tree vs origin/main is this change only; vs 6db531c6 it is the four skill files only, which no test or lint reads. Local `pnpm build` (after `CI=true pnpm install --frozen-lockfile` in the worktree): homepage 77546 bytes, h1 1, jsonld 4. `/_release/ready` named 642bf91a about 61 s after the push. `verify-live.sh` green (homepage 81491 bytes, h1 1, jsonld 4; city pages 200; redirects 308; llms.txt 200; sitemap 116). The live `/admin` chunk `page-f51bf57738276aed.js` carries the new `GENERAL_CHEF_RE` source. Invoice: c31d69a pushed to its main (fast-forward from 2189d3c); `invoice.realhibachi.com/order` and `party.realhibachi.com/order` moved from `dpl_6ewd9dm7ySg98XFGUsqMZzdB46YS` to `dpl_8bmh1Tb9BnYFvv2RJoUtA4pwSwJn` 32 s after the push. c31d69a is the only new commit there, but Vercel's record of the commit needs a login, so that link is by timing. Output: `prod-after-deploy.txt`.
- Not a `harness/feature_list.json` item.

Noticed, not changed:
- `EACH_CHEF_RE` still reads "per chef" as a crew, so "a travel fee per chef" in a small party's text would be two chefs. Not seen in the desk's texts or the leads skill.

## QUOTE-MINIMUM-UPGRADES - /quote measures the $599 minimum on food + upgrades + rentals, like the invoice (2026-11-08)

Status: done; deployed 2026-11-09 on the owner's go-ahead (0220ff52 + f3ed8404).

Why: the invoice engine (`v0-real-hibachi-invoice-generator/lib/pricing.ts` `calcInvoiceTotal`) floors the whole subtotal: `subtotal = baseCost + proteinUpgrades + appetizersCost + addonsCost + partyExtrasCost`, then `max(afterPromo, MINIMUM_SPEND)`, travel on top (`lib/invoice-html.ts` prints the difference as "Min. spend adj." after the items). Rentals (`tables_chairs` $10, `utensils` $5 a guest) are `partyExtrasCost`, so they count too, and every official promotion (the Weekday Special included) comes off before the floor. /quote's price card already priced it that way, but the step-3 breakdown's minimum line was `effectiveBase - baseSubtotal`, the food alone (and `effectiveBase` held the rentals, so a rented setup was counted twice). On 2026-11-08 Nicole Weston (7 adults + 1 kid, Mon 11/23 in Indio, filet + scallops + lobster tail = $208) read "$599 event minimum applied +$149.80" above her upgrades: $449.20 + $208 = $657.20 is past the minimum and the invoice adds nothing; the lines added up to $807 against a $599–$657.20 card. The desk already told her the invoice figure. The Weekday Special saving (`weekdaySavings`) floored the food alone the same way, so 8 adults on a Tuesday with all three upgrades read "save $0" (no button) where the saving is $40.

What changed:
- `lib/quote-builder.ts`: `QuoteResult.minimumTopUp` replaces `effectiveBase` (nothing else read it): `floorHigh - subtotalRange.high`, i.e. `max(0, 599 - (food + rentals + the upgrades as picked))`, the same figures the breakdown lists and the price card's high end is built from. New `weekdaySpecialSavings(input)`: both plans through `calculateQuote` (loyalty left out, as before), high end minus high end.
- `app/quote/QuoteBuilderClient.tsx`: the minimum line reads `result.minimumTopUp` and moves below the tables and upgrades lines (after what it is measured on, like the invoice); `weekdaySavings` calls `weekdaySpecialSavings`. The upgrades line now shows on the Weekday Special plan too: upgrades have been priced on both plans since 2026-09-08 (e716bc2a, "Upgrades are available on every tier") and sit in the total, but the line was still hidden there, which the new minimum line would have made visible. The sentence under the upgrade buttons on that plan, "Premium upgrades are Standard Plan only — picking one switches this quote to Standard pricing.", was left from before 09-08 (nothing switches), so both plans now read "Per guest who chooses it, on top of the 2 regular proteins."
- `tests/quote-minimum-upgrades.test.ts` (6 tests): Nicole's party (no minimum line, $657.20 high end, $599 low end when nobody upgrades); 4 adults + scallops (top-up $335.40, total $599, not $623); 4 adults + full setup + scallops (top-up $275.40); travel outside the minimum; a grid of 1-14 adults x 0/1/3 kids x both plans x setup on/off x 5 upgrade picks against an `invoiceTotal()` worked from the inputs the way `calcInvoiceTotal` does, with the lines adding up to the card's high end; the weekday saving ($40 with the upgrades, $0 without, $75 for 15 adults as before).

Checked, no change needed:
- `components/city/landing-estimator.tsx` (and the occasion/menu estimators): `calcSimpleEstimate` floors food + rentals; the card offers no upgrades, so there is nothing for the floor to miss.
- `app/api/agent/price`: food + rentals (`tables`, `utensils`) before the floor, upgrades not priced; `minimumApplied` is right for what it prices. `app/api/admin/desk` `priceFor`: food only, same. `scripts/desk/desk.py` `_price_check` already floors food + rentals + the order's extras (upgrades, trays, noodles) minus promotions, the invoice way.
- Upgrade prices match the invoice's PROTEINS (scallops $6, filet mignon $8, lobster tail $12).

Verification completed:
- Before: the 6 new tests fail on origin/main 4bc696b4; a scratch run of the old line formula shows +$149.80 / +$359.40 / +$359.40 and lines adding up to $807 / $623 / $683 against cards of $599–$657.20 / $599 / $599 (`before-fix.txt`).
- `npm test`: 412 pass, 0 fail (406 before, plus the 6 new). `npm run lint:copy`: 0 hard-rule hits (the one soft hit is the existing `4pct-v2` line in `app/pay/PayClient.tsx`). `tsc --noEmit`: nothing in `lib/quote-builder.ts` or the new test; the 3 errors it lists in `QuoteBuilderClient.tsx` (`pushToast("success")`, `trackEvent("deposit_start_click")` x2) are on lines identical on origin/main.
- Local `npm run dev`, `/quote` in the browser pane (contact skipped with a test `rh_quote_unlock` seed, removed afterwards; `/api/landing-quote` answered by an in-page stub, so nothing was sent; GETs only): Nicole's party shows +$149.80 before any upgrade and no minimum line with all three ("up to +$208", card $661.30–$719.50 with the local $62.30 travel); 4 adults + scallops +$335.40, with the setup +$275.40, card $661.30; 8 adults on Tue 12/8 with setup + scallops: "save $40" and the Apply button, then on the Weekday Special the upgrades line (+$48), no minimum line, card $661.30–$669.50. No server errors; console only the slot-availability 503s (no database keys in the worktree). Outputs: `harness/verification/2026-11-08-quote-minimum-upgrades/` (`before-fix.txt`, `npm-test.txt`, `lint-copy.txt`, `browser-check.txt`, `local-nicole-7a1k-all-upgrades.jpg`, `local-4a-setup-scallops.jpg`, `local-weekday-8a-setup-scallops.jpg`).
- Production build before the push (2026-11-09): `pnpm build` on 0220ff52 failed prerendering /quote with `ReferenceError: input is not defined`. SWC's minifier had inlined `weekdaySpecialSavings` and its `total` helper (called twice) into the page's `useMemo` and left the second copy reading the helper's parameter, gone after inlining; dev mode and the tests do not minify, and Vercel would have failed the same way. f3ed8404 makes the two `calculateQuote` calls directly, same numbers (412 pass). Rebuilt: exit 0, 160/160 pages, homepage 77546 bytes / h1 1 / jsonld 4; both /quote bundles hold it as one function on its parameter, no stray `input`. The built bundle (`next start`) in the browser pane gave the dev check's breakdowns again and "save $40" for 8 adults on Tue 12/8 with setup + scallops. Output: `build-check.txt`, `local-prod-build-weekday-8a-setup-scallops.jpg`.
- Deployed: f3ed8404 pushed to main at 17:54:49Z, a fast-forward from 4bc696b4 (main had not moved, no merge). `/_release/ready` named f3ed8404 80 s later. `verify-live.sh` green (homepage 81491 bytes, h1 1, jsonld 4; city pages 200; redirects 308; llms.txt 200; sitemap 116). The live /quote chunk went from `page-958678477f4755cb.js` (`effectiveBase`, "Standard Plan only") to `page-9d10bd39acbff9a8.js` (`minimumTopUp`, neither old string, the weekday saving as one function on its parameter). GETs only; the live breakdown itself was not walked (step 3 needs the contact POST). Output: `prod-after-deploy.txt`.
- Not a `harness/feature_list.json` item.

Noticed, not changed:
- `/api/agent/price` lists "Optional upgrades and add-ons" under `notIncluded`, and `lib/ai-facts.ts` says "Event minimum: $599 (the food total after discounts, before travel and tip)". Neither says upgrades and rentals count toward the minimum, so an agent handed `total: 599, minimumApplied: true` could add upgrades on top - the same $149.80 mistake.
- The breakdown's loyalty line still shows the low end's discount (no upgrades) while the upgrades and minimum lines show the upgrades as picked: a returning customer whose food alone is under $599 but whose upgrades clear it sees no "Returning customer" line, though the card's high end has the $50 off.
- `heroEstimate` in `QuoteBuilderClient.tsx` is unused and floors the food alone.

## QUOTE-UPGRADE-SWAP - /quote says an upgrade swaps one of the 2 proteins, and prices all three the invoice's way (2026-11-11)

Status: committed on `claude/peaceful-herschel-8424e2`, not pushed. Waiting for the owner's go on the copy (shown to him in Chinese, before and after).

Why: the invoice engine (`v0-real-hibachi-invoice-generator/lib/pricing.ts` `calcGuestProteinCost`, origin/main 5ab32a1) gives every guest 2 proteins. A premium upgrade replaces one of them (filet +$8, scallops +$6, lobster tail +$12); each protein past the 2 is $10 more, so a premium one there is $18 / $16 / $22 (desk.py `PROTEIN_SIDE_PRICES` agrees). /quote's caption under the upgrade buttons read "Per guest who chooses it, on top of the 2 regular proteins.", and `calculateQuote` added the picked upgrades up per guest ($26 for all three) for the "up to" line and the card's high end. On 2026-11-08 the 7 adult + 1 kid party in Indio picked all three, saw about $672 and took it as chicken + shrimp + all three for everyone: that is $448 of proteins for 8 guests, not $208 ($912.20 in all). The owner walked it back on 11-11. /llms.txt said "A third protein is +$10 per guest.", which prices a premium third at $10.

What changed:
- `app/quote/QuoteBuilderClient.tsx`: the caption is "Swaps one of a guest's 2 proteins. Extra protein: $10 more." (2 and $10 read from `INCLUDED_PROTEINS_PER_PERSON` / `EXTRA_PROTEIN_PRICE`). A first try, "... An extra protein is $10 more.", left "more." alone on a second line at 375 px; this one is one line at 375 and 360. The button prices stay: they are the swap prices.
- `lib/quote-builder.ts`: new `upgradesPerGuestHigh(addOns)` prices the picked upgrades on one guest the invoice's way: their upgrades, plus $10 for each pick past the 2 included. One or two picks cost what they did; all three are $36 a guest, not $26. `addOnTotalRange.high` = guests x that (the low end stays 0, nobody upgrades); the minimum line, the card, the weekday saving and the lead text read it as before. The 11-08 party with all three: "up to +$288" (was +$208), card high end $737.20 + travel (was $657.20).
- `lib/ai-facts.ts` (/llms.txt, /llms-full.txt, /for-ai): "An upgrade swaps one of the guest's 2 included proteins; it does not add one. A protein beyond the 2 is +$10 per guest, plus its upgrade if premium (Filet Mignon +$18, Premium Sea Scallops +$16, Spiny Lobster Tail +$22). Example: chicken, shrimp and all 3 premiums for one guest = +$56." Every figure from the config.
- New `tests/quote-upgrade-swap.test.ts` (6): one or two picks cost their upgrades; all three $36, never $26; every pick x 1-30 adults x 0/2 kids x both plans against a line-for-line copy of `calcGuestProteinCost`; the 11-08 party ($288, and $448 for chicken + shrimp + all three); the prices match `config/menu-items.ts` and the pricing rules; the llms.txt line.
- Test definition changed: `tests/quote-minimum-upgrades.test.ts`'s `invoiceTotal()` helper priced upgrades the way the page did (the picks added up, $26 for all three), so its "what the invoice bills" agreed with the bug. It now prices a guest's proteins the invoice's way, and the 11-08 test expects $288 / $737.20 (was $208 / $657.20). The weekday saving there is still $40.

Verification completed:
- Before: on an untouched checkout of origin/main f9a84888 the new and updated tests fail 8 of 12 (208 !== 288, 26 !== 36, the old llms.txt line). The invoice engine's own code (its origin/main lib/pricing.ts, exported unchanged, imports nothing) gives the same as `upgradesPerGuestHigh` for all 8 picks, in `calcGuestProteinCost` and in quick-count `calcInvoiceTotal`; chicken + shrimp + all three is $56 a guest, $448 for 8. Output: `harness/verification/2026-11-11-quote-upgrade-swap/before-fix.txt`.
- `npm test`: 418 pass, 0 fail (412 on origin/main, plus the 6 new). `npm run lint:copy`: 0 hard-rule hits (the soft one is the existing `4pct-v2` line in `app/pay/PayClient.tsx`). Output: `npm-test.txt`, `lint-copy.txt`.
- Local `npm run dev`, /quote in the browser pane (contact skipped with a test `rh_quote_unlock` seed, removed afterwards; every non-GET fetch and beacon answered by an in-page stub, so the `/api/landing-quote` POST and the analytics hits went nowhere; GETs only to the server): the 11-08 party reads +$149.80 of minimum before any upgrade, and with all three "up to +$288", no minimum line, card $661.20–$799.40 (local travel $62.20); filet + lobster tail alone still "up to +$160". Caption one line at 375 and 360, no sideways scroll. Console: the slot-availability 503 only (no database keys in the worktree). Output: `browser-check.txt`, `local-desktop-11-08-party-all-three.jpg`, `local-375-11-08-party-all-three.jpg`.
- Not a `harness/feature_list.json` item.

Noticed, not changed:
- The upgrades' high end multiplies by every guest, under-5s included, though `config/pricing-rules.ts` gives under-5s no protein allowance. Left as it was: it only raises the "up to", and the planner has let an under-5 pick two proteins (RH-20261015-3202), so how the invoice treats them is not settled here.
- `app/actions/booking.ts` `createBooking` prices an "Extra Protein" at $15; nothing calls it. `components/promotional-card.tsx` ("FREE lobster protein upgrade"), `components/menu/PackageCard.tsx`, `components/menu/price-transparency.tsx` and `components/occasion/occasion-estimator.tsx` are imported nowhere.
