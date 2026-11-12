// Layer-2 self-test: the Meta Conversions API sweep says when it is broken
// (2026-11-12). From 2026-10-26 it had a read refused on every 15-minute
// sweep for 17 days and nobody was told: pg_cron does not read what a sweep
// answers. Now an hour of failed sweeps mails ops, then every 12 hours, and a
// recovery mails once - the record the Meta lead-form sync keeps
// (lib/sweep-health.ts, tests/meta-leads-health.test.ts), with this sweep's
// own lines and mails. What the route does with it: tests/meta-capi-sweep.test.ts.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  META_CAPI_ALERT_EVERY,
  META_CAPI_ALERT_FIRST,
  META_CAPI_CADENCE,
  META_CAPI_HEALTH_KEY,
  SWEEP_READS,
  TOKEN_NOT_SET,
  failingMail,
  metaRefused,
  readRefused,
  recoveredMail,
  sentNotOnFile,
  sweepOutcome,
} from "../lib/meta-capi-health"
import { META_LEADS_HEALTH_KEY } from "../lib/meta-leads-health"
import { alertDue, nextHealth, readHealth, type SweepHealth } from "../lib/sweep-health"

// A sweep runs at :11 :26 :41 :56. This one is 2026-11-12 11:41 in Los Angeles.
const T0 = Date.parse("2026-11-12T19:41:00Z")
const at = (sweeps: number) => new Date(T0 + sweeps * 15 * 60_000).toISOString()
const REFUSED = readRefused("meta_click_context", "Bad Request")
const EXPIRED = { message: "Error validating access token: Session has expired on Thursday, 12-Nov-26 10:00:00 PST.", type: "OAuthException", code: 190, error_subcode: 463, fbtrace_id: "A1b2" }

test("meta-capi health · its own record, and its own lines: the 4th failure in a row is an hour of sweeps, 48 more are 12 hours", () => {
  assert.equal(META_CAPI_HEALTH_KEY, "meta_capi.health")
  assert.notEqual(META_CAPI_HEALTH_KEY, META_LEADS_HEALTH_KEY)
  assert.deepEqual(META_CAPI_CADENCE, { first: 4, every: 48 })
  assert.equal(META_CAPI_ALERT_FIRST * 15, 60)
  assert.equal(META_CAPI_ALERT_EVERY * 15, 12 * 60)
})

test("meta-capi health · mail on the 4th failure in a row, then every 48, never in between", () => {
  const due = (streak: number) => alertDue(streak, META_CAPI_CADENCE)
  assert.deepEqual([1, 2, 3, 4, 5].map(due), [false, false, false, true, false])
  assert.equal(due(META_CAPI_ALERT_FIRST + META_CAPI_ALERT_EVERY - 1), false)
  assert.equal(due(META_CAPI_ALERT_FIRST + META_CAPI_ALERT_EVERY), true)
  assert.equal(due(META_CAPI_ALERT_FIRST + META_CAPI_ALERT_EVERY + 1), false)
  assert.equal(due(META_CAPI_ALERT_FIRST + 2 * META_CAPI_ALERT_EVERY), true)
})

test("meta-capi health · a day of failed sweeps counts up, keeps the last good time, and mails after 1 hour, 13 hours and 25 hours", () => {
  let h = readHealth({ fail_streak: 0, last_ok_at: at(0) })
  const mailed: number[] = []
  for (let n = 1; n <= 100; n++) {
    const r = nextHealth(h, { ok: false, error: REFUSED }, at(n), META_CAPI_CADENCE)
    h = r.health
    if (r.alert) mailed.push(n)
    assert.equal(r.recovered, false)
  }
  assert.deepEqual(mailed, [4, 52, 100])
  assert.deepEqual(h, { fail_streak: 100, last_attempt_at: at(100), last_ok_at: at(0), last_error: REFUSED, alerted_at: at(100) })
})

test("meta-capi health · a sweep that works clears the streak; it is news only once a mail had gone out", () => {
  const failing: SweepHealth = { fail_streak: 9, last_attempt_at: at(9), last_ok_at: at(0), last_error: REFUSED, alerted_at: at(4) }
  const back = nextHealth(failing, { ok: true }, at(10), META_CAPI_CADENCE)
  assert.deepEqual({ alert: back.alert, recovered: back.recovered }, { alert: false, recovered: true })
  assert.deepEqual(back.health, { fail_streak: 0, last_attempt_at: at(10), last_ok_at: at(10), last_error: null, alerted_at: at(4) })
  assert.equal(nextHealth({ ...failing, fail_streak: 4 }, { ok: true }, at(5), META_CAPI_CADENCE).recovered, true)
  assert.equal(nextHealth({ ...failing, fail_streak: 3, alerted_at: null }, { ok: true }, at(4), META_CAPI_CADENCE).recovered, false, "three failed sweeps never mailed, so their end is not news")
})

