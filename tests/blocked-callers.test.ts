import assert from "node:assert/strict"
import test from "node:test"
import { isBlockedNumber, loadBlockedDigits, noteBlockedCall } from "../lib/blocked-callers"

test("a blocked number matches however Twilio writes the caller", () => {
  const blocked = new Set(["2395177748"])
  assert.equal(isBlockedNumber(blocked, "+12395177748"), true)
  assert.equal(isBlockedNumber(blocked, "(239) 517-7748"), true)
  assert.equal(isBlockedNumber(blocked, "+12393455207"), false, "same area code is not the same caller")
  assert.equal(isBlockedNumber(blocked, "Anonymous"), false)
  assert.equal(isBlockedNumber(blocked, ""), false)
})

test("no database, or a failed read, blocks nobody - every call rings", async () => {
  assert.equal((await loadBlockedDigits(null)).size, 0)
  const broken = { from() { throw new Error("down") } } as never
  assert.equal((await loadBlockedDigits(broken)).size, 0)
})

test("rows read back as ten digits", async () => {
  const rows = [{ phone_digits: "2395177748" }, { phone_digits: "3462508989" }, { phone_digits: null }]
  const fake = { from: () => ({ select: async () => ({ data: rows }) }) } as never
  assert.deepEqual([...(await loadBlockedDigits(fake))].sort(), ["2395177748", "3462508989"])
})

test("counting a rejected call never throws", async () => {
  const calls: unknown[] = []
  await noteBlockedCall({ rpc: async (...args: unknown[]) => { calls.push(args) } } as never, "+12395177748")
  assert.deepEqual(calls, [["rh_note_blocked_call", { p_digits: "2395177748" }]])
  await noteBlockedCall({ rpc: async () => { throw new Error("down") } } as never, "+12395177748")
})
