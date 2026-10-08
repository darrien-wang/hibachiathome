// One customer, one answer: the brake that stops a second desk from answering
// the same customer message (lib/duplicate-brake.ts).
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { otherSenderJustAnswered, type ThreadLine } from "../lib/duplicate-brake"

const ME = "session-me"
const OTHER = "session-other"
const now = Date.parse("2026-10-08T19:30:00Z")
const min = (n: number) => new Date(now - n * 60_000).toISOString()
const WINDOW = 15 * 60_000
const line = (sid: string, direction: "inbound" | "outbound", agoMin: number, body: string): ThreadLine => ({ sid, direction, at: min(agoMin), body })
const senders = (map: Record<string, string | null>) => (sid: string) => (sid in map ? map[sid] : null)

test("dup · another desk answered 4 minutes ago and the customer is silent: blocked", () => {
  const thread = [line("IN1", "inbound", 6, "Do you bring sake?"), line("OUT1", "outbound", 4, "Yes - sake is on us.")]
  const hit = otherSenderJustAnswered(thread, senders({ OUT1: OTHER }), ME, now, WINDOW)
  assert.ok(hit)
  assert.equal(hit!.by, OTHER)
})

test("dup · the same desk adding a second line is fine", () => {
  const thread = [line("IN1", "inbound", 6, "Do you bring sake?"), line("OUT1", "outbound", 4, "Yes - sake is on us.")]
  assert.equal(otherSenderJustAnswered(thread, senders({ OUT1: ME }), ME, now, WINDOW), null)
})

test("dup · the customer spoke again after the other desk's answer: fine", () => {
  const thread = [
    line("IN1", "inbound", 9, "Do you bring sake?"),
    line("OUT1", "outbound", 8, "Yes - sake is on us."),
    line("IN2", "inbound", 2, "Is it chilled?"),
  ]
  assert.equal(otherSenderJustAnswered(thread, senders({ OUT1: OTHER }), ME, now, WINDOW), null)
})

test("dup · outside the window or an automated quote does not block", () => {
  assert.equal(otherSenderJustAnswered([line("OUT1", "outbound", 16, "Hi - just checking in")], senders({ OUT1: OTHER }), ME, now, WINDOW), null)
  assert.equal(otherSenderJustAnswered([line("OUT1", "outbound", 1, "Real Hibachi: your price is $599")], senders({}), ME, now, WINDOW), null)
})

test("dup · an unknown sender (the machine's first response) counts as someone else", () => {
  const thread = [line("OUT1", "outbound", 2, "Hi! Bling from Real Hibachi 👋 Saw your quote for 15 - which date?")]
  const hit = otherSenderJustAnswered(thread, senders({}), ME, now, WINDOW)
  assert.ok(hit)
  assert.equal(hit!.by, null)
})

test("dup · my own line after the other desk's does not hide theirs", () => {
  const thread = [
    line("IN1", "inbound", 10, "What time do you arrive?"),
    line("OUT1", "outbound", 8, "Around 5:30 to set up."),
    line("OUT2", "outbound", 3, "And the show starts at 6."),
  ]
  const hit = otherSenderJustAnswered(thread, senders({ OUT1: OTHER, OUT2: ME }), ME, now, WINDOW)
  assert.ok(hit)
  assert.equal(hit!.body, "Around 5:30 to set up.")
})
