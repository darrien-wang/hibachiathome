// Layer-2 self-test: cancelling an order (lib/order-cancel.ts, order-flow
// rebuild 2026-11-11). Until now a cancellation was six SQL statements by hand
// (11-07, 11-11) and a text someone had to remember. One call does it, a dry
// run shows it first, and it never touches money. In-memory database, recorded
// SMS sender: nothing here can reach production.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { cancelOrder, type CancelOutcome } from "../lib/order-cancel"
import { cancelDoneLines, cancelPlanLines } from "../lib/order-cancel-lines"
import { fakeSupabase, type Row } from "./fixtures/fake-supabase"

const ORDER_ID = "00000000-0000-4000-8000-0000000000a1"
const LEAD_ID = "00000000-0000-4000-8000-0000000000c1"
const GARY = "00000000-0000-4000-8000-0000000000b2"
const EASON = "00000000-0000-4000-8000-0000000000b4"
const REASON = "Customer texted 11/11: family emergency, not holding the party"
// The party: 5:30 PM Pacific on Nov 14 2030 = 2030-11-15T01:30Z.
const START_UTC = Date.parse("2030-11-15T01:30:00Z")
const FOUR_DAYS_OUT = START_UTC - 96 * 3600_000
const THIRTY_HOURS_OUT = START_UTC - 30 * 3600_000

function world(over: { order?: Row; assignments?: Row[]; links?: Row[]; lead?: Row | null; orders?: Row[] } = {}) {
  const order = {
    id: ORDER_ID,
    order_no: "RH-20301105-0001",
    customer_name: "Joyce Lin",
    customer_phone: "+16265550100",
    event_start: "2030-11-14T17:30:00+00:00",
    event_address: "12 Test Way, Irvine, CA 92602",
    order_status: "active",
    deposit_status: "paid_verified",
    date_lock_status: "locked",
    calendar_status: "synced",
    amount_paid_total_cents: 0,
    source_metadata: { lead_id: LEAD_ID },
    ...over.order,
  }
  return fakeSupabase({
    orders: [order, ...(over.orders ?? [])],
    order_staff_assignments: over.assignments ?? [
      { id: "as1", order_id: ORDER_ID, staff_member_id: GARY, assignment_role: "lead_chef", assignment_status: "confirmed", pay_settled_at: null, settled_at: null },
      { id: "as2", order_id: ORDER_ID, staff_member_id: EASON, assignment_role: "assistant_chef", assignment_status: "confirmed", pay_settled_at: null, settled_at: null },
      { id: "as0", order_id: ORDER_ID, staff_member_id: "old", assignment_role: "lead_chef", assignment_status: "cancelled", pay_settled_at: null, settled_at: null },
    ],
    staff_members: [
      { id: GARY, display_name: "Gary", full_name: null, phone: "6265550102" },
      { id: EASON, display_name: "Eason", full_name: null, phone: "6265550104" },
    ],
    chef_sheet_links: over.links ?? [{ id: "l1", order_id: ORDER_ID, staff_member_id: GARY, sent_via: "twilio", first_opened_at: "2030-11-10T00:00:00Z", revoked_at: null }],
    leads: over.lead === null ? [] : [{ id: LEAD_ID, status: "won", full_name: "Joyce Lin", acked_until: null, ...over.lead }],
    lead_touchpoints: [],
    order_events: [],
    integration_jobs: [],
    payments: [],
  })
}

function sender() {
  const sent: Array<{ phone: string; body: string }> = []
  return { sent, send: async (phone: string, body: string) => (sent.push({ phone, body }), { ok: true as const, sid: `SM${sent.length}`, status: "queued" }) }
}
const ok = (r: Awaited<ReturnType<typeof cancelOrder>>): CancelOutcome => {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r as CancelOutcome
}

