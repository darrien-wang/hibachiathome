import assert from "node:assert/strict"
import { test } from "node:test"

import { buildEvent, fbcFrom, isDecline, normalizePhone, sha256 } from "../lib/meta-capi"

test("phones become E.164 digits, US by default", () => {
  assert.equal(normalizePhone("(626) 555-0101"), "16265550101")
  assert.equal(normalizePhone("+1 626-555-0101"), "16265550101")
  assert.equal(normalizePhone("555-0101"), "")
  assert.equal(normalizePhone(null), "")
})

test("fbc carries the click time in ms and the fbclid", () => {
  assert.equal(fbcFrom("IwAR123", "2026-10-14T17:00:00.000Z"), `fb.1.${Date.parse("2026-10-14T17:00:00.000Z")}.IwAR123`)
  assert.equal(fbcFrom("", "2026-10-14T17:00:00.000Z"), undefined)
})

test("a reply that says no is not a Contact", () => {
  for (const t of ["STOP", "stop", "Cancel", "No thanks", "not interested", "Wrong number", "", "  "]) assert.equal(isDecline(t), true, t)
  for (const t of ["Yes!", "How much for 20?", "Nope, Saturday works", "Is Nov 8 open?", "Notice we have 12 adults"]) assert.equal(isDecline(t), false, t)
})

test("Purchase goes out as a website event with hashed contact and value", () => {
  const e = buildEvent({
    eventName: "Purchase",
    eventId: "pi_123",
    eventTime: "2026-10-14T17:00:00.000Z",
    valueCents: 123450,
    user: { email: " Jane@Example.com ", phone: "6265550101", fbclid: "IwAR123", clickedAt: "2026-10-12T00:00:00.000Z", userAgent: "Mozilla/5.0", ip: "1.2.3.4", externalId: "lead-1" },
  })
  assert.equal(e.action_source, "website")
  assert.equal(e.event_id, "pi_123")
  assert.equal(e.event_time, Math.floor(Date.parse("2026-10-14T17:00:00.000Z") / 1000))
  assert.deepEqual(e.custom_data, { currency: "USD", value: 1234.5 })
  const u = e.user_data as Record<string, unknown>
  assert.deepEqual(u.em, [sha256("jane@example.com")])
  assert.deepEqual(u.ph, [sha256("16265550101")])
  assert.equal(u.client_user_agent, "Mozilla/5.0")
  assert.ok(String(u.fbc).endsWith(".IwAR123"))
})

test("without the browser's user agent the event is system_generated and has no value for Contact", () => {
  const e = buildEvent({ eventName: "Contact", eventId: "reply-1", eventTime: "2026-10-14T17:00:00.000Z", user: { phone: "6265550101" } })
  assert.equal(e.action_source, "system_generated")
  assert.equal(e.event_source_url, undefined)
  assert.equal(e.custom_data, undefined)
})
