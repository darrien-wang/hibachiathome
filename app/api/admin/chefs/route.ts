import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { can, resolveAdminActor, type AdminActor } from "@/lib/admin-auth"
import { chefPayCents, chefPayCentsFrac, docState, payableHeads, tableChairCents, taxMissing, travelCompCents, CARD_FEE_RATE, KID_HEAD_FACTOR, TABLE_CHAIR_PER_HEAD_CENTS, TRAVEL_FREE_MILES, TRAVEL_BASE_CENTS, TRAVEL_PER_MILE_CENTS, REVIEW_PLAIN_CENTS, REVIEW_PHOTO_CENTS, applyChefPayRule, describeChefPayRule, normalizeChefPayRule, type ChefPayRule, type ChefRate, type HeadCounts } from "@/lib/chef-pay"
import { randomBytes } from "node:crypto"
import { registerFinalPayment } from "@/lib/final-payment"
import { assetLabel } from "@/lib/staff-assets"
import { chefDriveMiles, type DriveMiles } from "@/lib/chef-drive-miles"
import { CARD_PROCESSING_RATE, cardProcessingFeeInside, DEFAULT_SALES_TAX_RATE, normalizePricingTerms, pricingTermsFor, salesTaxOn, type PricingTerms } from "@/config/pricing-rules"
import { formatTaxRate } from "@/lib/sales-tax-rate"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 厨师 · 名单、派单、表现、文件、结算。
//   GET                    -> { chefs: ChefSummary[], assignments: {orderId: [...]}, alertsCount }
//   GET ?id=<staff uuid>   -> { chef, shifts, performance, files, settlements, assets }
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
const hideShiftMoney = <T extends { payCents: number; cashCents: number; cashSource: string; settledAt: string | null }>(x: T): T => ({ ...x, payCents: 0, cashCents: 0, cardTipCents: 0, cardGrossCents: 0, cardFeeCents: 0, cashTipCents: 0, paySettledCents: 0, tablesCents: 0, travelCents: 0, reviewCents: 0, cashSource: "none", settledAt: null })
const ACTIVE_ASSIGNMENT = ["tentative", "confirmed", "completed"]
const STAFF_COLUMNS =
  "id, full_name, display_name, staff_type, status, email, phone, notes, is_bookable, allow_customer_request, wechat, base_pay_cents, head_from, per_head_cents, skills, areas, billing_cycle, last_settled_at, food_handler_no, food_handler_exp, id_type, id_last4, id_exp, tax_form, tax_legal_name, tax_id_last4, tax_address, created_at, updated_at"
const ORDER_COLUMNS = "id, order_no, customer_name, customer_phone, event_start, event_address, guest_adult_count, guest_child_count, order_status, balance_due_cents, quoted_total_cents, service_duration_minutes, invoice_data, created_at, source_metadata"

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
  settlement_method: SettleMethod | null
  card_gross_cents: number | null
  card_fee_cents: number | null
  card_tip_cents: number | null
  cash_tip_cents: number | null
  settlement_ref: string | null
  settlement_note: string | null
  pay_settled_at: string | null
  pay_settled_cents: number | null
  tables_cents: number | null
  travel_cents: number | null
  comp_breakdown: Record<string, unknown> | null
  has_tables_override: boolean | null
  review_plain_count: number
  review_photo_count: number
  review_cents: number | null
}
type SettleMethod = "cash" | "card" | "prepaid" | "other"
const SETTLE_METHODS = new Set<SettleMethod>(["cash", "card", "prepaid", "other"])
type OrderLite = {
  service_duration_minutes?: number | null
  created_at?: string | null
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
  invoice_data?: Record<string, unknown> | null
  source_metadata?: Record<string, unknown> | null
  /** Special head rule from the order's lead (leads.chef_pay_rule), attached by loadWorld. */
  chef_pay_rule?: ChefPayRule | null
}

/** Which pricing terms a party bills under: what the invoice recorded, else the order's age. */
function termsOfOrder(o: { invoice_data?: Record<string, unknown> | null; created_at?: string | null }): PricingTerms {
  const stored = o.invoice_data?.pricingTerms
  return typeof stored === "string" ? normalizePricingTerms(stored) : pricingTermsFor(o.created_at ?? null)
}

type PartyTax = { taxCents: number; rateLabel: string; source: "address" | "default" | "none" }

/**
 * The sales tax on a v2 party, for netting a card payment: the invoice engine's
 * live figure first (its balance API carries the rate for the party address),
 * else the rate the saved invoice recorded applied to the listed total
 * (quoted_total_cents is the cash total), else the default rate - flagged, so
 * nobody books a settlement on an estimate without knowing. Never a constant.
 */