test("cancel · a reason is required, and so is an order that exists", async () => {
  const db = world()
  assert.deepEqual(await cancelOrder(db as never, { orderId: ORDER_ID, reason: " ", actor: "desk:owner" }), { ok: false, status: 400, error: "取消原因必填：会记在订单和线索上" })
  assert.equal((await cancelOrder(db as never, { orderId: "nope", reason: REASON, actor: "desk:owner" })).ok, false)
  const missing = await cancelOrder(db as never, { orderNo: "RH-20301105-9999", reason: REASON, actor: "desk:owner" })
  assert.deepEqual(missing, { ok: false, status: 404, error: "订单不存在" })
  assert.deepEqual(db.writes, [])
})

test("cancel · dry run: the whole plan, each chef's text word for word, nothing written, nothing sent", async () => {
  const db = world()
  const { sent, send } = sender()
  const plan = ok(await cancelOrder(db as never, { orderNo: "RH-20301105-0001", reason: REASON, actor: "desk:owner", dryRun: true, now: FOUR_DAYS_OUT, send }))
  assert.equal(plan.dryRun, true)
  assert.equal(plan.already, false)
  assert.equal(plan.party, "11月14日下午5:30 Irvine（Joyce）")
  assert.equal(plan.assignmentsCancelled, 2)
  assert.deepEqual(plan.chefs.map((c) => [c.name, c.text, c.texted]), [
    ["Gary", "11月14日下午5:30 Irvine（Joyce）那场取消了，你不用去，之前的备料单作废。", false],
    ["Eason", "11月14日下午5:30 Irvine（Joyce）那场取消了，你不用去。", false],
  ])
  assert.deepEqual(plan.lead, { id: LEAD_ID, was: "won", markedLost: true })
  assert.equal(plan.within48h, false)
  assert.equal(plan.lateFeeNote, null)
  assert.deepEqual(sent, [])
  assert.deepEqual(db.writes, [])
  assert.equal(db.tables.orders[0].order_status, "active")
})

test("cancel · for real: the reference's three columns, chefs told then taken off, the record, the lead lost", async () => {
  const db = world()
  const { sent, send } = sender()
  const done = ok(await cancelOrder(db as never, { orderId: ORDER_ID, reason: REASON, actor: "workbench:Darrien", now: FOUR_DAYS_OUT, send }))

  // 1. the order: exactly processOrderCancelled's columns (plus the timestamp)
  const orderWrite = db.writes.find((w) => w.table === "orders")!
  assert.deepEqual(Object.keys(orderWrite.values as Row).sort(), ["calendar_status", "date_lock_status", "order_status", "updated_at"])
  const order = db.tables.orders[0]
  assert.deepEqual([order.order_status, order.date_lock_status, order.calendar_status], ["cancelled", "not_locked", "not_synced"])

  // 2. the chefs: both texted in Chinese from the plan's wording, the sheet link revoked, assignments cancelled
  assert.deepEqual(sent, [
    { phone: "+16265550102", body: "11月14日下午5:30 Irvine（Joyce）那场取消了，你不用去，之前的备料单作废。" },
    { phone: "+16265550104", body: "11月14日下午5:30 Irvine（Joyce）那场取消了，你不用去。" },
  ])
  assert.equal(typeof db.tables.chef_sheet_links[0].revoked_at, "string")
  assert.deepEqual(db.tables.order_staff_assignments.map((a) => a.assignment_status), ["cancelled", "cancelled", "cancelled"])
  assert.equal(done.chefs.every((c) => c.texted), true)

  // 3. the record
  const event = db.tables.order_events[0]
  assert.equal(event.action, "order_cancelled")
  assert.equal(event.actor, "workbench:Darrien")
  const meta = event.metadata as Row
  assert.equal(meta.reason, REASON)
  assert.equal(meta.within_48h, false)
  assert.equal(meta.late_fee, null)
  assert.equal(meta.lead_marked_lost, true)
  assert.deepEqual((meta.chefs as Row[]).map((c) => [c.name, c.to, (c.sms as Row).sid]), [["Gary", "+16265550102", "SM1"], ["Eason", "+16265550104", "SM2"]])
  assert.deepEqual(db.tables.integration_jobs.map((j) => [j.job_type, j.status, j.order_id]), [["cancel_calendar", "pending", ORDER_ID]])

  // 4. the lead: lost, quiet, the reason on the timeline the way the leads skill files it
  const lead = db.tables.leads[0]
  assert.equal(lead.status, "lost")
  assert.equal(typeof lead.acked_until, "string")
  const tps = db.tables.lead_touchpoints
  assert.deepEqual(tps.map((t) => t.touchpoint_type), ["agent_status_change", "agent_note"])
  assert.equal((tps[0].raw_payload_json as Row).status, "lost")
  assert.equal((tps[1].raw_payload_json as Row).note, `[lost] 订单 RH-20301105-0001 已取消。[why] ${REASON}`)

  // and never money: no payment row, no charge, no refund
  assert.deepEqual(db.writes.filter((w) => w.table === "payments"), [])
  assert.deepEqual([...new Set(db.writes.map((w) => w.table))].sort(), ["chef_sheet_links", "integration_jobs", "lead_touchpoints", "leads", "order_events", "order_staff_assignments", "orders"])
})

