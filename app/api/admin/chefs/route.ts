import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { can, resolveAdminActor, type AdminActor } from "@/lib/admin-auth"
import { chefPayCents, docState, taxMissing, type ChefRate } from "@/lib/chef-pay"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 厨师 · 名单、派单、表现、文件、结算。
//   GET                    -> { chefs: ChefSummary[], assignments: {orderId: [...]}, alertsCount }
//   GET ?id=<staff uuid>   -> { chef, shifts, performance, files, settlements }
//   GET ?file=<file uuid>  -> 302 to a signed URL (1 h) of the stored file
//   POST { action, ... }   -> see ACTIONS below
// Money is cents everywhere. Pay per shift = base + (share - head_from) × per_head,
// share = the chef's head count when several chefs work one party.

const BUCKET = "party-photos"
// 备料单的份量快照、令牌和 213 线短信都在发票工具那边，工作台只做代理。
const INVOICE_APP_ORIGIN = "https://invoice.realhibachi.com"
// What a viewer without the chef_sensitive perm (坐席) never receives: pay,
// settlement, cash, documents, tax. Media files and reviews stay visible.
const MEDIA_KINDS = new Set(["photo", "video", "other"])
const SENSITIVE_STAFF_FIELDS = ["base_pay_cents", "head_from", "per_head_cents", "billing_cycle", "last_settled_at", "food_handler_no", "food_handler_exp", "id_type", "id_last4", "id_exp", "tax_form", "tax_legal_name", "tax_id_last4", "tax_address"]
function publicStaff(s: Staff): Staff {
  const out: Staff = { ...s }
  for (const k of SENSITIVE_STAFF_FIELDS) delete out[k]
  return out
}
const hideShiftMoney = <T extends { payCents: number; cashCents: number; cashSource: string; settledAt: string | null }>(x: T): T => ({ ...x, payCents: 0, cashCents: 0, cashSource: "none", settledAt: null })
const ACTIVE_ASSIGNMENT = ["tentative", "confirmed", "completed"]
const STAFF_COLUMNS =
  "id, full_name, display_name, staff_type, status, email, phone, notes, is_bookable, allow_customer_request, wechat, base_pay_cents, head_from, per_head_cents, skills, areas, billing_cycle, last_settled_at, food_handler_no, food_handler_exp, id_type, id_last4, id_exp, tax_form, tax_legal_name, tax_id_last4, tax_address, created_at, updated_at"
const ORDER_COLUMNS = "id, order_no, customer_name, customer_phone, event_start, event_address, guest_adult_count, guest_child_count, order_status, balance_due_cents, quoted_total_cents"

type Staff = Record<string, unknown> & { id: string }
type Assignment = {
  id: string
  order_id: string
  staff_member_id: string
  assignment_status: string
  guest_share: number | null
  pay_cents: number | null
  cash_collected_cents: number | null
  settled_at: string | null
  notes: string | null
  created_at: string
}
type OrderLite = {
  id: string
  order_no: string | null
  customer_name: string | null
  customer_phone: string | null
  event_start: string | null
  event_address: string | null
  guest_adult_count: number | null
  guest_child_count: number | null
  order_status: string | null
  balance_due_cents: number | null
  quoted_total_cents: number | null
}

const ptToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
const eventYmd = (iso: string | null) => (iso ? iso.slice(0, 10) : "")
const rateOf = (s: Staff): ChefRate => ({ base_pay_cents: Number(s.base_pay_cents ?? 0), head_from: Number(s.head_from ?? 16), per_head_cents: Number(s.per_head_cents ?? 0) })
const nameOf = (s: Staff) => String(s.display_name ?? s.full_name ?? "").trim() || "未命名"
const guestsOf = (o: OrderLite) => (o.guest_adult_count ?? 0) + (o.guest_child_count ?? 0)

