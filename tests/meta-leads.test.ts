import assert from "node:assert/strict"
import { test } from "node:test"
import { parseGuests, parseLead, parsePartyDate } from "../lib/meta-leads"

const today = "2026-10-21"

test("parsePartyDate: the ways people type a date", () => {
  assert.equal(parsePartyDate("11/15", today), "2026-11-15")
  assert.equal(parsePartyDate("11/15/26", today), "2026-11-15")
  assert.equal(parsePartyDate("11/15/2026", today), "2026-11-15")
  assert.equal(parsePartyDate("Nov 15", today), "2026-11-15")
  assert.equal(parsePartyDate("November 15th", today), "2026-11-15")
  assert.equal(parsePartyDate("Sat, Nov 15 2026", today), "2026-11-15")
  assert.equal(parsePartyDate("15 Nov", today), "2026-11-15")
  assert.equal(parsePartyDate("2026-12-31", today), "2026-12-31")
  // A month/day already gone this year is next year's.
  assert.equal(parsePartyDate("Feb 26", today), "2027-02-26")
  assert.equal(parsePartyDate("2/26", today), "2027-02-26")
  // Today itself still counts.
  assert.equal(parsePartyDate("10/21", today), "2026-10-21")
})

test("parsePartyDate: no date is no date", () => {
  for (const t of ["not sure yet", "TBD", "flexible", "sometime in December", "", "next weekend"]) {
    assert.equal(parsePartyDate(t, today), "", t)
  }
  // An impossible date is no date, not a crash.
  assert.equal(parsePartyDate("2/30", today), "")
})

test("parseGuests takes the first number", () => {
  assert.equal(parseGuests("20"), 20)
  assert.equal(parseGuests("about 20 people"), 20)
  assert.equal(parseGuests("15-20"), 15)
  assert.equal(parseGuests("twelve"), 0)
})

test("parseLead maps Meta field names onto the quote body", () => {
  const lead = parseLead(
    {
      id: "1",
      created_time: "2026-10-21T20:00:00+0000",
      field_data: [
        { name: "full_name", values: ["Maria Lopez"] },
        { name: "phone_number", values: ["+13105551234"] },
        { name: "email", values: ["maria@example.com"] },
        { name: "guests", values: ["18 adults"] },
        { name: "party_date", values: ["Dec 5"] },
        { name: "city_zip", values: ["Downey"] },
      ],
    },
    today,
  )
  assert.equal(lead.name, "Maria Lopez")
  assert.equal(lead.phone, "+13105551234")
  assert.equal(lead.email, "maria@example.com")
  assert.equal(lead.adults, 18)
  assert.equal(lead.eventDate, "2026-12-05")
  assert.equal(lead.cityText, "Downey")
})

test("parseLead falls back to first + last name and loose field names", () => {
  const lead = parseLead(
    {
      id: "2",
      created_time: "2026-10-21T20:00:00+0000",
      field_data: [
        { name: "first_name", values: ["Jo"] },
        { name: "last_name", values: ["Kim"] },
        { name: "phone_number", values: ["+16265550000"] },
        { name: "how_many_guests_are_coming?", values: ["about 25"] },
        { name: "what_date_is_the_party?", values: ["not sure"] },
        { name: "which_city_or_zip?", values: ["92262"] },
      ],
    },
    today,
  )
  assert.equal(lead.name, "Jo Kim")
  assert.equal(lead.adults, 25)
  assert.equal(lead.eventDate, "")
  assert.equal(lead.cityText, "92262")
})
