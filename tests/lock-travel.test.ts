// Layer-1 self-test: travel on the order, settled when the customer locks the
// date (lib/lock-travel.ts), and what the deposit event then tells the order
// system (lib/crm-integration.ts). The map services are faked - no network.
// The cases are the 2026-10-21 orders that all came in at $0 travel:
//   RH-20261022-7105  Desert Hot Springs, 94 mi, quoted $641 incl. ~$42 travel
//   RH-20261022-5789  Lancaster, 93 mi, travel waived by the owner on the phone
//   RH-20261022-0063  "210 Georgina Avenue" - no city, no zip
//   10-20 Indio party, link said "Palm Springs", quote included travel
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import type Stripe from "stripe"
import type { StandardAddress } from "../lib/address-standard"
import type { BaseDrive } from "../lib/base-drive"
import { buildDepositPaidEventEnvelope } from "../lib/crm-integration"
import { encodeDeal } from "../lib/custom-deal"
import { cityQuery, quotedTravel, resolveLockTravel, travelFromEstimate, type LockTravelDeps } from "../lib/lock-travel"

const std = (address: string, zip: string): StandardAddress => ({ address, street: address.split(",")[0], city: address.split(",")[1].trim(), zip, via: "census" })

/** Fake map services: what each typed address standardizes to, and the miles to each destination. */
function maps(standard: Record<string, StandardAddress>, miles: Record<string, number | "approx" | "fail">) {
  const routed: string[] = []
  const deps: LockTravelDeps = {
    origin: "91744",
    standardize: async (raw) => standard[raw] ?? null,
    drive: async (_origin, destination): Promise<BaseDrive> => {
      routed.push(destination)
      const m = miles[destination]
      if (m === undefined || m === "fail") return { ok: false, code: "destination_not_found" }
      const point = { lat: 0, lng: 0, label: destination }
      return { ok: true, approximate: false, result: { drivingMiles: m === "approx" ? 0 : m, provider: "osrm", origin: point, destination: point } }
    },
  }
  return { deps, routed }
}

const DHS = std("22400 Henry Rd, Desert Hot Springs, CA 92241", "92241")
const LANCASTER = std("44528 17th St W, Lancaster, CA 93534", "93534")
const GEORGINA = std("210 Georgina Ave, Santa Monica, CA 90402", "90402")

test("measured at the address the customer entered, with the quote's rule (RH-20261022-7105: $44, not $0)", async () => {
  const { deps } = maps({ "22400 Henry Rd, Desert Hot Springs, CA 92241, USA": DHS }, { [DHS.address]: 94 })
  const t = await resolveLockTravel({ address: "22400 Henry Rd, Desert Hot Springs, CA 92241, USA", cityHint: "Palm Springs", quotedFee: 42, waived: false }, deps)
  assert.equal(t.source, "address")
  assert.equal(t.miles, 94)
  assert.equal(t.fee, 44, "first 50 miles free, then $1 a mile - the address, not the quote's Palm Springs")
  assert.equal(t.address, "22400 Henry Rd, Desert Hot Springs, CA 92241")
  assert.equal(t.standardized, true)
  assert.equal(t.zip, "92241")
  assert.match(t.summary, /94 mi to the address -> \$44\.00/)
})

test("a signed waiver: $0 on purpose, the miles still recorded for chef pay (RH-20261022-5789)", async () => {
  const typed = "44528 17th street west Lancaster CA 93534"
  const { deps } = maps({ [typed]: LANCASTER }, { [LANCASTER.address]: 93 })
  const t = await resolveLockTravel({ address: typed, quotedFee: null, waived: true }, deps)
  assert.equal(t.fee, 0)
  assert.equal(t.miles, 93)
  assert.equal(t.waived, true)
  assert.equal(t.source, "address")
  assert.equal(t.address, "44528 17th St W, Lancaster, CA 93534")
  assert.match(t.summary, /waived by the deal \(would be \$43\.00\)/)
})

test("a bare street line gets its city and zip, then is measured (RH-20261022-0063)", async () => {
  const { deps, routed } = maps({ "210 Georgina Avenue": GEORGINA }, { [GEORGINA.address]: 34.8 })
  const t = await resolveLockTravel({ address: "210 Georgina Avenue", cityHint: "Santa Monica", quotedFee: 0, waived: false }, deps)
  assert.equal(t.address, "210 Georgina Ave, Santa Monica, CA 90402")
  assert.equal(t.zip, "90402")
  assert.deepEqual(routed, [GEORGINA.address])
  assert.equal(t.fee, 0, "inside the free 50 miles")
  assert.equal(t.miles, 34.8)
})

