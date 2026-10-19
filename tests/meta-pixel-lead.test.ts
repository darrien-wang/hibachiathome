import assert from "node:assert/strict"
import { test } from "node:test"

import { metaPixelEventFor, metaVisitorFrom } from "../lib/tracking"

test("a Meta visitor is recognised from the click in the URL or, on a bare landing, from the stored click", () => {
  assert.equal(metaVisitorFrom("?fbclid=IwAR1", {}), true)
  assert.equal(metaVisitorFrom("?utm_source=facebook&utm_medium=paid_social", {}), true)
  assert.equal(metaVisitorFrom("?utm_source=instagram", {}), true)
  assert.equal(metaVisitorFrom("", { fbclid: "IwAR1" }), true)
  assert.equal(metaVisitorFrom("", { utm_source: "facebook" }), true)
  assert.equal(metaVisitorFrom("", {}), false)
  assert.equal(metaVisitorFrom("?utm_source=google&utm_medium=cpc&gclid=G1", {}), false)
})

test("a new touch in the URL overrides a stored Meta click (the cookie may still be last visit's)", () => {
  assert.equal(metaVisitorFrom("?utm_source=google&utm_medium=cpc&gclid=G1", { fbclid: "IwAR1", utm_source: "facebook" }), false)
  assert.equal(metaVisitorFrom("?gclid=G1", { fbclid: "IwAR1" }), false)
  assert.equal(metaVisitorFrom("?ref=home", { fbclid: "IwAR1" }), true)
})

test("a landing quote going out is Meta's Lead; a no-date price check is not", () => {
  assert.equal(metaPixelEventFor("quote_sent", {}), "Lead")
  assert.equal(metaPixelEventFor("quote_sent", { price_check: true }), "PriceCheck")
})

test("form submits are Leads, except the landing card's contact step (its quote reports instead)", () => {
  assert.equal(metaPixelEventFor("booking_submit", { contact_surface: "quote_form" }), "Lead")
  assert.equal(metaPixelEventFor("booking_submit", { contact_surface: "landing_estimator" }), null)
  assert.equal(metaPixelEventFor("contact_booking_inquiry_submit", {}), "Lead")
  assert.equal(metaPixelEventFor("chat_lead_submitted", {}), "Lead")
})

test("button taps no longer count as Meta Leads", () => {
  for (const n of ["contact_sms_click", "contact_call_click", "contact_email_click", "sms_click", "phone_click", "lead_start", "quote_started"]) {
    assert.equal(metaPixelEventFor(n, {}), null, n)
  }
})
