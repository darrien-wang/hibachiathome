// Google 商家资料的授权和请求外形（lib/gbp.ts）：不连网，只钉住我们自己的那一半。
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  GBP_REDIRECT_URI,
  GBP_SCOPE,
  buildAuthUrl,
  checkReply,
  clientProject,
  emailFromIdToken,
  gbpErrorFrom,
  gbpReviewId,
  openToken,
  parsePasted,
  pickLocation,
  pkcePair,
  ptDate,
  sealToken,
  starNumber,
  type GbpLocation,
} from "../lib/gbp"

test("gbp · the auth URL asks for offline access, the business scope, PKCE S256 and the loopback redirect", () => {
  const { verifier, challenge } = pkcePair()
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"))
  const u = new URL(buildAuthUrl("987010086025-abc.apps.googleusercontent.com", "STATE123", challenge))
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth")
  const p = u.searchParams
  assert.equal(p.get("redirect_uri"), GBP_REDIRECT_URI)
  assert.equal(p.get("access_type"), "offline")
  assert.match(p.get("prompt") ?? "", /consent/)
  assert.match(p.get("prompt") ?? "", /select_account/)
  assert.ok((p.get("scope") ?? "").split(" ").includes(GBP_SCOPE))
  assert.equal(p.get("code_challenge_method"), "S256")
  assert.equal(p.get("state"), "STATE123")
  assert.equal(p.get("include_granted_scopes"), null, "this token must not silently carry the Ads scopes")
})

test("gbp · the client id's leading number is the GCP project the quota is billed to", () => {
  assert.equal(clientProject("987010086025-hpo9.apps.googleusercontent.com"), "987010086025")
  assert.equal(clientProject("garbage"), null)
})

test("gbp · pasted address: full URL, no scheme, query only all work; cancel and junk are explained", () => {
  const want = { code: "4/0Abc-DEF_ghi", state: "S-1" }
  assert.deepEqual(parsePasted("http://127.0.0.1:8769/?state=S-1&code=4/0Abc-DEF_ghi&scope=email%20openid"), want)
  assert.deepEqual(parsePasted("  127.0.0.1:8769/?state=S-1&code=4%2F0Abc-DEF_ghi  "), want)
  assert.deepEqual(parsePasted("state=S-1&code=4/0Abc-DEF_ghi"), want)
  const denied = parsePasted("http://127.0.0.1:8769/?error=access_denied&state=S-1")
  assert.ok("error" in denied && /取消/.test(denied.error))
  assert.ok("error" in parsePasted(""))
  assert.ok("error" in parsePasted("https://www.realhibachi.com/admin?tab=reviews"))
})

test("gbp · refresh token sealing round-trips, and a different secret or a tampered blob gives null", () => {
  const sealed = sealToken("1//refresh-token-value", "client-secret-A")
  assert.ok(sealed.startsWith("v1."))
  assert.ok(!sealed.includes("refresh-token-value"))
  assert.equal(openToken(sealed, "client-secret-A"), "1//refresh-token-value")
  assert.equal(openToken(sealed, "client-secret-B"), null)
  const parts = sealed.split(".")
  parts[2] = Buffer.from("tampered").toString("base64url")
  assert.equal(openToken(parts.join("."), "client-secret-A"), null)
  assert.equal(openToken(null, "client-secret-A"), null)
  // 每次加密的密文都不一样（随机 IV）
  assert.notEqual(sealToken("x", "s"), sealToken("x", "s"))
})

test("gbp · email comes out of the id_token payload", () => {
  const payload = Buffer.from(JSON.stringify({ email: "owner@example.com", sub: "1" })).toString("base64url")
  assert.equal(emailFromIdToken(`h.${payload}.sig`), "owner@example.com")
  assert.equal(emailFromIdToken(undefined), null)
  assert.equal(emailFromIdToken("not-a-jwt"), null)
})

test("gbp · reply text: trimmed, never empty, at most 4096 UTF-8 bytes", () => {
  assert.deepEqual(checkReply("  Thank you, Maria!\r\nSee you soon  "), { ok: true, text: "Thank you, Maria!\nSee you soon" })
  assert.equal(checkReply("   ").ok, false)
  assert.equal(checkReply(42).ok, false)
  assert.equal(checkReply("a".repeat(4096)).ok, true)
  assert.equal(checkReply("a".repeat(4097)).ok, false)
  // 中文一个字 3 字节：1366 个字就超了
  assert.equal(checkReply("谢".repeat(1365)).ok, true)
  assert.equal(checkReply("谢".repeat(1366)).ok, false)
})

test("gbp · picking the location: our Place ID first, a single location next, otherwise ask", () => {
  const loc = (name: string, placeId: string | null): GbpLocation => ({ account: "accounts/1", name, title: name, placeId, mapsUri: null, newReviewUri: null })
  assert.equal(pickLocation([loc("locations/1", "other"), loc("locations/2", "ChIJkxNMr8pbkkARqHR_D2YBK6E")])?.name, "locations/2")
  assert.equal(pickLocation([loc("locations/9", "whatever")])?.name, "locations/9")
  assert.equal(pickLocation([loc("locations/1", "a"), loc("locations/2", "b")]), null)
  assert.equal(pickLocation([]), null)
})

test("gbp · review mapping: stars, Pacific date, id from name when reviewId is missing", () => {
  assert.equal(starNumber("FIVE"), 5)
  assert.equal(starNumber("ONE"), 1)
  assert.equal(starNumber("STAR_RATING_UNSPECIFIED"), null)
  assert.equal(starNumber(undefined), null)
  // 10-02 03:30 UTC 是洛杉矶 10-01 晚上
  assert.equal(ptDate("2026-10-02T03:30:00Z"), "2026-10-01")
  assert.equal(ptDate("garbage"), null)
  assert.equal(gbpReviewId({ name: "accounts/1/locations/2/reviews/AbC_123" }), "AbC_123")
  assert.equal(gbpReviewId({ reviewId: "Xy", name: "accounts/1/locations/2/reviews/AbC_123" }), "Xy")
})

test("gbp · Google errors become a Chinese hint the owner can act on", () => {
  const disabled = gbpErrorFrom(403, {
    error: {
      code: 403,
      status: "PERMISSION_DENIED",
      message: "Google My Business API has not been used in project 987010086025 before or it is disabled.",
      details: [{ reason: "SERVICE_DISABLED", metadata: { service: "mybusiness.googleapis.com", consumer: "projects/987010086025" } }],
    },
  })
  assert.equal(disabled.reason, "SERVICE_DISABLED")
  assert.match(disabled.hint, /启用/)
  assert.match(disabled.hint, /mybusiness\.googleapis\.com\?project=real-hibachi/)
  const revoked = gbpErrorFrom(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." })
  assert.equal(revoked.reason, "invalid_grant")
  assert.match(revoked.hint, /重新连接/)
  const quota = gbpErrorFrom(429, { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" } })
  assert.match(quota.hint, /配额/)
  const denied = gbpErrorFrom(403, { error: { code: 403, status: "PERMISSION_DENIED", message: "The caller does not have permission" } })
  assert.match(denied.hint, /所有者|管理员/)
})
