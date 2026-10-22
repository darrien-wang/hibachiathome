// Layer-2 self-test: the weekly competitor watch (2026-10-21). Only Southern
// California ads make the list, only this week's low reviews are complaints,
// and the report is one readable page.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { buildReport, pickSoCalAds, summarizeGoogleAds, summarizeReviews } from "../lib/competitor-watch"

test("competitor watch · only Southern California ads and known competitors make the list, newest first, no repeats", () => {
  const ads = pickSoCalAds([
    { id: "1", pageName: "fujihibachicateringla", text: "FUJI FLAME HIBACHI | LUXURY EXPERIENCE", ctaText: "Send message", linkUrl: "http://instagram.com/fujihibachicateringla", startDate: 1792479600 },
    { id: "2", pageName: "Hibachi Boston", text: "Backyard hibachi in Boston", startDate: 1792479600 },
    { id: "3", pageName: "Some Page", text: "Private hibachi chef in Orange County from $50", startDate: 1792300000 },
    { id: "4", pageName: "Real Hibachi", text: "our own ad", startDate: 1792479600 },
    { id: "5", pageName: "some page", text: "Private hibachi chef in Orange County from $50", startDate: 1792300000 },
    { id: "6", pageName: "Olive Hibachi", text: "Hibachi party in LA this weekend", startDate: 1792000000 },
    { id: "7", pageName: "Casa de la Abuela", text: "Tamales de la casa", startDate: 1792000000 },
  ])
  assert.deepEqual(ads.map((a) => a.id), ["1", "3", "6"])
  assert.equal(ads[0].competitor, "Fuji Flame Hibachi")
  assert.equal(ads[0].since, "2026-10-20")
  assert.equal(ads[0].cta, "Send message")
  assert.equal(ads[1].competitor, null)
})

test("competitor watch · reviews: only this week's count, only ≤3★ are complaints", () => {
  const now = Date.parse("2026-10-26T16:00:00Z")
  const r = summarizeReviews(
    "Hibachi 4Ever",
    [
      { iso_date: "2026-10-25T06:05:08Z", snippet: "Howard is the best", rating: 5 },
      { iso_date: "2026-10-24T03:50:17Z", snippet: "Chef was 2 hours late,\nnobody answered the phone", rating: 1 },
      { iso_date: "2026-10-23T00:00:00Z", snippet: "Fine", rating: 3 },
      { iso_date: "2026-10-10T00:00:00Z", snippet: "old complaint", rating: 1 },
      { snippet: "no date", rating: 1 },
    ],
    { rating: 4.9, votes: 2284 },
    now,
  )
  assert.equal(r.newInWindow, 3)
  assert.deepEqual(r.complaints.map((c) => c.rating), [1, 3])
  assert.equal(r.complaints[0].date, "2026-10-24")
  assert.equal(r.complaints[0].text, "Chef was 2 hours late, nobody answered the phone")
  assert.equal(r.votes, 2284)
  assert.equal(r.capped, false)
  const failed = summarizeReviews("X", [], {}, now, "monid 402")
  assert.equal(failed.error, "monid 402")
  assert.equal(failed.newInWindow, 0)
  // OMG Hibachi on 2026-10-21: all 20 newest reviews were from the last 7 days.
  const busy = summarizeReviews("OMG Hibachi", Array.from({ length: 20 }, (_, i) => ({ iso_date: new Date(now - i * 3600_000).toISOString(), rating: 5 })), { rating: 5, votes: 186 }, now)
  assert.equal(busy.newInWindow, 20)
  assert.equal(busy.capped, true)
})

test("competitor watch · Google Ads: an advertiser the Center does not know is a plain line, not an error", () => {
  const none = summarizeGoogleAds("OMG Hibachi", "omghibachi.com", [], { found: false })
  assert.equal(none.found, false)
  assert.equal(none.count, 0)
  assert.equal(none.error, undefined)
  const some = summarizeGoogleAds(
    "Monster Hibachi",
    "monsterhibachi.com",
    [
      { adUrl: "https://adstransparency.google.com/advertiser/AR1/creative/CR1", firstShown: "2026-10-01", lastShown: "2026-10-20" },
      { adUrl: "https://adstransparency.google.com/advertiser/AR1/creative/CR2", lastShown: 1792645855 },
    ],
    { found: true },
  )
  assert.equal(some.count, 2)
  assert.equal(some.newest, "2026-10-22")
  assert.match(some.sample ?? "", /creative\/CR1$/)
  const broke = summarizeGoogleAds("X", "x.com", [], { error: "monid 500" })
  assert.equal(broke.error, "monid 500")
})

test("competitor watch · the report reads top to bottom on a phone", () => {
  const md = buildReport({
    weekOf: "2026-10-26",
    metaAds: [
      { id: "1", pageName: "fujihibachicateringla", text: "Luxury hibachi", cta: "Send message", link: "", since: "2026-10-20", adCount: 1, competitor: "Fuji Flame Hibachi" },
      { id: "2", pageName: "Love Hibachi", text: "Cake is expected", cta: "Book now", link: "", since: "2026-10-21", adCount: 1, competitor: "Love Hibachi" },
    ],
    metaTotal: 412,
    googleAds: [{ competitor: "OMG Hibachi", domain: "omghibachi.com", found: false, count: 0, newest: null, sample: null }],
    reviews: [
      { competitor: "Hibachi 4Ever", rating: 5, votes: 2284, newInWindow: 2, complaints: [{ rating: 1, date: "2026-10-24", text: "late" }] },
      { competitor: "Senshi Hibachi", rating: 4.8, votes: 300, newInWindow: 0, complaints: [] },
      { competitor: "OMG Hibachi", rating: 5, votes: 186, newInWindow: 20, capped: true, complaints: [] },
    ],
    errors: ["Meta 广告库「hibachi」: monid 402"],
    cost: 0.0123,
  })
  assert.match(md, /^# 同行周报 · 2026-10-26\n/)
  assert.match(md, /南加相关 2 条，全美在跑 412 条/)
  assert.match(md, /- \*\*fujihibachicateringla\*\*（Fuji Flame Hibachi） · 自 2026-10-20 · \[Send message\]：Luxury hibachi/)
  assert.match(md, /- \*\*Love Hibachi\*\* · 自 2026-10-21 · \[Book now\]：Cake is expected/, "no (Love Hibachi) after Love Hibachi")
  assert.match(md, /- OMG Hibachi 5★×186：新评价 ≥20 条，没有 ≤3★/)
  assert.match(md, /- OMG Hibachi（omghibachi\.com）：透明中心没有这个广告主/)
  assert.match(md, /- Hibachi 4Ever 5★×2284：新评价 2 条，差评 1 条\n  - \[1★ 2026-10-24\] late/)
  assert.match(md, /- Senshi Hibachi 4\.8★×300：新评价 0 条，没有 ≤3★/)
  assert.match(md, /## 本次没拿到的\n- Meta 广告库「hibachi」: monid 402/)
  assert.match(md, /本次花费约 \$0\.012_$/)
})