async function loadWorld(supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>) {
  const [{ data: staff }, { data: assignments }, { data: sheets }] = await Promise.all([
    supabase.from("staff_members").select(STAFF_COLUMNS).neq("status", "deleted").order("display_name", { ascending: true }),
    supabase
      .from("order_staff_assignments")
      .select("id, order_id, staff_member_id, assignment_status, guest_share, pay_cents, cash_collected_cents, settled_at, notes, created_at")
      .in("assignment_status", ACTIVE_ASSIGNMENT)
      .limit(2000),
    supabase.from("chef_sheet_links").select("order_id, staff_member_id, assignment_id, cash_collected_cents, tip_reported_cents, collected_at").not("collected_at", "is", null).limit(2000),
  ])
  const orderIds = Array.from(new Set((assignments ?? []).map((a) => a.order_id)))
  const { data: orders } = orderIds.length ? await supabase.from("orders").select(ORDER_COLUMNS).in("id", orderIds) : { data: [] as OrderLite[] }
  const orderMap = new Map<string, OrderLite>()
  for (const o of (orders ?? []) as OrderLite[]) orderMap.set(o.id, o)
  // Cash the chef reported on the prep sheet, latest per order+chef.
  const cashReported = new Map<string, number>()
  for (const s of sheets ?? []) {
    const k = `${s.order_id}|${s.staff_member_id}`
    if (!cashReported.has(k)) cashReported.set(k, Number(s.cash_collected_cents ?? 0))
  }
  return { staff: (staff ?? []) as Staff[], assignments: (assignments ?? []) as Assignment[], orderMap, cashReported }
}

