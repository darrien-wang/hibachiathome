// Layer-2 self-test: the Meta lead-form sync says when it is broken
// (2026-10-22). It failed silently for 17 hours on 10-21/22 while three form
// leads waited; now half an hour of failures mails ops, then every 12 hours,
// and a recovery mails once.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { alertDue, failingMail, nextHealth, readHealth, recoveredMail, META_LEADS_ALERT_EVERY, META_LEADS_ALERT_FIRST } from "../lib/meta-leads-health"

const T0 = Date.parse("2026-10-22T16:00:00Z")
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString()
const PERM = "Graph 1278206205381427/leadgen_forms: (#200) Requires pages_manage_ads permission to manage the object (code 200)"

test("meta-leads health · mail on the 15th failure in a row, then every 360, never in between", () => {
  assert.equal(alertDue(1), false)
  assert.equal(alertDue(META_LEADS_ALERT_FIRST - 1), false)
  assert.equal(alertDue(META_LEADS_ALERT_FIRST), true)
  assert.equal(alertDue(META_LEADS_ALERT_FIRST + 1), false)
  assert.equal(alertDue(META_LEADS_ALERT_FIRST + META_LEADS_ALERT_EVERY - 1), false)
  assert.equal(alertDue(META_LEADS_ALERT_FIRST + META_LEADS_ALERT_EVERY), true)
  assert.equal(alertDue(META_LEADS_ALERT_FIRST + 2 * META_LEADS_ALERT_EVERY), true)
})

test("meta-leads health · a run of failures counts up, keeps the last good time, and alerts exactly once in the first half hour", () => {
  let h = readHealth({ fail_streak: 0, last_ok_at: at(-60) })
  let alerts = 0
  for (let i = 1; i <= 20; i++) {
    const r = nextHealth(h, { ok: false, error: PERM }, at(i * 2))
    h = r.health
    if (r.alert) alerts += 1
    assert.equal(r.recovered, false)
  }
  assert.equal(h.fail_streak, 20)
  assert.equal(alerts, 1)
  assert.equal(h.alerted_at, at(META_LEADS_ALERT_FIRST * 2))
  assert.equal(h.last_ok_at, at(-60))
  assert.equal(h.last_error, PERM)
})

test("meta-leads health · success resets the streak; it is a recovery only if it had alerted", () => {
  const failing = { ...readHealth(null), fail_streak: 40, last_ok_at: at(-80), last_error: PERM, alerted_at: at(-50) }
  const back = nextHealth(failing, { ok: true }, at(0))
  assert.equal(back.recovered, true)
  assert.equal(back.alert, false)
  assert.equal(back.health.fail_streak, 0)
  assert.equal(back.health.last_ok_at, at(0))
  assert.equal(back.health.last_error, null)
  const blip = nextHealth({ ...failing, fail_streak: 3 }, { ok: true }, at(0))
  assert.equal(blip.recovered, false, "a few failed sweeps that never alerted are not news")
})

test("meta-leads health · a missing or broken row starts clean", () => {
  assert.deepEqual(readHealth(null), { fail_streak: 0, last_attempt_at: null, last_ok_at: null, last_error: null, alerted_at: null })
  assert.equal(readHealth({ fail_streak: -3 }).fail_streak, 0)
  assert.equal(readHealth({ fail_streak: "7" }).fail_streak, 0)
  assert.equal(readHealth("oops").fail_streak, 0)
})

test("meta-leads health · the mails say what is waiting and what fixes it", () => {
  const h = { fail_streak: 15, last_attempt_at: at(0), last_ok_at: null, last_error: PERM, alerted_at: at(0) }
  const m = failingMail(h, T0)
  assert.equal(m.subject, "⚠️ Meta 表单线索拉不下来 · 连续失败 15 次")
  assert.match(m.text, /上线以来还没成功过/)
  assert.match(m.text, /收不到报价短信/)
  assert.match(m.text, /pages_manage_ads permission/)
  assert.match(m.text, /META_LEADS_TOKEN/)
  const m2 = failingMail({ ...h, last_ok_at: new Date(T0 - 17 * 3600_000).toISOString() }, T0)
  assert.match(m2.text, /距上次成功 17 小时/)
  const r = recoveredMail({ ...h, fail_streak: 510, last_ok_at: new Date(T0 - 17 * 3600_000).toISOString() }, T0)
  assert.equal(r.subject, "✅ Meta 表单线索恢复了")
  assert.match(r.text, /连续失败 510 次（约 17 小时）/)
})
