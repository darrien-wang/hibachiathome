import assert from "node:assert/strict"
import test from "node:test"
import { isStaffNumber, loadStaffDigits, phoneDigits10 } from "../lib/staff-phones"

test("phone digits: E.164, dashes and a leading 1 all land on the same ten digits", () => {
  assert.equal(phoneDigits10("+19096685185"), "9096685185")
  assert.equal(phoneDigits10("909-668-5185"), "9096685185")
  assert.equal(phoneDigits10("1 (909) 668-5185"), "9096685185")
  assert.equal(phoneDigits10("668-5185"), "")
  assert.equal(phoneDigits10(null), "")
})

test("a staff number matches however Twilio or the workbench wrote it", () => {
  const staff = new Set(["9096685185", "8052438766"])
  assert.equal(isStaffNumber(staff, "+19096685185"), true)
  assert.equal(isStaffNumber(staff, "(805) 243-8766"), true)
  assert.equal(isStaffNumber(staff, "+19099965004"), false)
  assert.equal(isStaffNumber(staff, ""), false)
  assert.equal(isStaffNumber(new Set(), "+19096685185"), false)
})

test("no database, or a failed read, means nobody is staff - the inbox keeps working", async () => {
  assert.equal((await loadStaffDigits(null)).size, 0)
  const broken = { from() { throw new Error("down") } } as never
  assert.equal((await loadStaffDigits(broken)).size, 0)
})

test("staff rows with blank or short phones are skipped", async () => {
  const rows = [{ phone: "9096685185" }, { phone: "" }, { phone: "12345" }, { phone: "+1 626-885-0003" }]
  const fake = { from: () => ({ select: () => ({ not: async () => ({ data: rows }) }) }) } as never
  assert.deepEqual([...(await loadStaffDigits(fake))].sort(), ["6268850003", "9096685185"])
})