/** One chef's shift on one order, with the pay/cash/settlement the ledger needs. */
function shiftOf(a: Assignment, o: OrderLite, team: Assignment[], staffById: Map<string, Staff>, cashReported: Map<string, number>) {
  const s = staffById.get(a.staff_member_id)
  const guests = guestsOf(o)
  const n = Math.max(1, team.length)
  const share = a.guest_share ?? Math.round(guests / n)
  const pay = a.pay_cents ?? (s ? chefPayCents(rateOf(s), share) : 0)
  const cash = a.cash_collected_cents ?? cashReported.get(`${o.id}|${a.staff_member_id}`) ?? 0
  return {
    assignmentId: a.id,
    orderId: o.id,
    orderNo: o.order_no,
    date: eventYmd(o.event_start),
    eventStart: o.event_start,
    customer: o.customer_name,
    address: o.event_address,
    guests,
    share,
    team: team.map((t) => ({ id: t.staff_member_id, name: staffById.get(t.staff_member_id) ? nameOf(staffById.get(t.staff_member_id)!) : "?" })),
    payCents: pay,
    cashCents: cash,
    cashSource: a.cash_collected_cents != null ? "manual" : cashReported.has(`${o.id}|${a.staff_member_id}`) ? "chef_sheet" : "none",
    settledAt: a.settled_at,
    status: a.assignment_status,
    orderStatus: o.order_status,
    balanceDueCents: o.balance_due_cents,
  }
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })

  const fileId = request.nextUrl.searchParams.get("file")
  if (fileId) {
    const { data: f } = await supabase.from("chef_files").select("storage_path, kind").eq("id", fileId).maybeSingle()
    if (!f?.storage_path) return NextResponse.json({ error: "not found" }, { status: 404 })
    if (!can(actor, "chef_sensitive") && !MEDIA_KINDS.has(String(f.kind))) return NextResponse.json({ error: "没有权限看这个文件" }, { status: 403 })
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 3600)
    if (!signed?.signedUrl) return NextResponse.json({ error: "sign failed" }, { status: 500 })
    // JSON, not a redirect: the browser fetches with the key header and opens the URL itself.
    return NextResponse.json({ ok: true, url: signed.signedUrl })
  }

  const world = await loadWorld(supabase)
  const staffById = new Map(world.staff.map((s) => [s.id, s]))
  const byOrder = new Map<string, Assignment[]>()
  for (const a of world.assignments) (byOrder.get(a.order_id) ?? byOrder.set(a.order_id, []).get(a.order_id)!).push(a)
  const today = ptToday()

  const id = request.nextUrl.searchParams.get("id")
  if (id) {
    const chef = staffById.get(id)
    if (!chef) return NextResponse.json({ error: "not found" }, { status: 404 })
    const shifts = world.assignments
      .filter((a) => a.staff_member_id === id && world.orderMap.has(a.order_id))
      .map((a) => shiftOf(a, world.orderMap.get(a.order_id)!, byOrder.get(a.order_id) ?? [a], staffById, world.cashReported))
      .sort((x, y) => (y.date || "").localeCompare(x.date || ""))
    const [{ data: performance }, { data: files }, { data: settlements }] = await Promise.all([
      supabase.from("chef_performance").select("*").eq("staff_member_id", id).order("event_date", { ascending: false }).limit(300),
      supabase.from("chef_files").select("id, order_id, kind, title, content_type, bytes, amount_cents, status, approved_at, settled_at, note, uploaded_by, created_at").eq("staff_member_id", id).order("created_at", { ascending: false }).limit(300),
      supabase.from("chef_settlements").select("*").eq("staff_member_id", id).order("created_at", { ascending: false }).limit(60),
    ])
    if (!can(actor, "chef_sensitive")) {
      return NextResponse.json({ ok: true, chef: publicStaff(chef), shifts: shifts.map(hideShiftMoney), performance: performance ?? [], files: (files ?? []).filter((f) => MEDIA_KINDS.has(String(f.kind))), settlements: [], today, sensitive: false })
    }
    return NextResponse.json({ ok: true, chef, shifts, performance: performance ?? [], files: files ?? [], settlements: settlements ?? [], today, sensitive: true })
  }

  // List: everything the 名单 table and the nav badge need.
  const ids = world.staff.map((s) => s.id)
  const [{ data: perfRows }, { data: pendingFiles }] = await Promise.all([
    ids.length ? supabase.from("chef_performance").select("staff_member_id, review, late_minutes").in("staff_member_id", ids).limit(5000) : { data: [] },
    ids.length ? supabase.from("chef_files").select("staff_member_id, amount_cents").eq("kind", "receipt").eq("status", "pending").in("staff_member_id", ids) : { data: [] },
  ])
  const chefs = world.staff.map((s) => {
    const mine = world.assignments.filter((a) => a.staff_member_id === s.id && world.orderMap.has(a.order_id))
    const shifts = mine.map((a) => shiftOf(a, world.orderMap.get(a.order_id)!, byOrder.get(a.order_id) ?? [a], staffById, world.cashReported))
    const open = shifts.filter((x) => !x.settledAt && x.date && x.date <= today && x.orderStatus !== "cancelled")
    const pf = (perfRows ?? []).filter((r) => r.staff_member_id === s.id)
    const pend = (pendingFiles ?? []).filter((f) => f.staff_member_id === s.id)
    const docs = docState(s, today)
    const approvedReimb = 0 // summed in detail; list shows receipts pending only
    return {
      id: s.id,
      name: nameOf(s),
      phone: s.phone ?? null,
      status: s.status,
      rate: rateOf(s),
      skills: (s.skills as string[]) ?? [],
      areas: (s.areas as string[]) ?? [],
      billing_cycle: s.billing_cycle,
      last_settled_at: s.last_settled_at ?? null,
      shifts,
      good: pf.filter((r) => r.review === "good").length,
      bad: pf.filter((r) => r.review === "bad").length,
      late: pf.filter((r) => (r.late_minutes ?? 0) > 0).length,
      perfCount: pf.length,
      openShifts: open.length,
      openPayCents: open.reduce((a, x) => a + x.payCents, 0),
      openCashCents: open.reduce((a, x) => a + x.cashCents, 0),
      approvedReimbCents: approvedReimb,
      pendingReceipts: pend.length,
      pendingReceiptCents: pend.reduce((a, f) => a + (f.amount_cents ?? 0), 0),
      doc: docs,
      taxMissing: taxMissing(s),
    }
  })
  const assignments: Record<string, Array<{ assignmentId: string; staffId: string; name: string; share: number | null }>> = {}
  for (const [orderId, list] of byOrder) {
    assignments[orderId] = list.map((a) => ({ assignmentId: a.id, staffId: a.staff_member_id, name: staffById.get(a.staff_member_id) ? nameOf(staffById.get(a.staff_member_id)!) : "?", share: a.guest_share }))
  }
  if (!can(actor, "chef_sensitive")) {
    const safe = chefs.map((c) => ({ ...c, rate: null, billing_cycle: "", last_settled_at: null, shifts: c.shifts.map(hideShiftMoney), openPayCents: 0, openCashCents: 0, approvedReimbCents: 0, pendingReceipts: 0, pendingReceiptCents: 0, doc: { ...c.doc, level: "ok" as const, label: "" }, taxMissing: false }))
    return NextResponse.json({ ok: true, chefs: safe, assignments, alertsCount: 0, today, sensitive: false })
  }
  const alertsCount = chefs.reduce((n, c) => n + c.pendingReceipts + (c.status === "active" && c.doc.level === "bad" ? 1 : 0) + (c.status === "active" && c.taxMissing ? 1 : 0), 0)
  return NextResponse.json({ ok: true, chefs, assignments, alertsCount, today })
}

