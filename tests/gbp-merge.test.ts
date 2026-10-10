// Google 商家资料同步：哪条对上哪条、哪条是新的、哪条 Google 上没了（lib/review-merge.ts）。
// 台账一行 = 一笔钱，对错了就是重复计钱或者漏记，所以每条规则都钉住。
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { bodySig, commentVariants, nearDays, planGbpSync, type GbpLite, type LedgerRow } from "../lib/review-merge"

const row = (id: string, o: Partial<LedgerRow> = {}): LedgerRow => ({ id, external_key: `Ci9DQU_${id}`, gbp_review_id: null, reviewer: null, review_date: null, body: null, ...o })
const g = (reviewId: string, o: Partial<GbpLite> = {}): GbpLite => ({ reviewId, reviewer: null, date: null, comment: null, ...o })
const ruleOf = (plan: ReturnType<typeof planGbpSync>, rowId: string) => plan.links.find((l) => l.rowId === rowId)

test("merge · same signature as the importer's fuzzyFilter (reviewer + first 25 chars, whitespace/case folded)", () => {
  assert.equal(bodySig("Maria  H.", "Best   party EVER!! Chef Blu was amazing"), bodySig("maria h.", "best party ever!! chef blu was great"))
  assert.notEqual(bodySig("Maria H.", "Best party ever"), bodySig("Maria G.", "Best party ever"))
  assert.ok(nearDays("2026-10-01", "2026-10-04"))
  assert.ok(!nearDays("2026-10-01", "2026-10-05"))
  assert.ok(!nearDays(null, "2026-10-05"))
})

test("merge · already linked by gbp_review_id wins over everything", () => {
  const plan = planGbpSync([row("a", { gbp_review_id: "G1", reviewer: "Ann", body: "x" })], [g("G1", { reviewer: "Someone else", comment: "totally different" })])
  assert.deepEqual(plan.links, [{ rowId: "a", reviewId: "G1", rule: "id" }])
  assert.deepEqual(plan.fresh, [])
  assert.deepEqual(plan.missing, [])
})

test("merge · external_key equal to the id (raw, g2_ or gbp_ prefix) links by key", () => {
  const plan = planGbpSync([row("a", { external_key: "g2_ABC" }), row("b", { external_key: "XYZ" })], [g("ABC"), g("XYZ")])
  assert.equal(ruleOf(plan, "a")?.rule, "key")
  assert.equal(ruleOf(plan, "b")?.rule, "key")
})

test("merge · reviewer + body prefix links; a page-truncated body still matches", () => {
  const rows = [row("a", { reviewer: "Frank Musso", review_date: "2026-10-03", body: "Chef Blu put on an incredible show for our family in La Quinta …" })]
  const plan = planGbpSync(rows, [g("G9", { reviewer: "Frank Musso", date: "2026-10-04", comment: "Chef Blu put on an incredible show for our family in La Quinta. The food was great and everyone had fun." })])
  assert.equal(ruleOf(plan, "a")?.rule, "body")
  assert.deepEqual(plan.fresh, [])
})

test("merge · Google's translated form matches the page text on either half", () => {
  const comment = "(Translated by Google) Excellent service, very friendly chef\n\n(Original)\nExcelente servicio, chef muy amable"
  assert.deepEqual(commentVariants(comment).slice(1), ["Excellent service, very friendly chef", "Excelente servicio, chef muy amable"])
  const en = planGbpSync([row("a", { reviewer: "Jaime Hernandez", body: "Excellent service, very friendly chef" })], [g("G1", { reviewer: "Jaime Hernandez", comment })])
  assert.equal(ruleOf(en, "a")?.rule, "body")
  const es = planGbpSync([row("a", { reviewer: "Jaime Hernandez", body: "Excelente servicio, chef muy amable" })], [g("G1", { reviewer: "Jaime Hernandez", comment })])
  assert.equal(ruleOf(es, "a")?.rule, "body")
})

test("merge · no body: same reviewer within ±3 days links by date (nearest wins)", () => {
  const rows = [row("far", { reviewer: "Nate Peirson", review_date: "2026-09-25" }), row("near", { reviewer: "Nate Peirson", review_date: "2026-09-28" })]
  const plan = planGbpSync(rows, [g("G1", { reviewer: "Nate Peirson", date: "2026-09-27" })])
  assert.equal(ruleOf(plan, "near")?.rule, "date")
  assert.deepEqual(plan.missing, ["far"])
})

