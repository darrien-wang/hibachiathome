// ============================================================
// Workbench · shared types, labels and small pure helpers
// ============================================================
// Everything the tabs and dialogs agree on: row shapes as the admin APIs
// return them, the two status vocabularies, Pacific-time date math and the
// "wall-clock stored as UTC" rule for order times (see eventParts).

import type { SetupSelection } from "@/config/table-themes"

export type LeadRow = {
  id: string
  created_at: string
  full_name: string | null
  phone: string | null
  email: string | null
  status: LeadStatus | string
  lead_source: string | null
  lead_channel: string | null
  lead_type: string | null
  city_or_zip: string | null
  guest_count: number | null
  latest_message: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  gclid: string | null
  referral_code: string | null
  hear_about_us: string | null
  touchpoint_count: number | null
  last_seen_at: string | null
  first_response_at: string | null
  response_seconds: number | null
  last_inbound_at?: string | null
  /** 球在客户那边直到这个时间；期间不算"客人在等回复"。 */
  hold_until?: string | null
  /** 挂起是什么时候设的——客户在这之后又说话，挂起自动失效。 */
  hold_set_at?: string | null
  last_outbound_at?: string | null
  /** Who said the last thing, from the Twilio thread merged with the timeline. */
  last_speaker?: "customer" | "us" | "auto" | null
  last_preview?: string | null
  last_at?: string | null
  /** Only the automated quote went out; no person has followed up. */
  needs_followup?: boolean
  event_hint?: string | null
}

export type LeadStats = {
  today_leads: number
  open_leads: number
  avg_response_minutes_7d: number | null
  within_5min_rate_7d: number | null
  responded_count_7d: number
  leads_7d: number
}

export type LeadEvent = {
  touchpoint_type: string
  touchpoint_source?: string | null
  occurred_at: string
  raw_payload_json: Record<string, unknown> | null
}

export type OrderRow = {
  id: string
  order_no: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  event_start: string | null
  event_address: string | null
  guest_adult_count: number | null
  guest_child_count: number | null
  order_status: string | null
  deposit_status: string | null
  deposit_required_cents: number | null
  deposit_paid_total_cents: number | null
  details_status: string | null
  quoted_total_cents: number | null
  amount_paid_total_cents: number | null
  balance_due_cents: number | null
  source: string | null
  source_ref: string | null
  source_metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
  internal_notes?: string | null
  customer_notes?: string | null
  notes?: string | null
  /** The invoice as the professional tool saved it (detail only). */
  invoice_data?: Record<string, unknown> | null
  /** What the customer picked on /rentals: package, tablecloth, table theme. */
  setup_selection?: SetupSelection | null
  /** Chef gratuity the customer typed on /pay. Selected, not necessarily paid. */
  chosen_gratuity_cents?: number | null
  chosen_gratuity_at?: string | null
}

/**
 * Travel fee exactly as the invoice tool computes it (lib/pricing.ts over
 * there): a manual override wins, else miles beyond the free radius × rate.
 * The workbench never calculates a fee of its own.
 */
export function invoiceTravelFee(invoice: Record<string, unknown> | null | undefined): { fee: number; miles: number | null; manual: boolean } | null {
  const t = invoice?.travelFee as { distanceMiles?: number | null; manualOverride?: number | null; ratePerMile?: number; freeRadiusMiles?: number } | undefined
  if (!t) return null
  if (typeof t.manualOverride === "number") return { fee: t.manualOverride, miles: typeof t.distanceMiles === "number" ? t.distanceMiles : null, manual: true }
  if (typeof t.distanceMiles !== "number") return null
  const free = typeof t.freeRadiusMiles === "number" ? t.freeRadiusMiles : 50
  const rate = typeof t.ratePerMile === "number" ? t.ratePerMile : 1
  return { fee: Math.max(0, Math.round((t.distanceMiles - free) * rate)), miles: t.distanceMiles, manual: false }
}

export type UpdateRequest = {
  id: string
  order_id?: string | null
  external_order_id?: string | null
  status: string
  customer_name: string | null
  customer_message: string | null
  change_summary: unknown
  confirmed_at: string | null
  chef_notified_at: string | null
  created_at: string
}

export type OrderPayment = {
  id: string
  provider: string | null
  external_payment_id: string | null
  type: string | null
  status: string | null
  amount_cents: number | null
  paid_at: string | null
  refunded_at: string | null
  transaction_ref: string | null
  created_at: string
}

export type OrderEvent = { id: string; actor: string | null; action: string; metadata: Record<string, unknown> | null; created_at: string }