test("only a town on the link: the town is measured, and the order keeps what was typed (10-20 Indio party)", async () => {
  const { deps } = maps({}, { "Palm Springs, CA": 92.1 })
  const t = await resolveLockTravel({ address: "Palm Springs", quotedFee: 42, waived: false }, deps)
  assert.equal(t.source, "city")
  assert.equal(t.fee, 42.1)
  assert.equal(t.address, "Palm Springs")
  assert.equal(t.standardized, false)
  assert.match(t.summary, /a town, no street address yet/)
})

test("a street nobody can place is never routed on its own: the quoted town is measured instead", async () => {
  const { deps, routed } = maps({}, { "Irvine, CA": 32.7, "123 Main St": 1879 })
  const t = await resolveLockTravel({ address: "123 Main St", cityHint: "Irvine", quotedFee: null, waived: false }, deps)
  assert.deepEqual(routed, ["Irvine, CA"])
  assert.equal(t.source, "city")
  assert.equal(t.address, "123 Main St", "kept as typed - nobody could pin it down")
})

test("not measurable - a region, no address, the map down: the travel in the customer's quote stands", async () => {
  for (const address of ["LA & Orange County", null, "TBD"]) {
    const { deps } = maps({}, {})
    const t = await resolveLockTravel({ address, quotedFee: 42, waived: false }, deps)
    assert.equal(t.source, "quote", String(address))
    assert.equal(t.fee, 42)
    assert.equal(t.miles, null)
  }
  const { deps } = maps({ "22400 Henry Rd, Desert Hot Springs, CA 92241": DHS }, { [DHS.address]: "fail" })
  const down = await resolveLockTravel({ address: "22400 Henry Rd, Desert Hot Springs, CA 92241", quotedFee: 42, waived: false }, deps)
  assert.equal(down.source, "quote")
  assert.equal(down.fee, 42)
  assert.equal(down.address, DHS.address, "still standardized even though routing failed")
  assert.match(down.summary, /not measured \(could not measure/)
})

test("nothing measured and nothing quoted: unknown, said out loud - never a silent $0", async () => {
  const { deps } = maps({}, {})
  const t = await resolveLockTravel({ address: "LA & Orange County", quotedFee: null, waived: false }, deps)
  assert.equal(t.source, "none")
  assert.equal(t.fee, null)
  assert.match(t.summary, /^UNKNOWN/)
  const waived = await resolveLockTravel({ address: null, quotedFee: null, waived: true }, deps)
  assert.equal(waived.fee, 0)
  assert.equal(waived.waived, true)
})

test("a lookup that hangs gives up at the deadline and falls back to the quote", async () => {
  const deps: LockTravelDeps = {
    origin: "91744",
    standardize: async () => null,
    drive: () => new Promise<BaseDrive>(() => {}),
    deadlineMs: 30,
  }
  const t = await resolveLockTravel({ address: "Palm Springs", quotedFee: 42, waived: false }, deps)
  assert.equal(t.source, "quote")
  assert.equal(t.fee, 42)
  assert.match(t.summary, /timed out/)
})

test("quotedTravel: the texted quote first, then the link's estimate, then the published town travel", () => {
  assert.equal(quotedTravel({ textedQuote: { travelFee: 42, travelPending: false } }), 42)
  // A quote that left travel "to be confirmed from your address" said nothing about it.
  assert.equal(quotedTravel({ textedQuote: { travelFee: 0, travelPending: true }, place: "Palm Springs" }), 42)
  assert.equal(quotedTravel({ textedQuote: { travelFee: 0, travelPending: false }, place: "Palm Springs" }), 0, "a quote that said no travel")
  // RH-20261022-7105's workbench link: $641 for 9 adults on a Friday = $599 food + $42.
  assert.equal(quotedTravel({ estimate: { amount: 641, adults: 9, kids: 0, eventDate: "2026-10-23" } }), 42)
  assert.equal(quotedTravel({ estimate: { amount: 599, adults: 9, kids: 0, eventDate: "2026-10-23" }, place: "Temecula" }), 20, "no travel in the estimate: the town's published travel")
  assert.equal(quotedTravel({ place: "LA & Orange County" }), null)
  assert.equal(quotedTravel({}), null)
})

test("travelFromEstimate reads the weekday price the quote used, and ignores rounding", () => {
  assert.equal(travelFromEstimate({ estimate: 641, adults: 9, kids: 0, eventDate: "2026-10-23" }), 42)
  assert.equal(travelFromEstimate({ estimate: 599.4, adults: 9, kids: 0, eventDate: "2026-10-23" }), 0)
  assert.equal(travelFromEstimate({ estimate: null, adults: 9, kids: 0 }), null)
  assert.equal(travelFromEstimate({ estimate: 641, adults: 0, kids: 0 }), null)
})

test("cityQuery: a town or a bare ZIP the router can find; a region is not one", () => {
  assert.equal(cityQuery("Palm Springs"), "Palm Springs, CA")
  assert.equal(cityQuery("Santa Monica, CA"), "Santa Monica, CA")
  assert.equal(cityQuery("Santa Monica"), "Santa Monica, CA", "the 'ca' in Monica is not the state")
  assert.equal(cityQuery("92201"), "Indio, CA 92201")
  assert.equal(cityQuery("LA & Orange County"), null)
  assert.equal(cityQuery("Southern California"), null)
  assert.equal(cityQuery(""), null)
})

// ---- what the order system receives ------------------------------------------------

const session = (metadata: Record<string, string>) =>
  ({
    id: "cs_test_lock",
    object: "checkout.session",
    created: 1761102513,
    livemode: false,
    amount_total: 0,
    client_reference_id: null,
    customer_details: { email: "host@example.com", name: "Test Host", phone: null },
    customer_email: null,
    metadata,
  }) as unknown as Stripe.Checkout.Session

const booking = {
  id: "bb576c00-721d-45fe-8519-0f78d3455cf8",
  full_name: "Test Host",
  email: "host@example.com",
  phone: "+15555550100",
  event_date: "2026-10-23",
  event_time: "18:00",
  address: "22400 Henry Rd, Desert Hot Springs, CA 92241",
  guest_adults: 9,
  guest_kids: 0,
  total_cost: 0,
  travel_fee: 44,
  special_requests: "Auto-generated booking for deposit checkout | deposit_source=workbench",
  deposit_amount: 0,
}
const cardOnFile = { setupIntentId: "seti_test", customerId: "cus_test", paymentMethodId: "pm_test", brand: "visa", last4: "4242", funding: "credit" as const }

test("the deposit event carries the measured travel and the standard address", async () => {
  const { deps } = maps({ "22400 Henry Rd, Desert Hot Springs, CA 92241, USA": DHS }, { [DHS.address]: 94 })
  const travel = await resolveLockTravel({ address: "22400 Henry Rd, Desert Hot Springs, CA 92241, USA", quotedFee: 42, waived: false }, deps)
  const built = buildDepositPaidEventEnvelope({
    stripeEventId: "evt_test",
    session: session({ location: "22400 Henry Rd, Desert Hot Springs, CA 92241, USA", event_date: "2026-10-23" }),
    booking,
    cardOnFile,
    travel,
  })
  assert.ok(built.ok)
  const order = built.envelope.order
  assert.equal(order.event_address, "22400 Henry Rd, Desert Hot Springs, CA 92241")
  assert.deepEqual(
    { fee: order.invoice_details?.travel_fee, miles: order.invoice_details?.travel_miles, source: order.invoice_details?.travel_source, waived: order.invoice_details?.travel_waived },
    { fee: 44, miles: 94, source: "address", waived: undefined },
  )
})

test("a waiver rides as travel_waived with the deal; unknown travel is left out, not sent as $0", async () => {
  const { deps } = maps({}, { [LANCASTER.address]: 93 })
  const waived = await resolveLockTravel({ address: LANCASTER.address, quotedFee: null, waived: true }, { ...deps, standardize: async () => LANCASTER })
  const deal = encodeDeal({ travelWaived: true })
  const built = buildDepositPaidEventEnvelope({ stripeEventId: "evt_w", session: session({ custom_deal: deal }), booking: { ...booking, travel_fee: 0 }, cardOnFile, travel: waived })
  assert.ok(built.ok)
  const details = built.envelope.order.invoice_details
  assert.equal(details?.travel_fee, 0)
  assert.equal(details?.travel_miles, 93)
  assert.equal(details?.travel_waived, true)
  assert.equal(details?.custom_deal?.travelWaived, true)

  const unknown = await resolveLockTravel({ address: "LA & Orange County", quotedFee: null, waived: false }, maps({}, {}).deps)
  const blind = buildDepositPaidEventEnvelope({ stripeEventId: "evt_u", session: session({}), booking: { ...booking, address: "LA & Orange County", travel_fee: 0 }, cardOnFile, travel: unknown })
  assert.ok(blind.ok)
  const raw = JSON.parse(JSON.stringify(blind.envelope.order.invoice_details)) as Record<string, unknown>
  assert.equal("travel_fee" in raw, false, "no placeholder $0 on the wire")
  assert.equal(raw.travel_source, "none")
  assert.equal(blind.envelope.order.event_address, "LA & Orange County")
})

test("without a lock-travel result the event is exactly what it was before", () => {
  const built = buildDepositPaidEventEnvelope({ stripeEventId: "evt_old", session: session({}), booking: { ...booking, travel_fee: 0 }, cardOnFile })
  assert.ok(built.ok)
  const raw = JSON.parse(JSON.stringify(built.envelope.order.invoice_details)) as Record<string, unknown>
  assert.deepEqual(raw, { total_cost: 0, travel_fee: 0 })
})