test("merge · old review whose date was guessed from '3 months ago': unique name on both sides still links", () => {
  const rows = [row("a", { reviewer: "Dtg Willeatu", review_date: "2026-07-01" }), row("b", { reviewer: "Megan Truong", review_date: "2026-08-01", body: "Bling was great!" })]
  const reviews = [g("G1", { reviewer: "Dtg Willeatu", date: "2026-06-11" }), g("G2", { reviewer: "Megan Truong", date: "2026-07-20", comment: "Bling was great!" })]
  const plan = planGbpSync(rows, reviews)
  assert.equal(ruleOf(plan, "a")?.rule, "name")
  assert.equal(ruleOf(plan, "b")?.rule, "body")
})

test("merge · common name twice on Google: no name-only guess, the unmatched one is reported as a suspect", () => {
  const rows = [row("a", { reviewer: "David", review_date: "2026-05-01" })]
  const reviews = [g("G1", { reviewer: "David", date: "2026-08-01", comment: "Great" }), g("G2", { reviewer: "David", date: "2026-10-05", comment: "Amazing" })]
  const plan = planGbpSync(rows, reviews)
  assert.deepEqual(plan.links, [])
  assert.deepEqual(plan.fresh.sort(), ["G1", "G2"])
  assert.equal(plan.suspects.length, 2)
  assert.deepEqual(plan.missing, ["a"])
})

test("merge · anonymous reviewers never link by name or date", () => {
  const rows = [row("a", { reviewer: "A Google User", review_date: "2026-10-01" })]
  const plan = planGbpSync(rows, [g("G1", { reviewer: "A Google User", date: "2026-10-01" })])
  assert.deepEqual(plan.links, [])
  assert.deepEqual(plan.suspects, [])
})

test("merge · one ledger row is never linked twice; a duplicate row in the ledger shows up as missing, the one with money wins", () => {
  const rows = [row("dup", { reviewer: "Isabel Pantoja", body: "Amazing night with the family" }), row("paid", { reviewer: "Isabel Pantoja", body: "Amazing night with the family", bonus_id: "B1" })]
  const plan = planGbpSync(rows, [g("G1", { reviewer: "Isabel Pantoja", comment: "Amazing night with the family" })])
  assert.deepEqual(plan.links, [{ rowId: "paid", reviewId: "G1", rule: "body" }])
  assert.deepEqual(plan.missing, ["dup"])
  assert.deepEqual(plan.fresh, [])
})

test("merge · a row already tied to another Google id is not fuzzy-matched to a new review", () => {
  // Christina 删了评价：她那行挂着旧 id，新评价哪怕同名也不能接到她那行上
  const rows = [row("old", { gbp_review_id: "GONE", reviewer: "Christina Hillhurst", body: "Loved it" })]
  const plan = planGbpSync(rows, [g("NEW", { reviewer: "Christina Hillhurst", comment: "Loved it" })])
  assert.deepEqual(plan.links, [])
  assert.deepEqual(plan.fresh, ["NEW"])
  assert.deepEqual(plan.missing, ["old"])
})

test("merge · deleted on Google: reported missing, never dropped", () => {
  const plan = planGbpSync([row("a", { reviewer: "Gone", body: "bye" }), row("b", { reviewer: "Here", body: "hi there" })], [g("G1", { reviewer: "Here", comment: "hi there" })])
  assert.deepEqual(plan.missing, ["a"])
  assert.deepEqual(plan.fresh, [])
})

test("merge · a stronger rule is not stolen by a weaker one on another review", () => {
  // G2 只靠名字唯一能对上 a，但 a 的正文和 G1 对得上 —— a 必须给 G1
  const rows = [row("a", { reviewer: "Alicia Herrera", review_date: "2026-09-27", body: "blu is suck.good job" })]
  const reviews = [g("G2", { reviewer: "alicia herrera", date: "2026-01-01" }), g("G1", { reviewer: "Alicia Herrera", date: "2026-09-28", comment: "blu is suck.good job" })]
  const plan = planGbpSync(rows, reviews)
  assert.deepEqual(plan.links, [{ rowId: "a", reviewId: "G1", rule: "body" }])
  assert.deepEqual(plan.fresh, ["G2"])
})
