// Backfill orders.dispatch_plan (2026-10-18) and capture the staffing promises
// already made in texts and emails.
//
//   npx -y tsx --tsconfig ./tsconfig.json scripts/backfill-dispatch-plan.ts            # dry run: prints what would change
//   npx -y tsx --tsconfig ./tsconfig.json scripts/backfill-dispatch-plan.ts --apply    # writes
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (the
// same names lib/supabase.ts reads).
//
// 1. Every upcoming order (event_start from today, not cancelled) gets a plan
//    by the headcount rule (lib/dispatch-plan.ts, 28 paid heads a chef and
//    grill) unless the owner already set one.
// 2. Every outbound text / email of the last 60 days (lead_touchpoints
//    sms_outbound / email_outbound) is read for a staffing promise. Each one
//    becomes a "promise" touchpoint on its lead (so a later booking copies it),
//    and the latest promise of a lead lands on that lead's upcoming orders with
//    source "promise".
// Idempotent: a second run changes nothing.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { applyPromise, normalizeDispatchPlan, parseStaffingPromise, PROMISE_TOUCHPOINT_SOURCE, PROMISE_TOUCHPOINT_TYPE, rulePlan, type StaffingPromise } from "../lib/dispatch-plan"
import { orderPaidHeads } from "../lib/dispatch-plan-order"

const APPLY = process.argv.includes("--apply")
const DAYS = 60
const ACTOR = "backfill:dispatch-plan-2026-10-18"

type OrderRow = {
  id: string
  order_no: string | null
  customer_name: string | null
  customer_phone: string | null
  event_start: string | null
  order_status: string | null
  guest_adult_count: number | null
  guest_child_count: number | null
  invoice_data: unknown
  dispatch_plan: unknown
  source_metadata: Record<string, unknown> | null
}

type TouchRow = {
  id: number
  lead_id: string
  touchpoint_type: string
  touchpoint_source: string
  external_touchpoint_id: string | null
  occurred_at: string
  raw_payload_json: Record<string, unknown> | null
}

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const last10 = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10)

