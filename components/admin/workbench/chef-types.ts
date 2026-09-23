// Shapes the chef routes return (app/api/admin/chefs, chef-media).
import type { ChefRate, DocState } from "@/lib/chef-pay"

export type ShiftRow = {
  assignmentId: string
  orderId: string
  orderNo: string | null
  date: string
  eventStart: string | null
  customer: string | null
  address: string | null
  guests: number
  share: number
  team: Array<{ id: string; name: string }>
  payCents: number
  cashCents: number
  cashSource: "manual" | "chef_sheet" | "none"
  settledAt: string | null
  status: string
  orderStatus: string | null
  balanceDueCents: number | null
  /** 派对办完了没（开席 + 时长 + 收拾）。没办完就不知道尾款怎么收，别算进结算。 */
  partyOver: boolean
  method: SettleMethod | null
  cardGrossCents: number
  cardFeeCents: number
  /** Stripe 净额 − 应收尾款：客人刷卡时给师傅的小费，钱在我们手上。 */
  cardTipCents: number
  /** 客人当场塞给师傅的现金，师傅自己留着，不进净额。 */
  cashTipCents: number
  settlementRef: string | null
  settlementNote: string | null
  /** 工钱结过了没（可以提前于派对结）。settledAt 才代表这场彻底清了。 */
  paySettledAt: string | null
  paySettledCents: number
}

export type SettleMethod = "cash" | "card" | "prepaid" | "other"
export const METHOD_LABELS: Record<SettleMethod, string> = { cash: "师傅代收现金", card: "客人刷卡", prepaid: "已付清 / 转账", other: "其它" }
export const METHOD_SHORT: Record<SettleMethod, string> = { cash: "现金代收", card: "刷卡", prepaid: "已付清", other: "其它" }

/** 这场还欠师傅多少：工钱（结过就不算）+ 卡上小费 − 他代收的现金。 */
export function shiftNet(s: ShiftRow): number {
  return (s.paySettledAt ? 0 : s.payCents) + s.cardTipCents - s.cashCents
}

export type ChefSummary = {
  id: string
  name: string
  phone: string | null
  status: string
  rate: ChefRate | null
  skills: string[]
  areas: string[]
  billing_cycle: string
  last_settled_at: string | null
  shifts: ShiftRow[]
  good: number
  bad: number
  late: number
  perfCount: number
  openShifts: number
  /** 办完了但还没说尾款怎么收的场次数——这些一分钱都还算不出来。 */
  awaitingMethod: number
  openPayCents: number
  openCashCents: number
  openTipCents: number
  pendingReceipts: number
  pendingReceiptCents: number
  doc: DocState
  taxMissing: boolean
}

export type OrderAssignment = { assignmentId: string; staffId: string; name: string; share: number | null }
export type AssignmentMap = Record<string, OrderAssignment[]>

export type ChefRecord = {
  id: string
  full_name: string | null
  display_name: string | null
  staff_type: string | null
  status: string
  email: string | null
  phone: string | null
  notes: string | null
  is_bookable: boolean | null
  wechat: string | null
  base_pay_cents: number
  head_from: number
  per_head_cents: number
  skills: string[]
  areas: string[]
  billing_cycle: string
  last_settled_at: string | null
  food_handler_no: string | null
  food_handler_exp: string | null
  id_type: string | null
  id_last4: string | null
  id_exp: string | null
  tax_form: string | null
  tax_legal_name: string | null
  tax_id_last4: string | null
  tax_address: string | null
}

export type PerfRow = { id: string; order_id: string | null; event_date: string; customer_label: string | null; review: "good" | "bad" | null; comment: string | null; late_minutes: number; source: string; created_at: string }
export type ChefFile = { id: string; order_id: string | null; kind: "receipt" | "photo" | "video" | "food_card" | "id_doc" | "w9" | "other"; title: string | null; content_type: string | null; bytes: number | null; amount_cents: number | null; status: "none" | "pending" | "approved" | "paid" | "rejected"; approved_at: string | null; settled_at: string | null; note: string | null; uploaded_by: string | null; created_at: string }
export type Settlement = { id: string; period_start: string | null; period_end: string | null; shifts: number; pay_cents: number; reimb_cents: number; cash_cents: number; net_cents: number; method: string | null; note: string | null; created_by: string | null; created_at: string }
/** 公司发出去的东西（工服 / 刀具 / 装备）。returned_on 为空 = 还在他手上。 */
export type AssetRow = { id: string; item_key: string; label: string; qty: number; size: string | null; issued_on: string; returned_on: string | null; condition: string | null; unit_cost_cents: number | null; note: string | null; created_by: string | null }
export type ChefDetail = { chef: ChefRecord; shifts: ShiftRow[]; performance: PerfRow[]; files: ChefFile[]; settlements: Settlement[]; assets?: AssetRow[]; today: string; sensitive?: boolean }

export type MediaItem = {
  id: string
  source: "order_photos" | "chef_files"
  date: string
  chef: string
  event: string
  orderId: string | null
  type: "photo" | "video"
  contentType: string | null
  url: string | null
  storagePath: string
  phase: string | null
  createdAt: string
}

export const FILE_KIND_LABELS: Record<ChefFile["kind"], string> = { receipt: "发票", photo: "照片", video: "视频", food_card: "Food Handler", id_doc: "证件", w9: "W-9", other: "其他" }
export const FILE_STATUS_LABELS: Record<ChefFile["status"], string> = { none: "", pending: "待报销", approved: "已批准，待结算", paid: "已报销", rejected: "已拒" }

/**
 * Sunday that starts the week containing ymd. Chef weeks run Sun–Sat because
 * the owner settles Saturday night, same window the ads and stats use.
 */
export function weekStartOf(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.toISOString().slice(0, 10)
}
