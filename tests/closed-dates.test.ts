import { test } from "node:test"
import assert from "node:assert/strict"
import { closedDateMessage, closedDayLabel, isDateClosed } from "../lib/closed-dates"

// A stand-in for supabase.from("closed_dates").select("day").eq("day", d).limit(1).
function fakeDb(rows: string[] | "error" | "throws") {
  return {
    from(table: string) {
      assert.equal(table, "closed_dates")
      return {
        select() {
          return {
            eq(_col: string, day: string) {
              return {
                async limit() {
                  if (rows === "throws") throw new Error("network")
                  if (rows === "error") return { data: null, error: { message: "relation does not exist" } }
                  return { data: rows.filter((r) => r === day).map((day) => ({ day })), error: null }
                },
              }
            },
          }
        },
      }
    },
  } as never
}

// Owner 2026-11-19: "12/5 号现在可以关闭了 不能再接了".
test("a day with a row is closed; other days and bad input are open", async () => {
  const db = fakeDb(["2026-12-05"])
  assert.equal(await isDateClosed(db, "2026-12-05"), true)
  assert.equal(await isDateClosed(db, "2026-12-06"), false)
  assert.equal(await isDateClosed(db, ""), false)
  assert.equal(await isDateClosed(db, null), false)
  assert.equal(await isDateClosed(db, "Dec 5"), false)
  assert.equal(await isDateClosed(null, "2026-12-05"), false)
})

test("when the table cannot be read, the day counts as open", async () => {
  assert.equal(await isDateClosed(fakeDb("error"), "2026-12-05"), false)
  assert.equal(await isDateClosed(fakeDb("throws"), "2026-12-05"), false)
})

test("the lock page says the day is fully booked, in words a customer reads", () => {
  assert.equal(closedDayLabel("2026-12-05"), "Saturday, Dec 5")
  assert.equal(
    closedDateMessage("2026-12-05"),
    "Saturday, Dec 5 is fully booked. Please text us at (213) 770-7788 and we'll help you find another time.",
  )
})