async function main() {
  const supabase = client()
  const nowWall = new Date().toISOString().slice(0, 19)
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString()

  const { data: orderRows, error: oErr } = await supabase
    .from("orders")
    .select("id, order_no, customer_name, customer_phone, event_start, order_status, guest_adult_count, guest_child_count, invoice_data, dispatch_plan, source_metadata")
    .gte("event_start", nowWall)
    .order("event_start")
    .limit(500)
  if (oErr) throw oErr
  const orders = ((orderRows ?? []) as OrderRow[]).filter((o) => !/cancel|void|refund/i.test(o.order_status ?? ""))

  // Every outbound message of the window, oldest first so "latest wins" is a plain overwrite.
  const touches: TouchRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("lead_touchpoints")
      .select("id, lead_id, touchpoint_type, touchpoint_source, external_touchpoint_id, occurred_at, raw_payload_json")
      .in("touchpoint_type", ["sms_outbound", "email_outbound"])
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    touches.push(...((data ?? []) as TouchRow[]))
    if (!data || data.length < 1000) break
  }

  // Promise touchpoints already written (idempotency on source + external id).
  const { data: known } = await supabase.from("lead_touchpoints").select("external_touchpoint_id").eq("touchpoint_source", PROMISE_TOUCHPOINT_SOURCE).limit(5000)
  const have = new Set((known ?? []).map((r) => String((r as { external_touchpoint_id: string | null }).external_touchpoint_id ?? "")))

  type Found = { lead_id: string; promise: StaffingPromise; snippet: string; type: string; source: string }
  const found: Found[] = []
  const latestByLead = new Map<string, StaffingPromise>()
  for (const t of touches) {
    const p = t.raw_payload_json ?? {}
    const text = String(p.body ?? p.Body ?? p.text ?? "")
    if (!text) continue
    const parsed = parseStaffingPromise(text)
    if (!parsed) continue
    const via: "sms" | "email" = t.touchpoint_type === "email_outbound" ? "email" : "sms"
    const sid = t.external_touchpoint_id ?? (typeof p.sid === "string" ? p.sid : null) ?? `touchpoint:${t.id}`
    const promise: StaffingPromise = {
      chefs: parsed.chefs,
      grills: parsed.grills,
      text: parsed.text,
      sid,
      at: t.occurred_at,
      via,
      lead_id: t.lead_id,
      ...(parsed.stations_note ? { stations_note: parsed.stations_note } : {}),
    }
    found.push({ lead_id: t.lead_id, promise, snippet: text.replace(/\s+/g, " ").slice(0, 110), type: t.touchpoint_type, source: t.touchpoint_source })
    latestByLead.set(t.lead_id, promise)
  }

  // Leads of the promises: name, phone, orders.
  const leadIds = [...latestByLead.keys()]
  const leads = new Map<string, { full_name: string | null; phone: string | null; normalized_phone: string | null; status: string | null }>()
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data } = await supabase.from("leads").select("id, full_name, phone, normalized_phone, status").in("id", leadIds.slice(i, i + 200))
    for (const l of (data ?? []) as Array<{ id: string; full_name: string | null; phone: string | null; normalized_phone: string | null; status: string | null }>) leads.set(l.id, l)
  }
  const byPhone = new Map<string, string>()
  for (const [id, l] of leads) {
    const d = l.normalized_phone ?? last10(l.phone)
    if (d) byPhone.set(d, id)
  }

  // Plan per upcoming order.
  type Change = { order: OrderRow; heads: number; from: string; to: string; plan: ReturnType<typeof rulePlan>; promise: StaffingPromise | null; write: boolean }
  const changes: Change[] = []
  for (const o of orders) {
    const heads = orderPaidHeads(o)
    const existing = normalizeDispatchPlan(o.dispatch_plan)
    const leadId = typeof o.source_metadata?.lead_id === "string" ? o.source_metadata.lead_id : byPhone.get(last10(o.customer_phone)) ?? null
    const promise = (leadId && latestByLead.get(leadId)) || (byPhone.get(last10(o.customer_phone)) ? latestByLead.get(byPhone.get(last10(o.customer_phone))!) ?? null : null)
    const at = new Date().toISOString()
    let plan = existing && existing.source === "owner" ? existing : existing && existing.source === "promise" ? existing : { ...rulePlan(heads, at), set_by: ACTOR }
    if (promise) plan = applyPromise(existing ?? plan, promise, heads, at)
    if (plan.source === "rule") plan = { ...plan, set_by: ACTOR }
    const label = (p: { chefs: number; grills: number; source: string } | null) => (p ? `${p.chefs}/${p.grills} ${p.source}` : "—")
    const same = existing && existing.chefs === plan.chefs && existing.grills === plan.grills && existing.source === plan.source && (existing.promise?.sid ?? null) === (plan.promise?.sid ?? null)
    changes.push({ order: o, heads, from: label(existing), to: label(plan), plan, promise: promise ?? null, write: !same })
  }

  // ---- report
  const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length))
  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} · ${orders.length} upcoming orders · ${touches.length} outbound messages in ${DAYS} days · ${found.length} staffing promises on ${latestByLead.size} leads\n`)
  console.log(pad("order", 18) + pad("customer", 22) + pad("party", 12) + pad("heads", 7) + pad("plan was", 14) + pad("plan now", 16) + "promise")
  for (const c of changes) {
    const o = c.order
    const pr = c.promise ? `${c.promise.chefs}/${c.promise.grills} ${c.promise.at.slice(0, 10)} ${c.promise.via} "${c.promise.text.slice(0, 60)}…"` : ""
    console.log(pad(o.order_no ?? o.id.slice(0, 8), 18) + pad((o.customer_name ?? "").slice(0, 20), 22) + pad((o.event_start ?? "").slice(0, 10), 12) + pad(String(c.heads), 7) + pad(c.from, 14) + pad(c.to + (c.write ? "" : " ="), 16) + pr)
  }
  console.log(`\nPromises found (latest per lead; * = lead has an upcoming order):`)
  for (const [leadId, p] of latestByLead) {
    const l = leads.get(leadId)
    const booked = changes.find((c) => c.promise?.lead_id === leadId || (typeof c.order.source_metadata?.lead_id === "string" && c.order.source_metadata.lead_id === leadId))
    console.log(`  ${booked ? "*" : " "} ${pad((l?.full_name ?? leadId).slice(0, 24), 26)} ${pad(l?.phone ?? "", 14)} ${p.chefs}/${p.grills} ${p.at.slice(0, 10)} ${p.via}  "${p.text.slice(0, 90)}…"${booked ? `  -> ${booked.order.order_no}` : ""}`)
  }

  if (!APPLY) {
    console.log("\n(dry run - pass --apply to write)")
    return
  }

  // ---- write: promise touchpoints (idempotent), then plans
  let wroteTouch = 0
  for (const f of found) {
    const ext = `${f.promise.via}:${f.promise.sid}`
    if (have.has(ext)) continue
    const { error } = await supabase.from("lead_touchpoints").insert({
      lead_id: f.lead_id,
      touchpoint_type: PROMISE_TOUCHPOINT_TYPE,
      touchpoint_source: PROMISE_TOUCHPOINT_SOURCE,
      external_touchpoint_id: ext,
      occurred_at: f.promise.at,
      raw_payload_json: { kind: "staffing", chefs: f.promise.chefs, grills: f.promise.grills, text: f.promise.text, sid: f.promise.sid, at: f.promise.at, via: f.promise.via, ...(f.promise.stations_note ? { stations_note: f.promise.stations_note } : {}), actor: ACTOR, from: { type: f.type, source: f.source } },
    })
    if (error && !/duplicate|unique|23505/i.test(`${error.code ?? ""} ${error.message}`)) console.error("touchpoint insert failed", f.lead_id, error.message)
    else if (!error) {
      wroteTouch++
      have.add(ext)
    }
  }
  let wroteOrders = 0
  for (const c of changes) {
    if (!c.write) continue
    const { error } = await supabase.from("orders").update({ dispatch_plan: c.plan, required_staff_count: c.plan.chefs }).eq("id", c.order.id)
    if (error) {
      console.error("order update failed", c.order.order_no, error.message)
      continue
    }
    await supabase.from("order_events").insert({
      order_id: c.order.id,
      actor: ACTOR,
      action: "dispatch_plan_set",
      metadata: { source: c.plan.source, chefs: c.plan.chefs, grills: c.plan.grills, stations_note: c.plan.stations_note ?? null, heads: c.heads, was: c.from, promise: c.plan.promise ? { chefs: c.plan.promise.chefs, grills: c.plan.promise.grills, sid: c.plan.promise.sid, at: c.plan.promise.at } : null },
    })
    wroteOrders++
  }
  console.log(`\nwrote ${wroteTouch} promise touchpoints, ${wroteOrders} order plans`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