export type OrderDetail = { order: OrderRow; payments: OrderPayment[]; events: OrderEvent[]; updateRequests: UpdateRequest[] }

// ---------------------------------------------------------------- statuses

export type LeadStatus = "new" | "qualified" | "won" | "lost" | "disqualified"
export const LEAD_STATUSES: LeadStatus[] = ["new", "qualified", "won", "lost", "disqualified"]
export const LEAD_STATUS_LABELS: Record<string, string> = { new: "待联系", qualified: "跟进中", won: "已成单", lost: "流失", disqualified: "无效" }
export const LEAD_TAG_CLASS: Record<string, string> = { new: "tag-outline", qualified: "tag-accent", won: "tag-ink", lost: "tag-neutral", disqualified: "tag-faint" }
export const LEAD_DOT: Record<string, string> = {
  new: "var(--color-accent)",
  qualified: "var(--color-accent-400)",
  won: "var(--color-text)",
  lost: "var(--color-neutral-400)",
  disqualified: "var(--color-neutral-300)",
}

export type Stage = "待细节" | "本周执行" | "已订" | "待尾款" | "已办完" | "已取消"
export const STAGE_TAG_CLASS: Record<Stage, string> = {
  待细节: "tag-outline",
  本周执行: "tag-accent",
  已订: "tag-ink",
  待尾款: "tag-accent",
  已办完: "tag-neutral",
  已取消: "tag-faint",
}

/** Same rule the old order page used; cancelled wins, then past/future. */
export function stageOf(o: OrderRow, now: number): Stage {
  if (o.order_status === "cancelled") return "已取消"
  const ms = o.event_start ? Date.parse(o.event_start) : NaN
  const passed = Number.isFinite(ms) && ms < now
  if (passed) return o.balance_due_cents === 0 ? "已办完" : "待尾款"
  if (o.details_status !== "complete") return "待细节"
  if (Number.isFinite(ms) && ms - now <= 7 * 86400_000) return "本周执行"
  return "已订"
}

export const EVENT_LABELS: Record<string, string> = {
  landing_contact: "落地页留了联系方式",
  landing_quote_text: "落地页要了短信报价",
  contact_intent: "点了联系按钮",
  contact_form: "表单提交",
  quote_book_online: "报价页点了在线订",
  booking_request: "报价提交",
  booking_created: "网站下单",
  manual_entry: "手动录入",
  sms_inbound: "收到短信",
  sms_outbound: "发出短信（213 线）",
  sms_failed: "⚠️ 短信未送达",
  call_inbound: "来电",
  call_recording: "通话录音",
  agent_first_response: "✓ 首次联系",
  agent_status_change: "状态变更",
  agent_edit: "✏️ 资料修改",
  agent_note: "📝 备注",
  agent_merge: "🔗 合并线索",
  planner_unlock: "Planner 留资解锁",
  planner_opened: "打开了 planner",
  planner_edited: "正在 planner 里布置派对",
  planner_shared: "把派对分享给了客人",
  planner_guest_joined: "第一位客人加入了派对",
  planner_half_joined: "过半客人已加入",
  planner_menu_complete: "全员选完菜 — 菜单齐了",
}

export const ORDER_EVENT_LABELS: Record<string, string> = {
  order_deposit_paid_ingested: "押金到账，订单建立",
  manual_deposit_confirmed: "线下押金登记",
  lead_linked: "关联线索",
  acquisition_resolved: "渠道归因",
  acquisition_overridden: "渠道改判",
  invoice_saved: "发票保存",
  invoice_emailed: "发票已发邮件",
  invoice_sent: "发票已发",
  invoice_confirmed: "客户确认发票",
  invoice_update_submitted: "客户提交修改",
  customer_email_sent: "发了客户邮件",
  email_sent: "发了客户邮件",
  sop_sent: "SOP 已发",
  travel_distance_calculated: "算了路费",
  final_payment_confirmed: "尾款已收",
  payment_received_ingested: "收款入账",
  chef_sheet_sent: "备料单已发师傅",
  chef_sheet_opened: "师傅打开备料单",
  chef_items_checked: "师傅勾了备料",
  chef_load_complete: "师傅装车完成",
  chef_navigate_tapped: "师傅点了导航",
  chef_host_called: "师傅打给了主人",
  chef_eta_texted: "师傅发了到达时间",
  chef_photos_uploaded: "师傅传了派对照片",
  propane_tank_swapped: "换了气罐",
  propane_use_logged: "记了用气",
  lock_date_job_enqueued: "锁档期任务",
  address_corrected: "地址更正",
  contact_phone_corrected: "电话更正",
  order_details_adjusted: "订单细节调整",
  dietary_requirement_confirmed: "忌口确认",
  quote_recorded: "报价记录",
  pricing_grandfathered: "沿用旧价",
}