test("meta-capi health · a sweep failed when its answer is anything but ok:true", () => {
  assert.deepEqual(sweepOutcome({ ok: true, sent: 0 }), { ok: true })
  assert.deepEqual(sweepOutcome({ ok: false, error: REFUSED }), { ok: false, error: REFUSED })
  assert.deepEqual(sweepOutcome({ ok: false, error: TOKEN_NOT_SET }), { ok: false, error: "META_CAPI_TOKEN not set" })
  for (const answer of [{}, { ok: "true" }, { ok: 1 }, { error: "" }, { ok: false, error: 500 }]) {
    assert.deepEqual(sweepOutcome(answer), { ok: false, error: "the sweep did not answer ok:true and gave no error" }, JSON.stringify(answer))
  }
})

test("meta-capi health · each failure is one line that says what it was", () => {
  assert.equal(REFUSED, "meta_click_context: Bad Request")
  assert.equal(metaRefused({ ok: false, status: 400, body: { error: EXPIRED } }), "Meta HTTP 400: Error validating access token: Session has expired on Thursday, 12-Nov-26 10:00:00 PST. (code 190/463)")
  assert.equal(
    metaRefused({ ok: false, status: 400, body: { error: { message: "Invalid parameter", code: 100, error_subcode: 2804003, error_user_title: "Event Timestamp Too Old", error_user_msg: "The timestamp for this event is too far in the past." } } }),
    "Meta HTTP 400: Invalid parameter (code 100/2804003) - Event Timestamp Too Old: The timestamp for this event is too far in the past.",
  )
  assert.equal(metaRefused({ ok: false, status: 0, body: { error: "no answer (fetch failed: ETIMEDOUT)" } }), "Meta: no answer (fetch failed: ETIMEDOUT)")
  assert.equal(metaRefused({ ok: false, status: 502, body: null }), "Meta HTTP 502: null")
  assert.equal(metaRefused({ ok: false, status: 500, body: { error: {} } }), "Meta HTTP 500: no message")
  assert.equal(
    sentNotOnFile(3, "permission denied for table meta_capi_events"),
    "meta_capi_events insert: permission denied for table meta_capi_events (3 sent to Meta and not on file: the next sweep sends them again)",
  )
})

test("meta-capi health · the mail says what failed, since when, what it costs and where to look", () => {
  const h: SweepHealth = { fail_streak: 4, last_attempt_at: at(4), last_ok_at: at(0), last_error: REFUSED, alerted_at: at(4) }
  const m = failingMail(h, Date.parse(at(4)))
  assert.equal(m.subject, "⚠️ Meta 回传（回话 / 锁单）出错 · 连续失败 4 次")
  assert.deepEqual(m.text.split("\n"), [
    "给 Meta 回传客人回话和锁单的任务（Conversions API，每 15 分钟一轮）已经连续失败 4 次。上次成功是 11-12 11:41（洛杉矶时间），1 小时前。",
    "",
    "最后一次错误：meta_click_context: Bad Request",
    "",
    "影响：这段时间客人的回话（Contact）和锁单（Purchase、Schedule）没有报给 Meta，Meta 不知道哪些广告点击带来了回话和订单，也就没法照着成交去找人。Meta 只收 7 天内的事件：7 天内修好，攒下的会在恢复后的第一轮自动补发；超过 7 天的补不了。",
    "",
    "去哪看：数据库拒绝了对 meta_click_context 的读取，所以这一轮什么都没发。看 Supabase 的 API 日志里 /rest/v1/meta_click_context 的 4xx：请求太长、字段改了名，或者权限变了。",
    "想重现又不真发事件：用管理员身份 POST /api/integrations/meta-capi?dry=1，只读库、列出这一轮要发的事件，读库出错会原样返回。连续失败的记录在 workbench_settings 的 meta_capi.health。",
  ])
  // The reminder, 12 hours on.
  const later = failingMail({ ...h, fail_streak: 52, last_attempt_at: at(52) }, Date.parse(at(52)))
  assert.equal(later.subject, "⚠️ Meta 回传（回话 / 锁单）出错 · 连续失败 52 次")
  assert.match(later.text, /已经连续失败 52 次。上次成功是 11-12 11:41（洛杉矶时间），13 小时前。/)
  // Failing from the first sweep the record ever saw.
  assert.match(failingMail({ ...h, last_ok_at: null }, Date.parse(at(4))).text, /已经连续失败 4 次。开始记录以来还没成功过。/)
})

