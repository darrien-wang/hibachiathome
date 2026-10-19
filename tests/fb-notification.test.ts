import { test } from "node:test"
import assert from "node:assert/strict"
import { facebookLeadName, parseFacebookNotification } from "../lib/fb-notification"

test("Messenger message notifications become a named lead", () => {
  assert.deepEqual(parseFacebookNotification("notification@facebookmail.com", "Nam sent you a message.", "Hi! I'm interested in your in-home hibachi..."), { name: "Nam", kind: "messenger" })
  assert.deepEqual(parseFacebookNotification("notification@facebookmail.com", "New message from Maria Lopez", "..."), { name: "Maria Lopez", kind: "messenger" })
  assert.deepEqual(parseFacebookNotification("notification@facebookmail.com", "Nam 给你发了一条消息", "..."), { name: "Nam", kind: "messenger" })
})

test("Marketplace mail is tagged marketplace, with or without a parsed name", () => {
  assert.deepEqual(parseFacebookNotification("marketplace@facebookmail.com", "Nam is interested in your listing", "Hibachi Show at Your Home"), { name: "Nam", kind: "marketplace" })
  assert.deepEqual(parseFacebookNotification("notification@facebookmail.com", "Nam sent you a message", "You have a new Marketplace message about Hibachi Show at Your Home"), { name: "Nam", kind: "marketplace" })
  assert.deepEqual(parseFacebookNotification("marketplace@facebookmail.com", "Marketplace: you have a new message", "A buyer messaged you"), { name: "", kind: "marketplace" })
  assert.equal(facebookLeadName({ name: "", kind: "marketplace" }), "Facebook Marketplace buyer")
  assert.equal(facebookLeadName({ name: "Nam", kind: "messenger" }), "Nam (Facebook)")
})

test("other Facebook mail and other senders stay filtered", () => {
  assert.equal(parseFacebookNotification("notification@facebookmail.com", "You have 3 new notifications", "..."), null)
  assert.equal(parseFacebookNotification("security@facebookmail.com", "Your Facebook password was changed", "..."), null)
  assert.equal(parseFacebookNotification("notification@facebookmail.com", "Shiqi Wang wants to be your friend", "..."), null)
  assert.equal(parseFacebookNotification("jane@gmail.com", "Jane sent you a message", "..."), null)
})