const SOURCE_LABELS: Record<string, string> = {
  quote_sms_intent: "落地页短信报价",
  sms_inbound: "客户来短信",
  phone_inbound: "客户来电",
  quote_unlock: "/quote 留资",
  quote_builder: "/quote 表单",
  order_planner: "派对 planner",
  contact_page: "联系页",
  manual_sms: "手动·短信",
  manual_phone: "手动·电话",
  manual_other: "手动录入",
  manual_facebook: "FB Marketplace",
  ai_agent_claude: "AI 代理",
}

/** The one-line "where did this come from" under the status tag. */
export function leadKeyword(l: LeadRow): string {
  if (l.utm_term) return l.utm_term
  const src = l.lead_source ?? ""
  if (src.startsWith("city_")) return `城市页 · ${src.slice(5).replace(/_/g, " ")}`
  if (src.startsWith("catering_")) return `餐饮页 · ${src.slice(9).replace(/_/g, " ")}`
  if (SOURCE_LABELS[src]) return SOURCE_LABELS[src]
  if (l.lead_channel === "ai_agent") return "AI 代理"
  return src || l.lead_channel || "—"
}

export function leadIsAds(l: LeadRow): boolean {
  return !!l.gclid || (l.utm_medium ?? "").toLowerCase() === "cpc"
}

// ---------------------------------------------------------------- money