test("cancel · inside 48 hours the $99 is the owner's call: said, recorded, not charged", async () => {
  const db = world()
  const { send } = sender()
  const plan = ok(await cancelOrder(db as never, { orderId: ORDER_ID, reason: REASON, actor: "desk:owner", dryRun: true, now: THIRTY_HOURS_OUT, send }))
  assert.equal(plan.within48h, true)
  assert.equal(plan.hoursToParty, 30)
  assert.equal(plan.lateFeeNote, "离派对只有 30 小时（不到 48 小时）：按政策可以收 $99 取消费，系统没有扣，收不收由老板定。")
  const done = ok(await cancelOrder(db as never, { orderId: ORDER_ID, reason: REASON, actor: "desk:owner", now: THIRTY_HOURS_OUT, send }))
  assert.equal(done.lateFeeNote, plan.lateFeeNote)
  const meta = db.tables.order_events[0].metadata as Row
  assert.equal(meta.within_48h, true)
  assert.equal(meta.late_fee, "not_charged_owner_decides")
  assert.deepEqual(db.writes.filter((w) => w.table === "payments"), [])
})

test("cancel · the 48 hours are measured on the Pacific clock, not on the column read as UTC", async () => {
  // event_start says 17:30+00, the party is at 01:30Z. 46 hours before the stored
  // value is still 54 hours before the party: no late-fee line.
  const plan = ok(await cancelOrder(world() as never, { orderId: ORDER_ID, reason: REASON, actor: "desk:owner", dryRun: true, now: Date.parse("2030-11-14T17:30:00Z") - 46 * 3600_000 }))
  assert.equal(plan.hoursToParty, 54)
  assert.equal(plan.within48h, false)
  const edge = ok(await cancelOrder(world() as never, { orderId: ORDER_ID, reason: REASON, actor: "desk:owner", dryRun: true, now: START_UTC - 47 * 3600_000 }))
  assert.equal(edge.within48h, true)
})

test("cancel · money already taken and pay already settled are named, never moved", async () => {
  const db = world({
    order: { amount_paid_total_cents: 1990 },
    assignments: [{ id: "as1", order_id: ORDER_ID, staff_member_id: GARY, assignment_role: "lead_chef", assignment_status: "confirmed", pay_settled_at: "2030-11-09T00:00:00Z", settled_at: null }],
  })
  const plan = ok(await cancelOrder(db as never, { orderId: ORDER_ID, reason: REASON, actor: "desk:owner", dryRun: true, now: FOUR_DAYS_OUT }))
  assert.deepEqual(plan.warnings, ["这单已经收过 $19.90，系统不会自动退，退不退由老板定。", "有 1 位师傅这场的工钱已经结过（提前结算），取消后要在下一期结算里扣回。"])
})

