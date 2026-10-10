// 好评自动同步（2026-10-09）：pg_cron 的专用钥匙 + 每次同步只写真变了的行。
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { CRON_PURPOSE_REVIEWS_SYNC, cronKeyFor, isCronCall } from "../lib/cron-key"
import { linkPatch, type LedgerFull } from "../lib/gbp-sync"
import type { GbpReview } from "../lib/gbp"

// ---------------------------------------------------------------- cron key

test("cron · the derived key is the same HMAC pgcrypto computes in the cron job", () => {
  // select encode(extensions.hmac('reviews-sync', btrim('  test-key-123 '), 'sha256'), 'hex') —— 在 Supabase 上跑出来的
  assert.equal(cronKeyFor(CRON_PURPOSE_REVIEWS_SYNC, "  test-key-123 "), "d5a9ebc3dd63fbdfd261d24ad1edfd983df5254d0911df8f6bd398f95d3640a7")
  assert.equal(cronKeyFor(CRON_PURPOSE_REVIEWS_SYNC, ""), null)
  assert.equal(cronKeyFor(CRON_PURPOSE_REVIEWS_SYNC, undefined), null)
})

test("cron · only ?consumer=cron with the purpose key gets in; the raw lead-watch key does not", () => {
  const base = "base-cron-key"
  const derived = cronKeyFor(CRON_PURPOSE_REVIEWS_SYNC, base)!
  const req = (q: string, headers: Record<string, string>) => ({ nextUrl: { searchParams: new URLSearchParams(q) }, headers: new Headers(headers) })
  assert.equal(isCronCall(req("consumer=cron", { "x-admin-key": derived }), CRON_PURPOSE_REVIEWS_SYNC, base), true)
  assert.equal(isCronCall(req("consumer=cron", { authorization: `Bearer ${derived}` }), CRON_PURPOSE_REVIEWS_SYNC, base), true)
  assert.equal(isCronCall(req("", { "x-admin-key": derived }), CRON_PURPOSE_REVIEWS_SYNC, base), false, "needs consumer=cron")
  assert.equal(isCronCall(req("consumer=cron", { "x-admin-key": base }), CRON_PURPOSE_REVIEWS_SYNC, base), false, "lead-watch's own key is not accepted here")
  assert.equal(isCronCall(req("consumer=cron", { "x-admin-key": cronKeyFor("something-else", base)! }), CRON_PURPOSE_REVIEWS_SYNC, base), false)
  assert.equal(isCronCall(req("consumer=cron", {}), CRON_PURPOSE_REVIEWS_SYNC, base), false)
  assert.equal(isCronCall(req("consumer=cron", { "x-admin-key": derived }), CRON_PURPOSE_REVIEWS_SYNC, ""), false, "no base key configured = nobody")
})

// ---------------------------------------------------------------- linkPatch

const row = (o: Partial<LedgerFull> = {}): LedgerFull => ({
  id: "r1",
  external_key: "Ci9DQU_x",
  gbp_review_id: "G1",
  reviewer: "Faviola Nieto",
  review_date: "2026-10-05",
  body: "It was a vey nice experience",
  rating: 5,
  has_photo: false,
  photo_count: 0,
  photo_urls: [],
  bonus_id: null,
  reply_comment: null,
  reply_updated_at: null,
  reply_state: null,
  ...o,
})
const review = (o: Partial<GbpReview> = {}): GbpReview => ({ reviewId: "G1", starRating: "FIVE", createTime: "2026-10-05T22:00:00Z", comment: "It was a vey nice experience", ...o })

test("sync · nothing changed on Google = nothing to write (the 15-minute cron must not rewrite every row)", () => {
  assert.deepEqual(linkPatch(row(), review(), "G1"), {})
  // Google 写 Z，数据库读回来是 +00:00 —— 同一时刻不算变化
  const replied = row({ reply_comment: "Thank you!", reply_updated_at: "2026-10-10T03:10:11.123+00:00", reply_state: "APPROVED", reply_by: "owner" } as Partial<LedgerFull>)
  assert.deepEqual(linkPatch(replied, review({ reviewReply: { comment: "Thank you!", updateTime: "2026-10-10T03:10:11.123Z", reviewReplyState: "APPROVED" } }), "G1"), {})
})

test("sync · a new reply on Google (e.g. typed in the business dashboard) is taken over, reply_by cleared", () => {
  const p = linkPatch(row(), review({ reviewReply: { comment: "Thanks Faviola!", updateTime: "2026-10-10T04:00:00Z", reviewReplyState: "APPROVED" } }), "G1")
  assert.deepEqual(p, { reply_comment: "Thanks Faviola!", reply_by: null, reply_updated_at: "2026-10-10T04:00:00Z", reply_state: "APPROVED" })
})

test("sync · only the moderation state moved (PENDING -> APPROVED): just that field", () => {
  const r = row({ reply_comment: "Thanks!", reply_updated_at: "2026-10-10T04:00:00Z", reply_state: "PENDING" })
  assert.deepEqual(linkPatch(r, review({ reviewReply: { comment: "Thanks!", updateTime: "2026-10-10T04:00:00Z", reviewReplyState: "APPROVED" } }), "G1"), { reply_state: "APPROVED" })
})

test("sync · reply deleted on Google clears ours", () => {
  const r = row({ reply_comment: "Thanks!", reply_updated_at: "2026-10-10T04:00:00Z", reply_state: "APPROVED" })
  assert.deepEqual(linkPatch(r, review(), "G1"), { reply_comment: null, reply_by: null, reply_updated_at: null, reply_state: null })
})

test("sync · first link sets the id; only empty fields are filled, hand edits are left alone", () => {
  const r = row({ gbp_review_id: null, rating: null, review_date: null, body: null })
  assert.deepEqual(linkPatch(r, review({ comment: "Loved it" }), "G1"), { gbp_review_id: "G1", rating: 5, review_date: "2026-10-05", body: "Loved it" })
  // 台账里已经有的日期/正文不改（哪怕 Google 那边不一样）
  assert.deepEqual(linkPatch(row({ review_date: "2026-04-27", body: "We had such a great time" }), review({ createTime: "2026-04-13T20:00:00Z", comment: "We had such a great time with Real Hibachi" }), "G1"), {})
})

test("sync · a page-truncated body is replaced by Google's full text", () => {
  const r = row({ body: "We had Blu for a bachelor party in La Quinta and he was …" })
  const full = "We had Blu for a bachelor party in La Quinta and he was awesome! Would highly recommend!"
  assert.deepEqual(linkPatch(r, review({ comment: full }), "G1"), { body: full })
})

test("sync · photos: stored once when the row has none, never overwritten", () => {
  const media = { reviewMediaItems: [{ thumbnailUrl: "https://lh3.googleusercontent.com/grass-cs/abc=w300-h300" }] }
  assert.deepEqual(linkPatch(row(), review(media), "G1"), { photo_urls: ["https://lh3.googleusercontent.com/grass-cs/abc"], photo_count: 1 })
  assert.deepEqual(linkPatch(row({ has_photo: true, photo_count: 1, photo_urls: ["https://lh3.googleusercontent.com/grass-cs/old"] }), review(media), "G1"), {})
})
