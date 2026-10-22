// Layer-2 self-test: the line-type check in front of the first text
// (2026-10-21). A landline must never get the price text, a Google Voice
// number must, and a Lookup outage must change nothing.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { blockReason, isLookupBlock, lookupLineType, parseLookup, smsCapable } from "../lib/phone-line-type"

test("line type · only lines that cannot take a text are ruled out", () => {
  assert.equal(smsCapable("mobile"), true)
  assert.equal(smsCapable("nonFixedVoip"), true, "Google Voice / TextNow receive SMS")
  assert.equal(smsCapable("personal"), true)
  assert.equal(smsCapable("landline"), false)
  assert.equal(smsCapable("fixedVoip"), false)
  assert.equal(smsCapable("tollFree"), false)
  assert.equal(smsCapable("unknown"), null)
  assert.equal(smsCapable(null), null)
  assert.equal(smsCapable("weird"), null)
})

test("line type · the stored reason names the line, not a carrier error code", () => {
  assert.equal(blockReason({ type: "landline", carrier: "Frontier" }), "lookup: landline (Frontier)")
  assert.equal(blockReason({ type: "fixedVoip", carrier: null }), "lookup: fixed VoIP line")
  assert.equal(blockReason({ type: "mobile", carrier: "T-Mobile" }), null)
  assert.equal(blockReason({ type: "unknown", carrier: null }), null)
  assert.equal(isLookupBlock("lookup: landline (Frontier)"), true)
  assert.equal(isLookupBlock("30006 landline"), false)
  assert.equal(isLookupBlock(null), false)
})

test("line type · Twilio's body parses, and anything odd is unknown", () => {
  assert.deepEqual(parseLookup({ line_type_intelligence: { type: "landline", carrier_name: "Frontier Communications" } }), { type: "landline", carrier: "Frontier Communications" })
  assert.deepEqual(parseLookup({ line_type_intelligence: { type: "mobile", carrier_name: "" } }), { type: "mobile", carrier: null })
  assert.deepEqual(parseLookup({ line_type_intelligence: null }), { type: "unknown", carrier: null })
  assert.deepEqual(parseLookup({ line_type_intelligence: { type: "hologram" } }), { type: "unknown", carrier: null })
  assert.deepEqual(parseLookup(null), { type: "unknown", carrier: null })
})

function fakeSupabase(cached: { line_type: string; carrier: string | null } | null, upserts: unknown[]) {
  return {
    from() {
      return {
        select() {
          return { eq() { return { maybeSingle: async () => ({ data: cached }) } } }
        },
        upsert: async (row: unknown) => {
          upserts.push(row)
          return { error: null }
        },
      }
    },
  } as never
}

test("line type · a cached answer never calls Twilio", async () => {
  let calls = 0
  const fetchImpl = (async () => {
    calls += 1
    return new Response("{}", { status: 200 })
  }) as typeof fetch
  const upserts: unknown[] = []
  const r = await lookupLineType("+13105550100", { supabase: fakeSupabase({ line_type: "landline", carrier: "Frontier" }, upserts), fetchImpl, accountSid: "AC", authToken: "x" })
  assert.deepEqual(r, { type: "landline", carrier: "Frontier", source: "cache" })
  assert.equal(calls, 0)
  assert.equal(upserts.length, 0)
})

test("line type · a fresh answer comes from Twilio and is written back", async () => {
  const seen: string[] = []
  const fetchImpl = (async (url: string | URL | Request) => {
    seen.push(String(url))
    return new Response(JSON.stringify({ line_type_intelligence: { type: "mobile", carrier_name: "T-Mobile USA" } }), { status: 200 })
  }) as typeof fetch
  const upserts: Array<Record<string, unknown>> = []
  const r = await lookupLineType("+13105550100", { supabase: fakeSupabase(null, upserts), fetchImpl, accountSid: "AC", authToken: "x" })
  assert.deepEqual(r, { type: "mobile", carrier: "T-Mobile USA", source: "twilio" })
  assert.match(seen[0], /lookups\.twilio\.com\/v2\/PhoneNumbers\/%2B13105550100\?Fields=line_type_intelligence$/)
  assert.equal(upserts.length, 1)
  assert.equal(upserts[0].phone_e164, "+13105550100")
  assert.equal(upserts[0].line_type, "mobile")
})

test("line type · Twilio down, no credentials, or a timeout = unknown, nothing cached", async () => {
  const upserts: unknown[] = []
  const down = (async () => new Response("nope", { status: 503 })) as typeof fetch
  assert.deepEqual(await lookupLineType("+13105550100", { supabase: fakeSupabase(null, upserts), fetchImpl: down, accountSid: "AC", authToken: "x" }), { type: "unknown", carrier: null, source: "none" })
  const throwing = (async () => { throw new Error("socket hang up") }) as typeof fetch
  assert.deepEqual(await lookupLineType("+13105550100", { supabase: fakeSupabase(null, upserts), fetchImpl: throwing, accountSid: "AC", authToken: "x" }), { type: "unknown", carrier: null, source: "none" })
  assert.deepEqual(await lookupLineType("+13105550100", { supabase: fakeSupabase(null, upserts), fetchImpl: down, accountSid: "", authToken: "" }), { type: "unknown", carrier: null, source: "none" })
  assert.equal(upserts.length, 0)
})