test("cancel · a customer with another party of theirs, still to come or already held, keeps the lead", async () => {
  const other = { id: "00000000-0000-4000-8000-0000000000a2", order_no: "RH-20301120-0002", event_start: "2030-12-24T18:00:00+00:00", order_status: "active", deposit_status: "paid_verified", customer_phone: "(626) 555-0100", source_metadata: {} }
  const db = world({ orders: [other] })
  const { send } = sender()
  const done = ok(await cancelOrder(db as never, { orderId: ORDER_ID, reason: REASON, actor: "desk:owner", now: FOUR_DAYS_OUT, send }))
  assert.deepEqual(done.lead, { id: LEAD_ID, was: "won", markedLost: false, kept: "客人还有一场没办的派对（RH-20301120-0002），线索不标流失" })
  assert.equal(db.tables.leads[0].status, "won")
  assert.deepEqual(db.tables.lead_touchpoints, [])
  assert.equal(db.tables.orders[0].order_status, "cancelled")
  // A party we already cooked for them keeps it too: a returning customer is not a lead that got away.
  const returning = world({ orders: [{ ...other, id: "x3", order_no: "RH-20300101-0003", event_start: "2030-01-01T18:00:00+00:00", customer_phone: "+19095550111", source_metadata: { lead_id: LEAD_ID } }] })
  assert.deepEqual(ok(await cancelOrder(returning as never, { orderId: ORDER_ID, reason: REASON, actor: "desk:owner", dryRun: true, now: FOUR_DAYS_OUT })).lead, {
    id: LEAD_ID,
    was: "won",
    markedLost: false,
    kept: "客人之前办过派对（RH-20300101-0003），是老客人，线索不标流失",
  })
  // A cancelled one, or somebody else's, does not.
  const gone = world({ orders: [{ ...other, order_status: "cancelled" }, { ...other, id: "x4", order_no: "RH-20300101-0004", customer_phone: "+19095550111" }] })
  assert.equal(ok(await cancelOrder(gone as never, { orderId: ORDER_ID, reason: REASON, actor: "desk:owner", dryRun: true, now: FOUR_DAYS_OUT })).lead?.markedLost, true)
})

test("cancel · already cancelled with nobody left to tell: nothing to do, nothing written", async () => {
  const db = world({ order: { order_status: "cancelled" }, assignments: [], lead: { status: "lost" } })
  const { sent, send } = sender()
  const out = ok(await cancelOrder(db as never, { orderId: ORDER_ID, reason: REASON, actor: "desk:owner", now: FOUR_DAYS_OUT, send }))
  assert.equal(out.already, true)
  assert.equal(out.nothingToDo, true)
  assert.deepEqual(sent, [])
  assert.deepEqual(db.writes, [])
})

test("cancel · an order cancelled another way is finished: the chef still on it is told, the order row is not rewritten", async () => {
  const db = world({ order: { order_status: "cancelled", date_lock_status: "not_locked", calendar_status: "not_synced" } })
  const { sent, send } = sender()
  const out = ok(await cancelOrder(db as never, { orderId: ORDER_ID, reason: REASON, actor: "desk:owner", now: FOUR_DAYS_OUT, send }))
  assert.equal(out.already, true)
  assert.equal(out.nothingToDo, false)
  assert.equal(sent.length, 2)
  assert.deepEqual(db.writes.filter((w) => w.table === "orders"), [])
  assert.deepEqual(db.tables.integration_jobs, [], "the calendar job belongs to the first cancellation")
  assert.equal((db.tables.order_events[0].metadata as Row).followup, true)
  assert.equal(db.tables.leads[0].status, "lost")
})