export function money(cents: number | null | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—"
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
export function money0(cents: number | null | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—"
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`
}
export function dollars(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
export function num(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "—"
}
export function pct(a: number, b: number): string {
  return b > 0 ? `${((100 * a) / b).toFixed(1)}%` : "–"
}

// ---------------------------------------------------------------- dates (PT)

export const PT = "America/Los_Angeles"
const DOW_ZH = ["日", "一", "二", "三", "四", "五", "六"]

/** "YYYY-MM-DD" of a moment in Pacific time. */
export function ptDateOf(ms: number | string | Date = Date.now()): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: PT })
}
export function ptToday(): string {
  return ptDateOf(Date.now())
}
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
export function fmtYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}
export function addDays(ymd: string, n: number): string {
  const d = parseYmd(ymd)
  d.setUTCDate(d.getUTCDate() + n)
  return fmtYmd(d)
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000) + 1
}
/** The Sunday that starts the Pacific week containing ymd (owner's 周口径). */
export function weekSundayOf(ymd: string): string {
  const d = parseYmd(ymd)
  return addDays(ymd, -d.getUTCDay())
}
export function monthStartOf(ymd: string): string {
  return `${ymd.slice(0, 8)}01`
}
export function md(ymd: string): string {
  const d = parseYmd(ymd)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}
export function dowZh(ymd: string): string {
  return `周${DOW_ZH[parseYmd(ymd).getUTCDay()]}`
}
export function ymdLabel(ymd: string): string {
  return `${md(ymd)} ${dowZh(ymd)}`
}

/** Short Pacific stamp for timelines: "9/20 18:05". */
export function stamp(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("en-US", { timeZone: PT, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—"
  const diff = now - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "刚刚"
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return ptDateOf(iso).slice(5).replace("-", "/")
}

/**
 * event_start is wall-clock time stored as UTC across the whole pipeline
 * (invoice app + webhook builder), so read the UTC fields verbatim.
 */
export function eventParts(iso: string | null | undefined): { ymd: string; hm: string; hour: number; minute: number; ms: number } | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
  const hour = d.getUTCHours()
  const minute = d.getUTCMinutes()
  return { ymd, hm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, hour, minute, ms }
}

/** "3 天后" / "今天" / "2 天前", by Pacific calendar day. */
export function inDaysLabel(eventYmd: string, today = ptToday()): string {
  const dd = daysBetween(today, eventYmd) - 1
  if (dd === 0) return "今天"
  return dd > 0 ? `${dd} 天后` : `${-dd} 天前`
}

export function firstRespText(seconds: number | null, slaMinutes: number): { text: string; late: boolean } {
  if (seconds === null) return { text: "未响应", late: true }
  const min = seconds / 60
  if (min < 60) return { text: `${Math.round(min)} 分`, late: min > slaMinutes }
  if (min < 60 * 48) return { text: `${Math.round(min / 60)} 小时`, late: true }
  return { text: `${Math.round(min / 1440)} 天`, late: true }
}

// ---------------------------------------------------------------- people

export function digits10(v: string | null | undefined): string {
  const d = (v ?? "").replace(/\D/g, "")
  return d.length >= 10 ? d.slice(-10) : d
}
export function prettyPhone(v: string | null | undefined): string {
  const d = digits10(v)
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : v ?? "—"
}
export function isPlaceholderName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim()
  if (!n) return true
  if (/^\+?\d[\d\s().-]{6,}$/.test(n)) return true
  return /^(unknown contact|unknown|guest|sms lead|caller)$/i.test(n)
}
export function displayName(name: string | null | undefined, phone?: string | null): string {
  if (!isPlaceholderName(name)) return (name ?? "").trim()
  const p = prettyPhone(phone)
  return p !== "—" ? `未留名 · ${p}` : "未留名"
}
export function firstName(name: string | null | undefined): string {
  return isPlaceholderName(name) ? "" : (name ?? "").trim().split(/\s+/)[0]
}
/** Is the customer waiting on us? Only meaningful for open leads. */
/**
 * 球在客户那边——他说了"我回头告诉你"，我们不欠他回复（老板 2026-09-23 定）。
 *
 * 之所以不做成一个新状态：状态是漏斗阶段（待联系→跟进中→成单/流失），"等谁"
 * 是另一个维度。一条线索可以既是跟进中、又在等客户；做成状态会把阶段冲掉。
 *
 * 客户在我们挂起之后又说话了，挂起自动失效——他回来了，球就回到我们这边。
 */
export function leadOnHold(l: LeadRow): boolean {
  const until = l.hold_until ? Date.parse(l.hold_until) : NaN
  if (!Number.isFinite(until) || until <= Date.now()) return false
  const set = l.hold_set_at ? Date.parse(l.hold_set_at) : NaN
  const inb = l.last_inbound_at ? Date.parse(l.last_inbound_at) : NaN
  if (Number.isFinite(set) && Number.isFinite(inb) && inb > set) return false
  return true
}

export function leadUnreplied(l: LeadRow): boolean {
  if (l.status === "won" || l.status === "lost" || l.status === "disqualified") return false
  // 挂起期间不算"客人在等回复"——这正是老板要的：这些人不是我们没回，是他让我们等。
  if (leadOnHold(l)) return false
  const inb = l.last_inbound_at ? Date.parse(l.last_inbound_at) : NaN
  const out = l.last_outbound_at ? Date.parse(l.last_outbound_at) : NaN
  if (!Number.isFinite(inb)) return l.response_seconds === null && l.status === "new"
  return !Number.isFinite(out) || inb > out
}
export function isTestLead(l: { full_name?: string | null; phone?: string | null }): boolean {
  const p = (l.phone ?? "").replace(/\D/g, "")
  if (/^1?\d{3}555\d{4}$/.test(p)) return true
  return /not a customer|auto-test|claude/i.test(l.full_name ?? "")
}

/** Orders that belong to a lead: explicit link first, then same phone/email. */
export function ordersForLead(lead: LeadRow, orders: OrderRow[]): OrderRow[] {
  const p = digits10(lead.phone)
  const e = (lead.email ?? "").trim().toLowerCase()
  return orders.filter((o) => {
    const meta = (o.source_metadata ?? {}) as Record<string, unknown>
    if (meta.lead_id === lead.id) return true
    if (p && digits10(o.customer_phone) === p) return true
    if (e && (o.customer_email ?? "").trim().toLowerCase() === e) return true
    return false
  })
}
export function leadForOrder(order: OrderRow, leads: LeadRow[]): LeadRow | null {
  const meta = (order.source_metadata ?? {}) as Record<string, unknown>
  const byId = typeof meta.lead_id === "string" ? leads.find((l) => l.id === meta.lead_id) : null
  if (byId) return byId
  const p = digits10(order.customer_phone)
  const e = (order.customer_email ?? "").trim().toLowerCase()
  return leads.find((l) => (p && digits10(l.phone) === p) || (e && (l.email ?? "").trim().toLowerCase() === e)) ?? null
}

export function copyText(text: string) {
  try {
    void navigator.clipboard.writeText(text)
  } catch {}
}

export function operatorName(): string {
  try {
    return localStorage.getItem("rh_operator_name") ?? "staff"
  } catch {
    return "staff"
  }
}
