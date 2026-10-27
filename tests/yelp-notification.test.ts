import { test } from "node:test"
import assert from "node:assert/strict"
import { parseYelpNotification, yelpFirstName, yelpLeadName } from "../lib/yelp-notification"

const REPLY = "reply+914e99efd0ce428581bf819760d09d43@messaging.yelp.com"

test("a Request a Quote becomes a named request with guests and ZIP", () => {
  const body = [
    "Alex requested a quote from Real Hibachi At Home for a catering.",
    "Approximately how many people will attend this event?",
    "",
    "25–100",
    "",
    "When do you require this service?",
    "2025-11-15, 2025-11-22",
    "In what location do you need the service?",
    "",
    "91775",
  ].join("\n")
  assert.deepEqual(parseYelpNotification(REPLY, "You received a new lead on Yelp!", body), { name: "Alex", kind: "request", replyTo: REPLY, guests: 25, zip: "91775" })
  assert.deepEqual(
    parseYelpNotification(REPLY, "New Lead: Reply to Sam's personal chefs request", "Sam requested a quote ... In what location do you need the service?\n\n90274"),
    { name: "Sam", kind: "request", replyTo: REPLY, guests: null, zip: "90274" },
  )
})

test("follow-up messages and reminders file on the customer, guests read from free text", () => {
  const body = "Hello can you please provide quote for 20 people for Saturday November 14. In what location do you need the service? 92649"
  assert.deepEqual(parseYelpNotification(REPLY, "Message from Jordan Q. for Real Hibachi", body), { name: "Jordan Q.", kind: "message", replyTo: REPLY, guests: 20, zip: "92649" })
  assert.deepEqual(parseYelpNotification("no-reply@yelp.com", "New Reply Message from Steve S.", "Steve has replied to your message"), { name: "Steve S.", kind: "message", replyTo: null, guests: null, zip: null })
  assert.equal(parseYelpNotification(REPLY, "Message from Kyle B. for Real Hibachi", "January 5 in temple city from 7 pm to midnight 50 guests")?.guests, 50)
})

test("a refused e-mailed reply is flagged, not a new customer message", () => {
  const body = "Thank you for replying to this message. However, you cannot reply to your Yelp messages via email after 10 days."
  assert.deepEqual(parseYelpNotification("no-reply@yelp.com", "RE: Message from Kyle B. for Real Hibachi", body), { name: "Kyle B.", kind: "reply_failed", replyTo: null, guests: null, zip: null })
})

test("reviews, ad offers and non-Yelp senders stay filtered", () => {
  assert.equal(parseYelpNotification("no-reply@yelp.com", "Pat R. reviewed your business", "..."), null)
  assert.equal(parseYelpNotification("jayking@yelp.com", "We're so confident, your first $350 is on us", "..."), null)
  assert.equal(parseYelpNotification("jane@gmail.com", "Message from Jane for Real Hibachi", "..."), null)
})

test("lead names and first-name matching", () => {
  assert.equal(yelpLeadName({ name: "Jordan Q." }), "Jordan Q. (Yelp)")
  assert.equal(yelpLeadName({ name: "" }), "Yelp customer")
  assert.equal(yelpFirstName("Jordan Q."), "Jordan")
})
