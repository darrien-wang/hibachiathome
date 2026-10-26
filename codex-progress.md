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
- No texts sent; `desk scan` ran only with `--no-write`; nothing was written to leads. This is not a `harness/feature_list.json` item, so there is no status transition there.

Left for later (read-only evidence in `harness/verification/2026-10-25-lead-scan-courtesy-ladder/followups.txt`):
- A tapback-last lead is the same dead end (H "最后一条是点赞，不用回", no next action); kept as is, as asked. 8 live, 4 of them with a `[callback]` (805-455-1668 since 09-28, 760-333-6986, 585-704-3872, 845-519-7333).
- A thanks we did answer (so not the last word) still voids a `[callback]` set before it: 562-236-7929 ("Thanks" right after the note) went dormant on 10-21 instead of B. Measuring every lead's `[callback]` from its last real message would fix that, but B has no "we already followed up" check, so 626-428-5292 would read B again after today's b_callback text; it needs a rule for when a B is done.