async function invoiceTaxFor(orderId: string, ord: { quoted_total_cents?: number | null; invoice_data?: Record<string, unknown> | null } | null): Promise<PartyTax> {
  try {
    const res = await fetch(`${INVOICE_APP_ORIGIN}/api/self-service/orders/balance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orderId }),
    })
    const j = (await res.json().catch(() => ({}))) as { found?: boolean; salesTax?: number; salesTaxRate?: number; salesTaxRateSource?: "address" | "default" | "none" }
    if (res.ok && j.found && typeof j.salesTax === "number" && typeof j.salesTaxRate === "number") {
      return { taxCents: Math.round(j.salesTax * 100), rateLabel: formatTaxRate(j.salesTaxRate), source: j.salesTaxRateSource ?? "address" }
    }
  } catch {
    // fall through to the saved invoice
  }
  const inv = ord?.invoice_data ?? {}
  const stored = typeof inv.salesTaxRate === "number" ? inv.salesTaxRate : null
  const rate = stored ?? DEFAULT_SALES_TAX_RATE
  const listed = Math.max(0, ord?.quoted_total_cents ?? 0) / 100
  return { taxCents: Math.round(salesTaxOn(listed, rate) * 100), rateLabel: formatTaxRate(rate), source: stored != null ? "address" : "default" }
}

const ptToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })

// event_start 是墙上时间按 UTC 存的，所以"现在"也要换成 PT 墙上时间再比，
// 否则会差 7 小时。派对结束 = 开席 + 时长（没填按 2 小时）+ 30 分钟收拾。
const ptNowWall = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`
}
function partyEndedAt(o: OrderLite): string | null {
  if (!o.event_start) return null
  const ms = Date.parse(o.event_start)
  if (!Number.isFinite(ms)) return null
  return new Date(ms + ((o.service_duration_minutes ?? 120) + 30) * 60_000).toISOString().slice(0, 16)
}
const eventYmd = (iso: string | null) => (iso ? iso.slice(0, 10) : "")
const rateOf = (s: Staff): ChefRate => ({ base_pay_cents: Number(s.base_pay_cents ?? 0), head_from: Number(s.head_from ?? 16), per_head_cents: Number(s.per_head_cents ?? 0) })
const nameOf = (s: Staff) => String(s.display_name ?? s.full_name ?? "").trim() || "未命名"
const guestsOf = (o: OrderLite) => (o.guest_adult_count ?? 0) + (o.guest_child_count ?? 0)

async function loadWorld(supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>) {
  const [{ data: staff }, { data: assignments }, { data: sheets }] = await Promise.all([
    supabase.from("staff_members").select(STAFF_COLUMNS).neq("status", "deleted").order("display_name", { ascending: true }),
    supabase
      .from("order_staff_assignments")
      .select("id, order_id, staff_member_id, assignment_status, guest_share, pay_cents, cash_collected_cents, settled_at, notes, created_at, settlement_method, card_gross_cents, card_fee_cents, card_tip_cents, cash_tip_cents, settlement_ref, settlement_note, pay_settled_at, pay_settled_cents, tables_cents, travel_cents, comp_breakdown, has_tables_override, review_plain_count, review_photo_count, review_cents")
      .in("assignment_status", ACTIVE_ASSIGNMENT)
      .limit(2000),
    supabase.from("chef_sheet_links").select("order_id, staff_member_id, assignment_id, cash_collected_cents, tip_reported_cents, collected_at").not("collected_at", "is", null).limit(2000),
  ])
  const orderIds = Array.from(new Set((assignments ?? []).map((a) => a.order_id)))
  const { data: orders } = orderIds.length ? await supabase.from("orders").select(ORDER_COLUMNS).in("id", orderIds) : { data: [] as OrderLite[] }
  const orderMap = new Map<string, OrderLite>()
  for (const o of (orders ?? []) as OrderLite[]) orderMap.set(o.id, o)
  // 谈价时定在线索上的特殊人头规则（lib/chef-pay.ts ChefPayRule），顺着订单的
  // lead_id 带过来 —— 派师傅、结账的人不用记得手改工钱（老板 2026-10-10）。
  const leadOf = (o: OrderLite) => String(o.source_metadata?.lead_id ?? "")
  const leadIds = Array.from(new Set([...orderMap.values()].map(leadOf).filter((id) => /^[0-9a-f-]{36}$/i.test(id))))
  if (leadIds.length) {
    const { data: ruled } = await supabase.from("leads").select("id, chef_pay_rule").in("id", leadIds).not("chef_pay_rule", "is", null)
    const byLead = new Map((ruled ?? []).map((r) => [String(r.id), normalizeChefPayRule(r.chef_pay_rule)]))
    for (const o of orderMap.values()) {
      const rule = byLead.get(leadOf(o))
      if (rule) o.chef_pay_rule = rule
    }
  }
  // Cash the chef reported on the prep sheet, latest per order+chef.
  const cashReported = new Map<string, number>()
  for (const s of sheets ?? []) {
    const k = `${s.order_id}|${s.staff_member_id}`
    if (!cashReported.has(k)) cashReported.set(k, Number(s.cash_collected_cents ?? 0))
  }
  // 路费里程：只量还没定下路费（结过的场冻结在 travel_cents 里）、发票上又没有
  // 50 mi 以上里程的单 —— 规则见 shiftOf。
  const unpriced = new Set(((assignments ?? []) as Assignment[]).filter((a) => a.travel_cents == null).map((a) => a.order_id))
  const needMiles = [...orderMap.values()].filter((o) => {
    if (!unpriced.has(o.id)) return false
    const m = partyComp(o).miles
    return m == null || m <= TRAVEL_FREE_MILES
  })
  const drive = await chefDriveMiles(supabase, needMiles)
  return { staff: (staff ?? []) as Staff[], assignments: (assignments ?? []) as Assignment[], orderMap, cashReported, drive }
}

/**
 * 一场派对的计钱要素，全部来自发票（和发票工具同一套判定）：
 *   大人/收费小孩/免费小孩 —— detailed 按 guests 行数；免费小孩以 under5 促销
 *   行为准（它才是"这个孩子没收钱"的账面记录），quick 模式同理。
 *   桌椅人头 —— detailed 数勾了 tablesChairs 的客人；quick 看 partyWideAddons。
 *   里程 —— 发票 travelFee.distanceMiles（客户免不免路费不影响给师傅补）。
 *            2026-10-04 起这只是后备：师傅的里程按地址实量（lib/chef-drive-miles.ts），
 *            发票上客人路费手填时这个数是空的或被改过。
 */
function partyComp(o: OrderLite): { counts: HeadCounts; tableHeads: number; miles: number | null } {
  const inv = (o.invoice_data ?? {}) as Record<string, unknown>
  const guests = Array.isArray(inv.guests) ? (inv.guests as Array<Record<string, unknown>>) : []
  const promos = Array.isArray(inv.promotions) ? (inv.promotions as Array<Record<string, unknown>>) : []
  const under5 = promos.find((p) => /^little kids/i.test(String(p.label ?? "")))
  const under5N = under5 ? Number(String(under5.label ?? "").match(/×(\d+)/)?.[1] ?? 1) : 0

  let adults: number
  let kids: number
  let littles: number
  let tableHeads: number
  if (inv.mode === "detailed" && guests.length) {
    adults = guests.filter((g) => g.isChild !== true).length
    const flagged = guests.filter((g) => g.isChild === true && g.isLittle === true).length
    littles = Math.max(flagged, under5N)
    kids = Math.max(0, guests.filter((g) => g.isChild === true).length - littles)
    tableHeads = guests.filter((g) => g.tablesChairs === true).length
  } else {
    adults = Number(inv.adultCount ?? o.guest_adult_count ?? 0) || 0
    const child = Number(inv.childCount ?? o.guest_child_count ?? 0) || 0
    littles = Math.min(child, under5N)
    kids = Math.max(0, child - littles)
    const pwa = Array.isArray(inv.partyWideAddons) ? (inv.partyWideAddons as unknown[]) : []
    tableHeads = pwa.includes("tables_chairs") ? adults + child : 0
  }
  const tf = (inv.travelFee ?? null) as Record<string, unknown> | null
  // distanceMiles 没填就是没填（null 别折成 0）：路费显示 "?" 提醒补里程，而不是假装 $0。
  const miles = tf && tf.distanceMiles != null && Number.isFinite(Number(tf.distanceMiles)) ? Number(tf.distanceMiles) : null
  return { counts: { adults, kids, littles }, tableHeads, miles }
}

/** One chef's shift on one order, with the pay/cash/settlement the ledger needs. */
function shiftOf(a: Assignment, o: OrderLite, team: Assignment[], staffById: Map<string, Staff>, cashReported: Map<string, number>, drive: Map<string, DriveMiles>, nowWall = ptNowWall()) {
  const s = staffById.get(a.staff_member_id)
  const endedAt = partyEndedAt(o)
  const guests = guestsOf(o)
  const n = Math.max(1, team.length)
  const share = a.guest_share ?? Math.round(guests / n)
  // 明细三件套。多位师傅同场：人头和桌椅按份平分，路费每人全额（各开各的车）。
  const comp = partyComp(o)
  // 特殊规则（发票按大人备料、工钱按小孩算）只改计钱的人头，不改发票。
  const counts = applyChefPayRule(comp.counts, o.chef_pay_rule)
  const hasTables = a.has_tables_override ?? comp.tableHeads > 0
  const tableHeads = hasTables ? (comp.tableHeads > 0 ? comp.tableHeads : guests) : 0
  const heads = payableHeads(counts) / n
  const pay = a.pay_cents ?? (s ? chefPayCentsFrac(rateOf(s), heads) : 0)
  const tables = a.tables_cents ?? Math.round(tableChairCents(tableHeads) / n)
  // 发票上量过、而且超过 50 mi：客人就是按这个数付的路费，师傅照这个数。发票没量，
  // 或者在 50 以内（客人路费手填 $0、里程被改成 50 都是这样），按地址实量 ——
  // 客户那头免不免路费都照给师傅（2026-10-04，Niko/Nasim West Hills 53.7 mi）。
  const invoiceCounts = comp.miles != null && comp.miles > TRAVEL_FREE_MILES
  const measured = invoiceCounts ? undefined : drive.get(o.id)
  const miles = measured?.miles ?? comp.miles
  const milesSource = measured ? measured.source : comp.miles != null ? "invoice" : null
  const travel = a.travel_cents ?? travelCompCents(miles)
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
    tablesCents: tables,
    travelCents: travel,
    counts,
    chefRule: o.chef_pay_rule ? { ...o.chef_pay_rule, label: describeChefPayRule(o.chef_pay_rule) } : null,
    tableHeads,
    hasTables,
    miles,
    milesSource,
    cashCents: cash,
    cashSource: a.cash_collected_cents != null ? "manual" : cashReported.has(`${o.id}|${a.staff_member_id}`) ? "chef_sheet" : "none",
    // 派对办完之前不知道尾款怎么收，所以这场先不进结算。
    partyOver: endedAt != null && endedAt <= nowWall,
    method: a.settlement_method ?? null,
    cardGrossCents: a.card_gross_cents ?? 0,
    cardFeeCents: a.card_fee_cents ?? 0,
    cardTipCents: a.card_tip_cents ?? 0,
    cashTipCents: a.cash_tip_cents ?? 0,
    settlementRef: a.settlement_ref ?? null,
    settlementNote: a.settlement_note ?? null,
    // 工钱提前结过就不再欠了，这场剩下的只有小费和代收。
    paySettledAt: a.pay_settled_at,
    paySettledCents: a.pay_settled_cents ?? 0,
    settledAt: a.settled_at,
    status: a.assignment_status,
    orderStatus: o.order_status,
    balanceDueCents: o.balance_due_cents,
    // v1 (through 2026-10-05): card payments carry the 4% fee. v2 "by method"
    // (D-1006-05): a card payment carries the party's sales tax and Stripe's
    // processing instead - the statement labels its lines by this.
    pricingTerms: termsOfOrder(o),
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
      .map((a) => shiftOf(a, world.orderMap.get(a.order_id)!, byOrder.get(a.order_id) ?? [a], staffById, world.cashReported, world.drive))
      .sort((x, y) => (y.date || "").localeCompare(x.date || ""))
    const [{ data: performance }, { data: files }, { data: settlements }, { data: assetRows }, { data: reviewRows }] = await Promise.all([
      supabase.from("chef_performance").select("*").eq("staff_member_id", id).order("event_date", { ascending: false }).limit(300),
      supabase.from("chef_files").select("id, order_id, kind, title, content_type, bytes, amount_cents, status, approved_at, settled_at, note, uploaded_by, created_at").eq("staff_member_id", id).order("created_at", { ascending: false }).limit(300),
      supabase.from("chef_settlements").select("id, period_start, period_end, shifts, pay_cents, reimb_cents, cash_cents, tip_cents, tables_cents, travel_cents, review_cents, token, net_cents, method, note, created_by, created_at").eq("staff_member_id", id).order("created_at", { ascending: false }).limit(60),
      supabase.from("staff_assets").select("id, item_key, label, qty, size, issued_on, returned_on, condition, unit_cost_cents, note, created_by").eq("staff_member_id", id).order("issued_on", { ascending: false }).limit(200),
      supabase.from("chef_review_bonuses").select("id, platform, review_date, reviewer, has_photo, excerpt, url, review_id, cents, settlement_id, settled_at, created_at").eq("staff_member_id", id).order("review_date", { ascending: false }).limit(120),
    ])
    const assets = (assetRows ?? []).map((a) => ({ ...a, label: assetLabel(String(a.item_key), String(a.label ?? "")) }))
    if (!can(actor, "chef_sensitive")) {
      // 工服在谁手上不是敏感信息，采购价才是。
      const assetsSafe = assets.map((a) => ({ ...a, unit_cost_cents: null }))
      return NextResponse.json({ ok: true, chef: publicStaff(chef), shifts: shifts.map(hideShiftMoney), performance: performance ?? [], files: (files ?? []).filter((f) => MEDIA_KINDS.has(String(f.kind))), settlements: [], assets: assetsSafe, reviews: [], today, sensitive: false })
    }
    return NextResponse.json({ ok: true, chef, shifts, performance: performance ?? [], files: files ?? [], settlements: settlements ?? [], assets, reviews: reviewRows ?? [], today, sensitive: true })
  }

  // List: everything the 名单 table and the nav badge need.
  const ids = world.staff.map((s) => s.id)
  const [{ data: perfRows }, { data: pendingFiles }] = await Promise.all([
    ids.length ? supabase.from("chef_performance").select("staff_member_id, review, late_minutes").in("staff_member_id", ids).limit(5000) : { data: [] },
    ids.length ? supabase.from("chef_files").select("staff_member_id, amount_cents").eq("kind", "receipt").eq("status", "pending").in("staff_member_id", ids) : { data: [] },
  ])
  const chefs = world.staff.map((s) => {
    const mine = world.assignments.filter((a) => a.staff_member_id === s.id && world.orderMap.has(a.order_id))
    const shifts = mine.map((a) => shiftOf(a, world.orderMap.get(a.order_id)!, byOrder.get(a.order_id) ?? [a], staffById, world.cashReported, world.drive))
    // 名单上的结余也只认"办完了 + 确认过尾款怎么收的"那些场，不然派单当天
    // 就会写着欠他多少，而那时候钱进谁口袋还不知道。
    const live = shifts.filter((x) => !x.settledAt && x.orderStatus !== "cancelled")
    const open = live.filter((x) => x.partyOver && !!x.method)
    const awaiting = live.filter((x) => x.partyOver && !x.method)
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
      awaitingMethod: awaiting.length,
      openPayCents: open.reduce((a, x) => a + (x.paySettledAt ? 0 : x.payCents), 0),
      openCashCents: open.reduce((a, x) => a + x.cashCents, 0),
      openTipCents: open.reduce((a, x) => a + x.cardTipCents, 0),
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
    const safe = chefs.map((c) => ({ ...c, rate: null, billing_cycle: "", last_settled_at: null, shifts: c.shifts.map(hideShiftMoney), openPayCents: 0, openCashCents: 0, openTipCents: 0, approvedReimbCents: 0, pendingReceipts: 0, pendingReceiptCents: 0, doc: { ...c.doc, level: "ok" as const, label: "" }, taxMissing: false }))
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
const OWNER_ACTIONS = new Set(["update_profile", "update_docs", "settle", "unsettle", "approve_receipt", "reject_receipt", "delete_file", "delete_perf", "set_cash", "archive", "delete_chef", "issue_assets", "return_asset", "delete_asset", "set_settlement", "card_lookup", "set_tables", "add_review", "delete_review", "settle_reviews"])

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
      case "issue_assets": {
        // 领用登记：一次可以发一整套（帽子 + 厨师服 + 围裙）。同一个人、同一件、
        // 同一天重发只会更新那一行，不会记成领了两件。
        if (!isUuid(body.staff_member_id)) return NextResponse.json({ error: "staff_member_id required" }, { status: 400 })
        const issuedOn = dateOrNull(body.issued_on) ?? ptToday()
        const raw = Array.isArray(body.items) ? body.items : []
        const rows = raw.slice(0, 30).map((x) => {
          const it = (x ?? {}) as Record<string, unknown>
          const key = str(it.item_key, 40)
          const qty = Math.max(1, int(it.qty, 1))
          const cost = it.unit_cost === undefined || it.unit_cost === null ? null : Math.round(Number(it.unit_cost) * 100)
          return {
            staff_member_id: body.staff_member_id as string,
            item_key: key,
            label: assetLabel(key, str(it.label, 80)),
            qty,
            size: str(it.size, 20) || null,
            issued_on: issuedOn,
            unit_cost_cents: Number.isFinite(cost) && (cost as number) >= 0 ? cost : null,
            note: str(it.note, 200) || str(body.note, 200) || null,
            created_by: actor.alias,
            updated_at: now,
          }
        })
        const bad = rows.find((r) => !r.item_key || !r.label)
        if (!rows.length || bad) return NextResponse.json({ error: "每件都要 item_key（目录外的再带一个 label）" }, { status: 400 })
        const { data, error } = await supabase.from("staff_assets").upsert(rows, { onConflict: "staff_member_id,item_key,issued_on" }).select("id, item_key, label, qty")
        if (error) throw error
        return NextResponse.json({ ok: true, issued: data ?? [] })
      }
      case "return_asset": {
        if (!isUuid(body.asset_id)) return NextResponse.json({ error: "asset_id required" }, { status: 400 })
        const { error } = await supabase
          .from("staff_assets")
          .update({ returned_on: dateOrNull(body.returned_on) ?? ptToday(), condition: str(body.condition, 60) || null, note: str(body.note, 200) || undefined, updated_at: now })
          .eq("id", body.asset_id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "delete_asset": {
        // 只在记错了的时候用——正常的"还回来了"走 return_asset，别把记录抹掉。
        if (!isUuid(body.asset_id)) return NextResponse.json({ error: "asset_id required" }, { status: 400 })
        const { error } = await supabase.from("staff_assets").delete().eq("id", body.asset_id)
        if (error) throw error
        return NextResponse.json({ ok: true })
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
      case "card_lookup": {
        // 刷卡那场：用订单上的 Stripe 付款查一次真实到账。以前要自己去 Stripe
        // 后台导表，现在按一下就把总额、手续费、净额拉回来。这只是查，
        // 老板确认了才写。
        if (!isUuid(body.assignment_id)) return NextResponse.json({ error: "assignment_id required" }, { status: 400 })
        const { data: asn } = await supabase.from("order_staff_assignments").select("order_id").eq("id", body.assignment_id).maybeSingle()
        if (!asn) return NextResponse.json({ error: "assignment not found" }, { status: 404 })
        const { data: ord } = await supabase.from("orders").select("balance_due_cents, quoted_total_cents, created_at, invoice_data, chosen_gratuity_cents").eq("id", asn.order_id).maybeSingle()
        const { data: pays } = await supabase
          .from("payments")
          .select("id, type, provider, status, amount_cents, external_payment_id, paid_at")
          .eq("order_id", asn.order_id)
          .eq("status", "paid")
          .order("paid_at", { ascending: false })
        const rows = (pays ?? []) as Array<{ id: string; type: string; provider: string; amount_cents: number; external_payment_id: string | null; paid_at: string | null }>
        const card = rows.find((r) => r.provider === "stripe" && r.type === "final") ?? rows.find((r) => r.provider === "stripe")
        const balanceNow = Math.max(0, ord?.balance_due_cents ?? 0)
        if (!card?.external_payment_id) {
          return NextResponse.json({ ok: true, found: false, balanceRefCents: balanceNow, reason: "这单在 payments 里没有 Stripe 付款，金额自己填。" })
        }
        // 这笔之外已经收到的钱（押金等），用来还原当天该收多少尾款——尾款一旦
        // 登记，orders.balance_due_cents 就变 0 了，不能只看它。
        const others = rows.filter((r) => r.id !== card.id).reduce((n, r) => n + (r.amount_cents ?? 0), 0)
        const fromTotal = Math.max(0, (ord?.quoted_total_cents ?? 0) - others)
        const balanceRefCents = balanceNow > 0 ? balanceNow : fromTotal
        // 手续费一律按 4% 计（2026-09-28 用户定）：不查 Stripe 实扣，
        // 和发票上收客人的 Card Processing Fee 用同一个数。gross 就是
        // payments 里记的实刷金额，所以这里连 Stripe API 都不用碰。
        // 2026-10-01 起刷卡价 = 现金价 × 1.04（发票刷卡价、/pay 专属链接同一
        // 口径），所以 4% 要从实刷里 ÷1.04 拿掉，不是 ×0.96——后者多扣一点，
        // 师傅拿到的就比 /pay 上告诉客人的"$X for your chef"少（$1,213.87 少 $1.86）。
        // 那是 v1（10-05 及之前的单）。v2 "by method"（D-1006-05，10-06 起）：刷卡账 =
        // 现金尾款 + 派对地址的销售税 + 刷卡手续费 3% + 小费。拆回来和
        // /pay 记账同一套：手续费按实刷算，税是发票引擎给的这单的税（不用常数税率
        // 重算），剩下的抵尾款，再剩下的是小费。公司净得 = 实刷 − 税 − 手续费 − 小费。
        const terms = termsOfOrder(ord ?? {})
        const v2 = terms === "v2_by_method"
        const grossCents = card.amount_cents ?? 0
        const tax = v2 ? await invoiceTaxFor(String(asn.order_id), ord ?? null) : null
        const taxCents = tax?.taxCents ?? 0
        const feeCents = v2 ? Math.round(cardProcessingFeeInside(grossCents / 100) * 100) : grossCents - Math.round(grossCents / (1 + CARD_FEE_RATE))
        const netCents = Math.max(0, grossCents - taxCents - feeCents)
        return NextResponse.json({
          ok: true,
          found: true,
          paymentId: card.external_payment_id,
          paidAt: card.paid_at,
          grossCents,
          feeCents,
          taxCents,
          netCents,
          balanceRefCents,
          terms,
          taxRateLabel: tax?.rateLabel ?? null,
          // "default" = the invoice has not been rated by the party address yet; the
          // tax above is an estimate and the owner should re-rate before booking it.
          taxRateSource: tax?.source ?? "none",
          feeRatePct: v2 ? CARD_PROCESSING_RATE * 100 : CARD_FEE_RATE * 100,
          feeFixedCents: 0,
          // What the customer typed on /pay as the chef's gratuity (the split at payment time).
          chosenTipCents: typeof ord?.chosen_gratuity_cents === "number" ? ord.chosen_gratuity_cents : null,
          tipCents: Math.max(0, netCents - balanceRefCents),
        })
      }
      case "add_review": {
        // 每周搜师傅名字（Google/Yelp）搜到的好评，一条一条记：无图 $2、带图 $3。
        // 金额录入时冻结，以后调价不改老账。
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const platform = ["google", "yelp", "other"].includes(String(body.platform)) ? String(body.platform) : "google"
        const hasPhoto = body.has_photo === true
        const { data: rev, error } = await supabase
          .from("chef_review_bonuses")
          .insert({
            staff_member_id: body.id,
            platform,
            review_date: dateOrNull(body.review_date) ?? ptToday(),
            reviewer: str(body.reviewer, 80) || null,
            has_photo: hasPhoto,
            excerpt: str(body.excerpt, 300) || null,
            url: str(body.url, 500) || null,
            order_id: isUuid(body.order_id) ? body.order_id : null,
            cents: hasPhoto ? REVIEW_PHOTO_CENTS : REVIEW_PLAIN_CENTS,
            created_by: actor.alias,
          })
          .select("id, cents")
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, id: rev.id, cents: rev.cents })
      }
      case "delete_review": {
        // 只删还没结算的；结过的已经在对账单里，不能抹。
        if (!isUuid(body.review_id)) return NextResponse.json({ error: "review_id required" }, { status: 400 })
        // 好评主档若挂着这条奖励，一并解开（那条评价回到“可再记”状态）。
        await supabase.from("business_reviews").update({ bonus_id: null, staff_member_id: null }).eq("bonus_id", body.review_id)
        const { error } = await supabase.from("chef_review_bonuses").delete().eq("id", body.review_id).is("settlement_id", null)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "set_tables": {
        // 发票没写但实际带了桌椅（或反过来）：手动扳一下，null = 回到按发票判。
        if (!isUuid(body.assignment_id)) return NextResponse.json({ error: "assignment_id required" }, { status: 400 })
        const v = body.has_tables === null ? null : body.has_tables === true
        const { error } = await supabase.from("order_staff_assignments").update({ has_tables_override: v, updated_at: now }).eq("id", body.assignment_id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "set_settlement": {
        // 这场的尾款怎么收的。填了才进本期结算。
        if (!isUuid(body.assignment_id)) return NextResponse.json({ error: "assignment_id required" }, { status: 400 })
        if (body.method === null) {
          const { error } = await supabase
            .from("order_staff_assignments")
            .update({ settlement_method: null, settlement_at: null, card_gross_cents: null, card_fee_cents: null, card_tip_cents: null, settlement_ref: null, updated_at: now })
            .eq("id", body.assignment_id)
          if (error) throw error
          return NextResponse.json({ ok: true, cleared: true })
        }
        const method = str(body.method, 10) as SettleMethod
        if (!SETTLE_METHODS.has(method)) return NextResponse.json({ error: "method 只能是 cash / card / prepaid / other" }, { status: 400 })
        const dollars = (v: unknown) => (v === undefined || v === null || v === "" ? null : Math.round(Number(v) * 100))
        const nums = { cash: dollars(body.cash_collected), gross: dollars(body.card_gross), fee: dollars(body.card_fee), tip: dollars(body.card_tip), cashTip: dollars(body.cash_tip) }
        for (const v of Object.values(nums)) if (v !== null && !Number.isFinite(v)) return NextResponse.json({ error: "金额不对" }, { status: 400 })
        const patch: Record<string, unknown> = {
          settlement_method: method,
          settlement_at: now,
          settlement_ref: str(body.ref, 80) || null,
          settlement_note: str(body.note, 300) || null,
          // 代收现金只有 cash 这一路；刷卡的钱进我们账上，师傅手上是 0。
          cash_collected_cents: method === "cash" ? Math.max(0, nums.cash ?? 0) : 0,
          card_gross_cents: method === "card" ? nums.gross : null,
          card_fee_cents: method === "card" ? nums.fee : null,
          card_tip_cents: method === "card" ? Math.max(0, nums.tip ?? 0) : 0,
          updated_at: now,
        }
        // 客人当场塞的现金小费，哪种收款方式都可能有；师傅自己留着，不进净额。
        if (nums.cashTip !== null) patch.cash_tip_cents = Math.max(0, nums.cashTip)
        const { error } = await supabase.from("order_staff_assignments").update(patch).eq("id", body.assignment_id)
        if (error) throw error
        // 订单侧同步（2026-09-28 用户定：手动"登记尾款已收"卡已删，这里是唯一入口）：
        //   cash    -> 师傅代收里抵尾款的部分记成 cash 已收（超出部分是小费，不进订单）
        //   prepaid -> 老板说钱早到了（老单的 Zelle/转账；10-06 起客人不再走这些渠道，D-1006-06），把还挂着的尾款记成已收
        //   card    -> /pay 的 webhook 自己会记，这里不动
        let orderSync: string | null = null
        if (method === "cash" || method === "prepaid") {
          const { data: asn2 } = await supabase.from("order_staff_assignments").select("order_id").eq("id", body.assignment_id).maybeSingle()
          const { data: ord2 } = asn2
            ? await supabase.from("orders").select("id, balance_due_cents").eq("id", asn2.order_id).maybeSingle()
            : { data: null }
          const due = ord2?.balance_due_cents ?? 0
          if (ord2 && due > 0) {
            const amountCents = method === "cash" ? Math.min(Math.round(nums.cash ?? 0), due) : due
            if (amountCents > 0) {
              const r = await registerFinalPayment(supabase, {
                orderId: ord2.id as string,
                amountCents,
                channel: method === "cash" ? "cash" : "other",
                operator: actor.alias,
                entrySurface: "chef_settlement",
                note: method === "cash" ? "chef collected at the party" : "prepaid/transfer per settlement",
              })
              orderSync = r.ok ? `订单已同步登记已收 $${(amountCents / 100).toFixed(2)}` : `订单登记没成：${r.error}`
            }
          }
        }
        return NextResponse.json({ ok: true, orderSync })
      }
      case "settle": {
        // 一次结账。每场分两种：
        //   办完了 + 确认过尾款怎么收的  -> 全结（工钱 + 小费 − 代收），这场清了
        //   还没办完 / 还没确认           -> 只结工钱（提前付），代收和小费等派对
        //                                    办完再补一笔，这场先不算清
        // 工钱结过的场再全结时工钱记 0，不会付两次。
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const world = await loadWorld(supabase)
        const chef = world.staff.find((s) => s.id === body.id)
        if (!chef) return NextResponse.json({ error: "not found" }, { status: 404 })
        const staffById = new Map(world.staff.map((s) => [s.id, s]))
        const byOrder = new Map<string, Assignment[]>()
        for (const a of world.assignments) (byOrder.get(a.order_id) ?? byOrder.set(a.order_id, []).get(a.order_id)!).push(a)
        const today = ptToday()
        const only = Array.isArray(body.assignment_ids) ? new Set(body.assignment_ids.filter(isUuid)) : null
        const mine = world.assignments
          .filter((a) => a.staff_member_id === body.id && !a.settled_at && world.orderMap.has(a.order_id))
          .map((a) => shiftOf(a, world.orderMap.get(a.order_id)!, byOrder.get(a.order_id) ?? [a], staffById, world.cashReported, world.drive))
          .filter((x) => x.orderStatus !== "cancelled")
        // 逐场结：老板点哪场结哪场（包括提前结一场还没办的）。
        // 一键结清：只收已经办完并确认过收款方式的，外加之前提前结过工钱、
        // 现在终于确认了的那些。
        // 一键结清收两种：办完且确认了方式的，以及"提前结算"确认过代收的
        // 未办场（周日并进周六，2026-09-28 用户定）。
        const picked = only ? mine.filter((x) => only.has(x.assignmentId)) : mine.filter((x) => !!x.method)
        // 有收款方式的就全结——包括还没办的场（提前结算=按师傅代收现金处理，
        // 2026-09-28 用户定）。没有方式的才退回"只结工钱"。
        const ready = picked.filter((x) => !!x.method)
        const early = picked.filter((x) => !x.method)
        const { data: approved } = await supabase.from("chef_files").select("id, amount_cents").eq("staff_member_id", body.id).eq("kind", "receipt").eq("status", "approved")
        const reimb = only ? [] : approved ?? []
        // 好评奖励 2026-09-28 起每月单独结（settle_reviews 出自己的对账单），
        // 周结不再掺好评——这里恒为空，字段留着只为对账单快照结构不变。
        const reviewRows2: Array<{ id: string; platform: string; review_date: string; reviewer: string | null; has_photo: boolean; excerpt: string | null; url?: string | null; cents: number }> = []
        // 工钱：这一轮真正要付的（提前结过的不再付）。桌椅和路费跟着"这场
        // 真办完了"走：提前结只付人头费，桌椅路费等收尾那笔一起清。
        const payOf = (x: (typeof picked)[number]) => (x.paySettledAt ? 0 : x.payCents)
        const pay = picked.reduce((a, x) => a + payOf(x), 0)
        const tables = ready.reduce((a, x) => a + x.tablesCents, 0)
        const travel = ready.reduce((a, x) => a + x.travelCents, 0)
        const review = reviewRows2.reduce((a, r) => a + (r.cents ?? 0), 0)
        const cash = ready.reduce((a, x) => a + x.cashCents, 0)
        const tip = ready.reduce((a, x) => a + x.cardTipCents, 0)
        const reimbCents = reimb.reduce((a, f) => a + (f.amount_cents ?? 0), 0)
        if (!picked.length && !reimb.length) {
          return NextResponse.json({ error: "没有可结的：先确认每场尾款怎么收的（还没办的场用\"提前结算\"，按师傅代收现金处理）。" }, { status: 400 })
        }
        const net = pay + tables + travel + review + reimbCents + tip - cash
        const dates = picked.map((x) => x.date).filter(Boolean).sort()
        const rate = rateOf(chef)
        // 对账单快照：师傅链接里看到的每一行，都是此刻算好存死的。
        const token = randomBytes(16).toString("base64url")
        const lines = {
          v: 1,
          chef: nameOf(chef),
          period: { start: dates[0] ?? today, end: dates[dates.length - 1] ?? today },
          generatedAt: now,
          rate: rate ? { baseCents: rate.base_pay_cents, headFrom: rate.head_from, perHeadCents: rate.per_head_cents } : null,
          rules: { kidFactor: KID_HEAD_FACTOR, tablePerHeadCents: TABLE_CHAIR_PER_HEAD_CENTS, travelFreeMiles: TRAVEL_FREE_MILES, travelBaseCents: TRAVEL_BASE_CENTS, travelPerMileCents: TRAVEL_PER_MILE_CENTS, reviewPlainCents: REVIEW_PLAIN_CENTS, reviewPhotoCents: REVIEW_PHOTO_CENTS },
          parties: picked
            .sort((x, y) => (x.date || "").localeCompare(y.date || ""))
            .map((x) => ({
              date: x.date,
              orderNo: x.orderNo,
              customer: (x.customer ?? "").trim().split(/\s+/)[0] || "Guest",
              city: (x.address ?? "").split(",").slice(-3, -2).join("").trim() || null,
              counts: x.counts,
              ...(x.chefRule ? { chefRule: x.chefRule.label } : {}),
              teamSize: x.team.length,
              method: x.method,
              prepaidOnly: !x.method,
              payPrepaid: !!x.paySettledAt,
              miles: x.miles,
              tableHeads: x.tableHeads,
              payCents: payOf(x),
              tablesCents: x.method ? x.tablesCents : 0,
              travelCents: x.method ? x.travelCents : 0,
              cardTipCents: x.method ? x.cardTipCents : 0,
              cardGrossCents: x.cardGrossCents,
              cardFeeCents: x.cardFeeCents,
              pricingTerms: x.pricingTerms,
              cashCents: x.method ? x.cashCents : 0,
              cashTipCents: x.cashTipCents,
              subtotalCents: payOf(x) + (x.method ? x.tablesCents + x.travelCents + x.cardTipCents - x.cashCents : 0),
            })),
          reviews: reviewRows2.map((r) => ({ platform: r.platform, date: r.review_date, reviewer: r.reviewer, hasPhoto: r.has_photo, excerpt: r.excerpt, url: r.url ?? null, cents: r.cents })),
          reimb: { count: reimb.length, cents: reimbCents },
          totals: { payCents: pay, tablesCents: tables, travelCents: travel, reviewCents: review, tipCents: tip, cashCents: cash, reimbCents, netCents: net },
        }
        const { data: settlement, error } = await supabase
          .from("chef_settlements")
          .insert({
            staff_member_id: body.id,
            period_start: dates[0] ?? null,
            period_end: dates[dates.length - 1] ?? null,
            shifts: picked.length,
            pay_cents: pay,
            reimb_cents: reimbCents,
            cash_cents: cash,
            tip_cents: tip,
            tables_cents: tables,
            travel_cents: travel,
            review_cents: review,
            lines,
            token,
            net_cents: net,
            method: str(body.method, 30) || null,
            note: [str(body.note, 400), early.length ? `其中 ${early.length} 场只结了工钱（提前）` : ""].filter(Boolean).join(" · ") || null,
            created_by: actor.alias,
          })
          .select("id")
          .single()
        if (error) throw error
        // 全结的场：冻结当时的工钱和人头，之后改工价不影响历史。
        for (const x of ready) {
          await supabase
            .from("order_staff_assignments")
            .update({
              settled_at: now,
              settlement_id: settlement.id,
              pay_cents: x.payCents,
              guest_share: x.share,
              tables_cents: x.tablesCents,
              travel_cents: x.travelCents,
              comp_breakdown: { counts: x.counts, tableHeads: x.tableHeads, miles: x.miles, ...(x.chefRule ? { chefRule: x.chefRule } : {}) },
              pay_settled_at: x.paySettledAt ?? now,
              pay_settled_cents: x.paySettledAt ? x.paySettledCents : x.payCents,
              updated_at: now,
            })
            .eq("id", x.assignmentId)
        }
        // 只结工钱的场：这场还没清，等派对办完确认收款方式再补差额。
        for (const x of early) {
          await supabase
            .from("order_staff_assignments")
            .update({ pay_settled_at: now, pay_settled_cents: x.payCents, pay_cents: x.payCents, guest_share: x.share, updated_at: now })
            .eq("id", x.assignmentId)
        }
        if (reimb.length) {
          const { error: e2 } = await supabase.from("chef_files").update({ status: "paid", settled_at: now, settlement_id: settlement.id }).in("id", reimb.map((f) => f.id))
          if (e2) throw e2
        }
        if (reviewRows2.length) {
          const { error: e3 } = await supabase.from("chef_review_bonuses").update({ settlement_id: settlement.id, settled_at: now }).in("id", reviewRows2.map((r) => r.id))
          if (e3) throw e3
        }
        await supabase.from("staff_members").update({ last_settled_at: today, updated_at: now }).eq("id", body.id)
        return NextResponse.json({
          ok: true,
          settlementId: settlement.id,
          token,
          statementUrl: `https://invoice.realhibachi.com/chef/statement/${token}`,
          shifts: picked.length,
          prepaidOnly: early.length,
          payCents: pay,
          tablesCents: tables,
          travelCents: travel,
          reviewCents: review,
          reimbCents,
          cashCents: cash,
          tipCents: tip,
          netCents: net,
        })
      }
      case "settle_reviews": {
        // 好评奖励每月一结（2026-09-28 用户定）：把没结过的逐条扫成一张
        // 独立对账单，不掺工钱和代收。月底点一次；每条都带原文链接可查。
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const { data: chefRow } = await supabase.from("staff_members").select("id, full_name, display_name").eq("id", body.id).maybeSingle()
        if (!chefRow) return NextResponse.json({ error: "not found" }, { status: 404 })
        const { data: pending } = await supabase
          .from("chef_review_bonuses")
          .select("id, platform, review_date, reviewer, has_photo, excerpt, url, cents")
          .eq("staff_member_id", body.id)
          .is("settlement_id", null)
          .order("review_date")
        const revs = pending ?? []
        if (!revs.length) return NextResponse.json({ error: "没有待结的好评——先在好评页签把提到他的评价记上。" }, { status: 400 })
        const total = revs.reduce((a, r) => a + (r.cents ?? 0), 0)
        const token = randomBytes(16).toString("base64url")
        const lines = {
          v: 1,
          kind: "reviews",
          chef: nameOf(chefRow as Staff),
          period: { start: revs[0].review_date, end: revs[revs.length - 1].review_date },
          generatedAt: now,
          rate: null,
          rules: { kidFactor: KID_HEAD_FACTOR, tablePerHeadCents: TABLE_CHAIR_PER_HEAD_CENTS, travelFreeMiles: TRAVEL_FREE_MILES, travelBaseCents: TRAVEL_BASE_CENTS, travelPerMileCents: TRAVEL_PER_MILE_CENTS, reviewPlainCents: REVIEW_PLAIN_CENTS, reviewPhotoCents: REVIEW_PHOTO_CENTS },
          parties: [],
          reviews: revs.map((r) => ({ platform: r.platform, date: r.review_date, reviewer: r.reviewer, hasPhoto: r.has_photo, excerpt: r.excerpt, url: r.url ?? null, cents: r.cents })),
          reimb: { count: 0, cents: 0 },
          totals: { payCents: 0, tablesCents: 0, travelCents: 0, reviewCents: total, tipCents: 0, cashCents: 0, reimbCents: 0, netCents: total },
        }
        const { data: settlement, error } = await supabase
          .from("chef_settlements")
          .insert({
            staff_member_id: body.id,
            period_start: revs[0].review_date,
            period_end: revs[revs.length - 1].review_date,
            shifts: 0,
            pay_cents: 0,
            reimb_cents: 0,
            cash_cents: 0,
            tip_cents: 0,
            tables_cents: 0,
            travel_cents: 0,
            review_cents: total,
            lines,
            token,
            net_cents: total,
            method: str(body.method, 30) || null,
            note: `好评奖励月结 · ${revs.length} 条`,
            created_by: actor.alias,
          })
          .select("id")
          .single()
        if (error) throw error
        await supabase.from("chef_review_bonuses").update({ settlement_id: settlement.id, settled_at: now }).in("id", revs.map((r) => r.id))
        return NextResponse.json({ ok: true, settlementId: settlement.id, token, statementUrl: `https://invoice.realhibachi.com/chef/statement/${token}`, count: revs.length, reviewCents: total, netCents: total })
      }
      case "unsettle": {
        // 撤一张“好评月结”对账单：没有场次挂着的结算走这条——好评回到
        // 待结（回好评页签可改可重记），链接作废。
        if (!body.assignment_id && isUuid(body.settlement_id)) {
          const sid = body.settlement_id as string
          const { count } = await supabase.from("order_staff_assignments").select("id", { count: "exact", head: true }).eq("settlement_id", sid)
          if ((count ?? 0) > 0) return NextResponse.json({ error: "这张对账单挂着场次，请到对应场次上点撤销。" }, { status: 400 })
          await supabase.from("chef_settlements").update({ token: null, note: "已撤销（链接已作废）" }).eq("id", sid)
          await supabase.from("chef_review_bonuses").update({ settlement_id: null, settled_at: null }).eq("settlement_id", sid)
          await supabase.from("chef_files").update({ status: "approved", settled_at: null, settlement_id: null }).eq("settlement_id", sid).eq("status", "paid")
          return NextResponse.json({ ok: true })
        }
        if (!isUuid(body.assignment_id)) return NextResponse.json({ error: "assignment_id required" }, { status: 400 })
        const { data: cur } = await supabase.from("order_staff_assignments").select("settlement_id").eq("id", body.assignment_id).maybeSingle()
        const sid = (cur?.settlement_id as string | null) ?? null
        // 撤销要把冻结的钱全放回现算，否则这场会带着旧数字再结一次。
        const { error } = await supabase
          .from("order_staff_assignments")
          .update({ settled_at: null, settlement_id: null, pay_settled_at: null, pay_settled_cents: null, pay_cents: null, tables_cents: null, travel_cents: null, comp_breakdown: null, updated_at: now })
          .eq("id", body.assignment_id)
        if (error) throw error
        if (sid) {
          // 那张对账单已经不再成立：链接作废（历史行保留做审计）。
          await supabase.from("chef_settlements").update({ token: null, note: "已撤销（链接已作废）" }).eq("id", sid)
          // 这单结算若已没有别的场，把跟着它结掉的好评和报销放回待结，
          // 否则那些钱会永远消失。
          const { count } = await supabase.from("order_staff_assignments").select("id", { count: "exact", head: true }).eq("settlement_id", sid)
          if ((count ?? 0) === 0) {
            await supabase.from("chef_review_bonuses").update({ settlement_id: null, settled_at: null }).eq("settlement_id", sid)
            await supabase.from("chef_files").update({ status: "approved", settled_at: null, settlement_id: null }).eq("settlement_id", sid).eq("status", "paid")
          }
        }
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