test("meta-capi health · the mail reads each kind of failure for what it is", () => {
  const mail = (error: string) => failingMail({ fail_streak: 4, last_attempt_at: at(4), last_ok_at: at(0), last_error: error, alerted_at: at(4) }, Date.parse(at(4))).text
  const NOT_SENT = /没有报给 Meta.*7 天内修好，攒下的会在恢复后的第一轮自动补发/

  for (const read of SWEEP_READS) {
    const text = mail(readRefused(read, "Bad Request"))
    assert.match(text, new RegExp(`数据库拒绝了对 ${read} 的读取.*/rest/v1/${read} 的 4xx`))
    assert.match(text, NOT_SENT)
  }

  const token = mail(TOKEN_NOT_SET)
  assert.match(token, /最后一次错误：META_CAPI_TOKEN not set/)
  assert.match(token, /去哪看：Vercel 的环境变量 META_CAPI_TOKEN 是空的。.*生成访问令牌，填进去后重新部署。/)
  assert.match(token, NOT_SENT)

  for (const said of [metaRefused({ ok: false, status: 400, body: { error: EXPIRED } }), metaRefused({ ok: false, status: 0, body: { error: "no answer (fetch failed: ETIMEDOUT)" } })]) {
    const text = mail(said)
    assert.ok(text.includes(`最后一次错误：${said}`))
    assert.match(text, /去哪看：Meta 没收下这一批（拒收或者没有回应）.*多半是令牌失效或被撤销.*换掉 Vercel 的 META_CAPI_TOKEN 后重新部署/)
    assert.match(text, NOT_SENT)
  }

  // Sent and not on file is the other way round: Meta is getting the events, more than once.
  const twice = mail(sentNotOnFile(3, "permission denied for table meta_capi_events"))
  assert.match(twice, /影响：事件已经发给 Meta，但没能记进已发记录（meta_capi_events），所以每 15 分钟会把同一批再发一遍.*可能被重复计数/)
  assert.doesNotMatch(twice, /没有报给 Meta/)
  assert.match(twice, /去哪看：Supabase 里的 meta_capi_events 表/)
  // Also when an earlier batch of the same sweep was refused: what went out unrecorded is the urgent part.
  const mixed = mail(`${metaRefused({ ok: false, status: 400, body: { error: EXPIRED } })} | ${sentNotOnFile(12, "permission denied for table meta_capi_events")}`)
  assert.match(mixed, /影响：事件已经发给 Meta，但没能记进已发记录/)
  // A refused read of the same table is not that.
  assert.match(mail(readRefused("meta_capi_events", "Bad Request")), NOT_SENT)

  // Anything else: the function log.
  const crash = mail("Cannot read properties of undefined (reading 'id')")
  assert.match(crash, /去哪看：程序自己出错了（不是数据库拒绝读取，也不是 Meta 拒收）。看 Vercel 函数日志里的 \[meta-capi\]，sweep crashed 那一行带出错位置。/)
  assert.match(crash, NOT_SENT)
  assert.match(failingMail({ fail_streak: 4, last_attempt_at: at(4), last_ok_at: null, last_error: null, alerted_at: at(4) }, T0).text, /最后一次错误：-/)
})

test("meta-capi health · the mail on recovery says how long it was down and what went out", () => {
  const prev: SweepHealth = { fail_streak: 8, last_attempt_at: at(8), last_ok_at: at(0), last_error: REFUSED, alerted_at: at(4) }
  const r = recoveredMail(prev, Date.parse(at(9)), 3)
  assert.equal(r.subject, "✅ Meta 回传（回话 / 锁单）恢复了")
  assert.deepEqual(r.text.split("\n"), [
    "Meta 回传恢复了：之前连续失败 8 次（约 2.3 小时），这一轮成功了。",
    "这一轮发出 3 条事件：失败期间攒下的回话和锁单，只要还在 7 天内，都在里面。超过 7 天的 Meta 不收，补不了。",
  ])
  const quiet = recoveredMail({ ...prev, last_ok_at: null }, Date.parse(at(9)), 0)
  assert.deepEqual(quiet.text.split("\n"), [
    "Meta 回传恢复了：之前连续失败 8 次，这一轮成功了。",
    "这一轮没有要补发的事件。如果中断超过了 7 天，更早的回话和锁单 Meta 已经不收，补不了。",
  ])
})