test("cancel · no chef assigned and no lead on the order: the order is cancelled and it says what it could not do", async () => {
  const db = world({ assignments: [], order: { source_metadata: {} }, lead: null })
  const { sent, send } = sender()
  const out = ok(await cancelOrder(db as never, { orderId: ORDER_ID, reason: REASON, actor: "desk:owner", now: FOUR_DAYS_OUT, send }))
  assert.equal(db.tables.orders[0].order_status, "cancelled")
  assert.deepEqual(sent, [])
  assert.equal(out.lead, null)
  assert.deepEqual(out.warnings, ["订单上没有挂线索（lead_id），线索状态没动，自己看一下。"])
})

test("cancel · what the workbench shows before and after", async () => {
  const db = world({ assignments: [{ id: "as1", order_id: ORDER_ID, staff_member_id: GARY, assignment_role: "lead_chef", assignment_status: "confirmed", pay_settled_at: null, settled_at: null }] })
  const { send } = sender()
  const plan = ok(await cancelOrder(db as never, { orderId: ORDER_ID, reason: REASON, actor: "workbench:Darrien", dryRun: true, now: THIRTY_HOURS_OUT, send }))
  assert.deepEqual(cancelPlanLines(plan), [
    "RH-20301105-0001 · 11月14日下午5:30 Irvine（Joyce）",
    `原因：${REASON}`,
    "",
    "确认后会做这些事：",
    "· 订单标成已取消（日历、派单、备货里都不再出现）",
    "· 短信通知 Gary：「11月14日下午5:30 Irvine（Joyce）那场取消了，你不用去，之前的备料单作废。」",
    "· 线索标成流失，原因记进时间线",
    "",
    "不会给客人发任何消息，也不会扣款、退款。",
    "⚠ 离派对只有 30 小时（不到 48 小时）：按政策可以收 $99 取消费，系统没有扣，收不收由老板定。",
  ])
  const done = ok(await cancelOrder(db as never, { orderId: ORDER_ID, reason: REASON, actor: "workbench:Darrien", now: THIRTY_HOURS_OUT, send }))
  assert.deepEqual(cancelDoneLines(done), [
    "RH-20301105-0001 已取消。",
    "· 已短信通知 Gary",
    "· 线索已标成流失",
    "⚠ 离派对只有 30 小时（不到 48 小时）：按政策可以收 $99 取消费，系统没有扣，收不收由老板定。",
  ])
})

// ---- the route's gate ----------------------------------------------------------
// No database is configured in these three: a request that got past the gate
// would answer "supabase not configured", so nothing can be read or written.
test("cancel route · owner only: no key 401, an agent's key 403, and the owner gets through the gate", async () => {
  const { NextRequest } = await import("next/server")
  const { POST } = await import("../app/api/admin/orders/cancel/route")
  const names = ["ADMIN_DASH_KEY", "AGENT_DASH_KEYS", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const
  const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]))
  process.env.ADMIN_DASH_KEY = "owner-test-key"
  process.env.AGENT_DASH_KEYS = "anna:agent-test-key"
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  const quiet = console.error
  console.error = () => undefined // lib/supabase.ts says the env is missing; that is the point here
  const call = async (key: string | null) => {
    const res = await POST(
      new NextRequest("http://localhost/api/admin/orders/cancel", {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { "x-admin-key": key } : {}) },
        body: JSON.stringify({ orderId: ORDER_ID, reason: REASON, dryRun: true }),
      }),
    )
    return [res.status, ((await res.json()) as { error?: string }).error]
  }
  try {
    assert.deepEqual(await call(null), [401, "unauthorized"])
    assert.deepEqual(await call("agent-test-key"), [403, "只有老板能取消订单"])
    assert.deepEqual(await call("owner-test-key"), [500, "supabase not configured"])
  } finally {
    console.error = quiet
    for (const n of names) {
      if (saved[n] === undefined) delete process.env[n]
      else process.env[n] = saved[n]
    }
  }
})