// ---------------------------------------------------------------- writes

type Body = Record<string, unknown> & { action?: string }
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const int = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : fallback)
const dateOrNull = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const OWNER_ACTIONS = new Set(["update_profile", "update_docs", "settle", "unsettle", "approve_receipt", "reject_receipt", "delete_file", "delete_perf", "set_cash", "archive", "delete_chef"])

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const action = String(body.action ?? "")
  if (OWNER_ACTIONS.has(action) && actor.role !== "owner") return NextResponse.json({ error: "只有老板能改工价、证件、结算" }, { status: 403 })
  const now = new Date().toISOString()

  try {
    switch (action) {
      case "create": {
        const name = str(body.name, 80)
        if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })
        const { data, error } = await supabase
          .from("staff_members")
          .insert({
            full_name: name,
            display_name: name,
            // The column's check constraint allows employee / contractor_individual / freelancer / other;
            // "contractor" (the old default) made every create fail with a 500.
            staff_type: str(body.staff_type, 30) || "contractor_individual",
            status: "active",
            phone: str(body.phone, 30) || null,
            email: str(body.email, 120) || null,
            wechat: str(body.wechat, 60) || null,
            base_pay_cents: int(body.base_pay_cents, 0),
            head_from: int(body.head_from, 16),
            per_head_cents: int(body.per_head_cents, 0),
            skills: Array.isArray(body.skills) ? body.skills.map((x) => str(x, 40)).filter(Boolean).slice(0, 20) : [],
            areas: Array.isArray(body.areas) ? body.areas.map((x) => str(x, 20)).filter(Boolean).slice(0, 10) : [],
            billing_cycle: str(body.billing_cycle, 20) || "weekly",
            is_bookable: true,
            allow_customer_request: false,
          })
          .select("id")
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, id: data.id })
      }
      case "update_profile": {
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const f = (body.fields ?? {}) as Record<string, unknown>
        const patch: Record<string, unknown> = { updated_at: now }
        if ("display_name" in f) {
          patch.display_name = str(f.display_name, 80) || null
          patch.full_name = str(f.display_name, 80) || null
        }
        if ("phone" in f) patch.phone = str(f.phone, 30) || null
        if ("email" in f) patch.email = str(f.email, 120) || null
        if ("wechat" in f) patch.wechat = str(f.wechat, 60) || null
        if ("notes" in f) patch.notes = str(f.notes, 2000) || null
        if ("base_pay_cents" in f) patch.base_pay_cents = Math.max(0, int(f.base_pay_cents))
        if ("head_from" in f) patch.head_from = Math.max(0, int(f.head_from, 16))
        if ("per_head_cents" in f) patch.per_head_cents = Math.max(0, int(f.per_head_cents))
        if ("skills" in f) patch.skills = Array.isArray(f.skills) ? f.skills.map((x) => str(x, 40)).filter(Boolean).slice(0, 20) : []
        if ("areas" in f) patch.areas = Array.isArray(f.areas) ? f.areas.map((x) => str(x, 20)).filter(Boolean).slice(0, 10) : []
        if ("billing_cycle" in f) patch.billing_cycle = str(f.billing_cycle, 20) || "weekly"
        if ("status" in f && ["active", "inactive"].includes(String(f.status))) patch.status = String(f.status)
        if ("is_bookable" in f) patch.is_bookable = Boolean(f.is_bookable)
        const { error } = await supabase.from("staff_members").update(patch).eq("id", body.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "update_docs": {
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const f = (body.fields ?? {}) as Record<string, unknown>
        const last4 = (v: unknown) => {
          const d = str(v, 40).replace(/[^0-9A-Za-z]/g, "")
          return d ? d.slice(-4) : null
        }
        const patch: Record<string, unknown> = { updated_at: now }
        if ("food_handler_no" in f) patch.food_handler_no = str(f.food_handler_no, 60) || null
        if ("food_handler_exp" in f) patch.food_handler_exp = dateOrNull(f.food_handler_exp)
        if ("id_type" in f) patch.id_type = str(f.id_type, 40) || null
        if ("id_last4" in f) patch.id_last4 = last4(f.id_last4)
        if ("id_exp" in f) patch.id_exp = dateOrNull(f.id_exp)
        if ("tax_form" in f) patch.tax_form = str(f.tax_form, 20) || null
        if ("tax_legal_name" in f) patch.tax_legal_name = str(f.tax_legal_name, 120) || null
        if ("tax_id_last4" in f) patch.tax_id_last4 = last4(f.tax_id_last4)
        if ("tax_address" in f) patch.tax_address = str(f.tax_address, 300) || null
        const { error } = await supabase.from("staff_members").update(patch).eq("id", body.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "add_perf": {
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const date = dateOrNull(body.event_date)
        if (!date) return NextResponse.json({ error: "event_date required" }, { status: 400 })
        const review = body.review === "good" || body.review === "bad" ? body.review : null
        const { error } = await supabase.from("chef_performance").insert({
          staff_member_id: body.id,
          order_id: isUuid(body.order_id) ? body.order_id : null,
          event_date: date,
          customer_label: str(body.customer_label, 120) || null,
          review,
          comment: str(body.comment, 1000) || null,
          late_minutes: Math.max(0, int(body.late_minutes, 0)),
          source: "manual",
          created_by: actor.alias,
        })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "delete_perf": {
        if (!isUuid(body.perfId)) return NextResponse.json({ error: "perfId required" }, { status: 400 })
        const { error } = await supabase.from("chef_performance").delete().eq("id", body.perfId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "assign": {
        // Replace the team on one order. Head count is split evenly; every
        // active assignment gets its share recomputed (改人数后自动重分 is
        // done at read time when guest_share is null, so we clear it here).
        if (!isUuid(body.order_id)) return NextResponse.json({ error: "order_id required" }, { status: 400 })
        const want = (Array.isArray(body.staff_member_ids) ? body.staff_member_ids : []).filter(isUuid)
        const { data: existing } = await supabase.from("order_staff_assignments").select("id, staff_member_id, assignment_status").eq("order_id", body.order_id).in("assignment_status", ACTIVE_ASSIGNMENT)
        const have = new Set((existing ?? []).map((a) => a.staff_member_id))
        const toCancel = (existing ?? []).filter((a) => !want.includes(a.staff_member_id))
        const toAdd = want.filter((sid) => !have.has(sid))
        if (toCancel.length) {
          const { error } = await supabase.from("order_staff_assignments").update({ assignment_status: "cancelled", updated_at: now }).in("id", toCancel.map((a) => a.id))
          if (error) throw error
        }
        if (toAdd.length) {
          const { error } = await supabase.from("order_staff_assignments").insert(toAdd.map((sid) => ({ order_id: body.order_id, staff_member_id: sid, assignment_role: "lead_chef", assignment_status: "confirmed", assignment_source: "admin_manual", requested_by_customer: false, notes: str(body.note, 300) || null })))
          if (error) throw error
        }
        // Even split again for everyone still on the party.
        const { error: e2 } = await supabase.from("order_staff_assignments").update({ guest_share: null, updated_at: now }).eq("order_id", body.order_id).in("assignment_status", ACTIVE_ASSIGNMENT)
        if (e2) throw e2
        const { data: names } = want.length ? await supabase.from("staff_members").select("display_name, full_name").in("id", want) : { data: [] }
        await supabase.from("order_events").insert({ order_id: body.order_id, actor: `workbench:${actor.alias}`, action: "chef_assigned", metadata: { staff_member_ids: want, names: (names ?? []).map((n) => n.display_name ?? n.full_name), cancelled: toCancel.length } })
        return NextResponse.json({ ok: true, added: toAdd.length, cancelled: toCancel.length })
      }
      case "send_sheet": {
        // 发备料单：以前只能去发票工具点 Send to Chef，现在订单弹窗里直接发。
        // 真正干活的还是发票工具（它才有发票快照、令牌和 213 线），这里只转发。
        if (!can(actor, "sms")) return NextResponse.json({ error: "没有发短信的权限" }, { status: 403 })
        if (!isUuid(body.order_id)) return NextResponse.json({ error: "order_id required" }, { status: 400 })
        if (!isUuid(body.staff_member_id)) return NextResponse.json({ error: "staff_member_id required" }, { status: 400 })
        const { data: ord } = await supabase.from("orders").select("order_no, invoice_data").eq("id", body.order_id).maybeSingle()
        const orderNo = str((ord as { order_no?: string | null } | null)?.order_no, 30)
        if (!orderNo) return NextResponse.json({ error: "这单还没有订单号" }, { status: 400 })
        if (!(ord as { invoice_data?: unknown } | null)?.invoice_data) {
          return NextResponse.json({ error: "这单还没在发票工具里存过发票，先保存一次发票再发备料单。" }, { status: 400 })
        }
        type SheetResp = { ok?: boolean; url?: string; expiresAt?: string; resent?: boolean; error?: string; staff?: { name?: string }; sms?: { delivered?: boolean; error?: string } }
        let payload: SheetResp
        try {
          const res = await fetch(`${INVOICE_APP_ORIGIN}/api/chef-sheet/send`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              orderNo,
              staffMemberId: body.staff_member_id,
              note: str(body.note, 300) || undefined,
              sendSms: body.send_sms !== false,
              sentBy: `workbench:${actor.alias}`,
            }),
          })
          payload = (await res.json().catch(() => ({}))) as SheetResp
          // 502/504 会被 Cloudflare 换成它自己的错误页，理由就丢了——
          // 用 400 把发票工具的原话带回工作台。
          if (!res.ok || !payload.ok) return NextResponse.json({ error: payload.error ?? `发票工具返回 ${res.status}` }, { status: 400 })
        } catch (e) {
          return NextResponse.json({ error: e instanceof Error ? e.message : "连不上发票工具" }, { status: 400 })
        }
        return NextResponse.json({ ok: true, url: payload.url, expiresAt: payload.expiresAt, resent: payload.resent, sms: payload.sms })
      }
      case "set_cash": {
        if (!isUuid(body.assignment_id)) return NextResponse.json({ error: "assignment_id required" }, { status: 400 })
        const cents = body.cash_cents === null ? null : Math.max(0, int(body.cash_cents))
        const { error } = await supabase.from("order_staff_assignments").update({ cash_collected_cents: cents, updated_at: now }).eq("id", body.assignment_id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "settle": {
        // Close out every open shift (or the ones named) plus approved
        // receipts, write one settlement row, stamp the chef.
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const world = await loadWorld(supabase)
        const chef = world.staff.find((s) => s.id === body.id)
        if (!chef) return NextResponse.json({ error: "not found" }, { status: 404 })
        const staffById = new Map(world.staff.map((s) => [s.id, s]))
        const byOrder = new Map<string, Assignment[]>()
        for (const a of world.assignments) (byOrder.get(a.order_id) ?? byOrder.set(a.order_id, []).get(a.order_id)!).push(a)
        const today = ptToday()
        const only = Array.isArray(body.assignment_ids) ? new Set(body.assignment_ids.filter(isUuid)) : null
        const open = world.assignments
          .filter((a) => a.staff_member_id === body.id && !a.settled_at && world.orderMap.has(a.order_id))
          .map((a) => shiftOf(a, world.orderMap.get(a.order_id)!, byOrder.get(a.order_id) ?? [a], staffById, world.cashReported))
          .filter((x) => x.date && x.date <= today && x.orderStatus !== "cancelled" && (!only || only.has(x.assignmentId)))
        const { data: approved } = await supabase.from("chef_files").select("id, amount_cents").eq("staff_member_id", body.id).eq("kind", "receipt").eq("status", "approved")
        const reimb = only ? [] : approved ?? []
        const pay = open.reduce((a, x) => a + x.payCents, 0)
        const cash = open.reduce((a, x) => a + x.cashCents, 0)
        const reimbCents = reimb.reduce((a, f) => a + (f.amount_cents ?? 0), 0)
        const net = pay + reimbCents - cash
        const dates = open.map((x) => x.date).sort()
        const { data: settlement, error } = await supabase
          .from("chef_settlements")
          .insert({ staff_member_id: body.id, period_start: dates[0] ?? null, period_end: dates[dates.length - 1] ?? null, shifts: open.length, pay_cents: pay, reimb_cents: reimbCents, cash_cents: cash, net_cents: net, method: str(body.method, 30) || null, note: str(body.note, 500) || null, created_by: actor.alias })
          .select("id")
          .single()
        if (error) throw error
        if (open.length) {
          const { error: e1 } = await supabase.from("order_staff_assignments").update({ settled_at: now, settlement_id: settlement.id, pay_cents: undefined, updated_at: now }).in("id", open.map((x) => x.assignmentId))
          if (e1) throw e1
          // Freeze the pay actually settled so a later rate change cannot rewrite history.
          for (const x of open) await supabase.from("order_staff_assignments").update({ pay_cents: x.payCents, guest_share: x.share }).eq("id", x.assignmentId)
        }
        if (reimb.length) {
          const { error: e2 } = await supabase.from("chef_files").update({ status: "paid", settled_at: now, settlement_id: settlement.id }).in("id", reimb.map((f) => f.id))
          if (e2) throw e2
        }
        await supabase.from("staff_members").update({ last_settled_at: today, updated_at: now }).eq("id", body.id)
        return NextResponse.json({ ok: true, settlementId: settlement.id, shifts: open.length, payCents: pay, reimbCents, cashCents: cash, netCents: net })
      }
      case "unsettle": {
        if (!isUuid(body.assignment_id)) return NextResponse.json({ error: "assignment_id required" }, { status: 400 })
        const { error } = await supabase.from("order_staff_assignments").update({ settled_at: null, settlement_id: null, updated_at: now }).eq("id", body.assignment_id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "approve_receipt":
      case "reject_receipt": {
        if (!isUuid(body.file_id)) return NextResponse.json({ error: "file_id required" }, { status: 400 })
        const status = action === "approve_receipt" ? "approved" : "rejected"
        const { error } = await supabase.from("chef_files").update({ status, approved_at: now, approved_by: actor.alias, note: str(body.note, 300) || undefined }).eq("id", body.file_id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "upload": {
        // Small files only (≤ 8 MB base64): receipts, doc photos, W-9 PDFs.
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const kind = str(body.kind, 20)
        if (!["receipt", "photo", "video", "food_card", "id_doc", "w9", "other"].includes(kind)) return NextResponse.json({ error: "bad kind" }, { status: 400 })
        const file = (body.file ?? null) as { name?: string; type?: string; data?: string } | null
        let storagePath: string | null = null
        let bytes = 0
        let contentType: string | null = null
        if (file?.data) {
          const buf = Buffer.from(file.data, "base64")
          if (buf.length > 8 * 1024 * 1024) return NextResponse.json({ error: "file too large (8 MB)" }, { status: 413 })
          bytes = buf.length
          contentType = str(file.type, 80) || "application/octet-stream"
          const safe = str(file.name, 80).replace(/[^A-Za-z0-9._-]+/g, "_") || "file"
          storagePath = `chef-files/${body.id}/${Date.now()}-${safe}`
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, buf, { contentType, upsert: false })
          if (upErr) throw upErr
        }
        const amount = kind === "receipt" ? Math.max(0, int(body.amount_cents, 0)) : null
        const { data, error } = await supabase
          .from("chef_files")
          .insert({
            staff_member_id: body.id,
            order_id: isUuid(body.order_id) ? body.order_id : null,
            kind,
            title: str(body.title, 120) || (file?.name ? str(file.name, 120) : null),
            storage_path: storagePath,
            content_type: contentType,
            bytes,
            amount_cents: amount,
            status: kind === "receipt" ? "pending" : "none",
            note: str(body.note, 300) || null,
            uploaded_by: `workbench:${actor.alias}`,
          })
          .select("id")
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, id: data.id })
      }
      case "delete_chef": {
        // Removes the chef and everything that is only theirs (files, reviews,
        // prep-sheet links, unsettled assignments). Payroll history must survive,
        // so a chef with settled shifts or settlements is refused: 停用 instead.
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const { data: s } = await supabase.from("staff_members").select("id").eq("id", body.id).maybeSingle()
        if (!s) return NextResponse.json({ error: "厨师不存在" }, { status: 404 })
        const { count: settledShifts } = await supabase.from("order_staff_assignments").select("id", { count: "exact", head: true }).eq("staff_member_id", s.id).not("settled_at", "is", null)
        const { count: settlements } = await supabase.from("chef_settlements").select("id", { count: "exact", head: true }).eq("staff_member_id", s.id)
        if ((settledShifts ?? 0) > 0 || (settlements ?? 0) > 0) {
          return NextResponse.json({ error: "这位厨师有结算记录，不能删除；把状态改成「停用」即可" }, { status: 409 })
        }
        const { data: files } = await supabase.from("chef_files").select("storage_path").eq("staff_member_id", s.id)
        const paths = (files ?? []).map((f) => f.storage_path as string | null).filter((p): p is string => !!p)
        if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
        await supabase.from("chef_sheet_links").delete().eq("staff_member_id", s.id)
        await supabase.from("order_staff_assignments").delete().eq("staff_member_id", s.id)
        // chef_files / chef_performance / chef_settlements / chef_feedback / staff_credentials cascade in the database.
        const { error } = await supabase.from("staff_members").delete().eq("id", s.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "delete_file": {
        if (!isUuid(body.file_id)) return NextResponse.json({ error: "file_id required" }, { status: 400 })
        const { data: f } = await supabase.from("chef_files").select("storage_path, status").eq("id", body.file_id).maybeSingle()
        if (f?.status === "paid") return NextResponse.json({ error: "已结算的发票不能删" }, { status: 409 })
        if (f?.storage_path) await supabase.storage.from(BUCKET).remove([f.storage_path])
        const { error } = await supabase.from("chef_files").delete().eq("id", body.file_id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 })
    }
  } catch (e) {
    // Supabase errors are plain objects, not Error instances: read their message
    // instead of returning "[object Object]" to the workbench.
    const msg = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e)
    console.error("[admin/chefs]", action, msg, e && typeof e === "object" && "details" in e ? (e as { details?: unknown }).details : "")
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export type { AdminActor }
