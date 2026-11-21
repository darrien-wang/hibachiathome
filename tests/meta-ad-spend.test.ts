import test from "node:test"
import assert from "node:assert/strict"
import { parseMetaAdRows, reconcileMetaAdSpend, type InsightRow } from "../lib/meta-ads-rest"

const row = (over: Partial<InsightRow>): InsightRow => ({
  campaign_id: "c1",
  campaign_name: "RH Meta Test 0924",
  adset_id: "s1",
  adset_name: "la_oc_sched",
  ad_id: "a1",
  ad_name: "P_grill",
  date_start: "2026-11-20",
  impressions: "1200",
  clicks: "40",
  inline_link_clicks: "31",
  spend: "24.37",
  ...over,
})

test("meta ad rows: dollars become cents, link clicks and all clicks stay apart, lead actions are summed", () => {
  const [r] = parseMetaAdRows([
    row({ actions: [{ action_type: "lead", value: "2" }, { action_type: "link_click", value: "31" }, { action_type: "lead", value: "1" }] }),
  ])
  assert.deepEqual(r, {
    campaignId: "c1",
    campaignName: "RH Meta Test 0924",
    adsetId: "s1",
    adsetName: "la_oc_sched",
    adId: "a1",
    adName: "P_grill",
    date: "2026-11-20",
    impressions: 1200,
    clicks: 40,
    linkClicks: 31,
    costCents: 2437,
    leads: 3,
  })
})

test("meta ad rows: float dollars round to the cent (19.99 must not become 1998)", () => {
  assert.equal(parseMetaAdRows([row({ spend: "19.99" })])[0].costCents, 1999)
  assert.equal(parseMetaAdRows([row({ spend: "0.57" })])[0].costCents, 57)
  assert.equal(parseMetaAdRows([row({ spend: undefined })])[0].costCents, 0)
})

test("meta ad rows: a row that cannot be keyed is dropped, not stored under an empty id", () => {
  assert.equal(parseMetaAdRows([row({ ad_id: undefined }), row({ adset_id: undefined }), row({ date_start: undefined }), row({ campaign_id: undefined })]).length, 0)
})

test("reconcile: ad rows that add up to the campaign row pass, cents of rounding included", () => {
  const camp = [{ campaignId: "c1", date: "2026-11-20", costCents: 10500 }]
  const ads = [
    { campaignId: "c1", date: "2026-11-20", costCents: 7499 },
    { campaignId: "c1", date: "2026-11-20", costCents: 3002 },
  ]
  const r = reconcileMetaAdSpend(camp, ads)
  assert.equal(r.ok, true)
  assert.equal(r.campaignCents, 10500)
  assert.equal(r.adCents, 10501)
  assert.equal(r.diffCents, 1)
})

test("reconcile: a missing ad set shows up as a mismatch and names the day", () => {
  const camp = [
    { campaignId: "c1", date: "2026-11-19", costCents: 9000 },
    { campaignId: "c1", date: "2026-11-20", costCents: 10500 },
  ]
  const ads = [
    { campaignId: "c1", date: "2026-11-19", costCents: 9000 },
    { campaignId: "c1", date: "2026-11-20", costCents: 7500 },
  ]
  const r = reconcileMetaAdSpend(camp, ads)
  assert.equal(r.ok, false)
  assert.deepEqual(r.worst, { campaignId: "c1", date: "2026-11-20", campaignCents: 10500, adCents: 7500 })
})

test("reconcile: a campaign-day with no ad rows at all is a mismatch", () => {
  const r = reconcileMetaAdSpend([{ campaignId: "c1", date: "2026-11-20", costCents: 500 }], [])
  assert.equal(r.ok, false)
  assert.equal(r.diffCents, -500)
})
