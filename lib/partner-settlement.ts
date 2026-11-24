// 外包单结算（老板 2026-11-23）：外包出去的单指派给哪家合作公司（Meet Hibachi、JustOne Hibachi …），
// 做完按公司对账、结清。浏览器和服务器都用，不 import node 模块。
//
// 一单怎么算（老板 11-18「我们拿营业额的 30%，30% 也包括路费」）：
//   订单总价 total  = orders.quoted_total_cents（现金价，含路费，不含小费）
//   我们拿   cut    = total × rate（默认 30%，公司可以改，单子上按指派那一刻的比例）
//   钱在我们手上 collected = 只有刷卡（Stripe，扣掉退款）。老板 11-23：「Zelle、现金也是合作方收」——
//                     线下登记的现金 / Zelle / 其他、还没登记的尾款，都按在合作方手上算。
//   净额     net    = collected − cut
//                     > 0：钱多在我们这，我们付给合作方（payable）
//                     < 0：钱在合作方那，他们付我们（receivable）
// 客人刷卡付的小费、刷卡手续费都在 collected 里，跟着净额走给合作方；要扣的话结清时改金额。

export type PartnerPaymentRow = {
  provider: string | null
  type: string | null
  status: string | null
  amount_cents: number | null
  refunded_amount_cents?: number | null
  transaction_ref: string | null
}

export const DEFAULT_PARTNER_RATE_BPS = 3000

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0)

/** A payment the customer actually made (not a card-on-file hold, not refunded away). */
const counts = (p: PartnerPaymentRow) => (p.status === "paid" || p.status === "refunded") && p.type !== "card_on_file" && p.transaction_ref !== "manual:no_card"
const kept = (p: PartnerPaymentRow) => (p.status === "refunded" && p.refunded_amount_cents == null ? 0 : Math.max(0, n(p.amount_cents) - n(p.refunded_amount_cents)))
const isCard = (p: PartnerPaymentRow) => p.provider === "stripe"

/** Money from this order that is in our hands: card payments only (Zelle and cash go to the partner). */
export function collectedByUs(payments: PartnerPaymentRow[]): number {
  return payments.filter((p) => counts(p) && isCard(p)).reduce((a, p) => a + kept(p), 0)
}

/** Offline payments registered in the workbench (cash / Zelle / other) - the partner received them. */
export function paidToPartner(payments: PartnerPaymentRow[]): number {
  return payments.filter((p) => counts(p) && !isCard(p)).reduce((a, p) => a + kept(p), 0)
}

export const ourCut = (totalCents: number, rateBps: number) => Math.round((Math.max(0, n(totalCents)) * Math.min(10000, Math.max(0, n(rateBps)))) / 10000)

export type PartnerLine = { totalCents: number; rateBps: number; cutCents: number; collectedCents: number; netCents: number }

/** One outsourced order's numbers. netCents > 0: we pay the partner; < 0: the partner pays us. */
export function partnerLine(totalCents: number, rateBps: number, collectedCents: number): PartnerLine {
  const cutCents = ourCut(totalCents, rateBps)
  return { totalCents: n(totalCents), rateBps: n(rateBps), cutCents, collectedCents: n(collectedCents), netCents: n(collectedCents) - cutCents }
}

export type Direction = "payable" | "receivable"
export const directionOf = (netCents: number): Direction => (netCents > 0 ? "payable" : "receivable")
/** The settled status an allocation gets: paid when we paid them, received when they paid us. */
export const settledStatusOf = (netCents: number) => (netCents > 0 ? "paid" : "received")

const usd = (cents: number) => `$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** "Meet Hibachi 付我们 $219.69" / "我们付 Meet Hibachi $120.00" / "两清". */
export function netText(partner: string, netCents: number): string {
  if (netCents === 0) return "两清"
  return netCents > 0 ? `我们付 ${partner} ${usd(netCents)}` : `${partner} 付我们 ${usd(netCents)}`
}

export const ratePct = (bps: number) => `${Number.isInteger(n(bps) / 100) ? n(bps) / 100 : (n(bps) / 100).toFixed(1)}%`

/** "30" / "30%" / "27.5" → 3000 / 2750; null when it is not a sane percentage. */
export function parseRatePct(v: unknown): number | null {
  const s = String(v ?? "").trim().replace(/%$/, "")
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null
  const bps = Math.round(Number(s) * 100)
  return bps >= 0 && bps <= 10000 ? bps : null
}

const toPartner = (netCents: number) => (netCents === 0 ? "两清" : netCents > 0 ? `我们付你方 ${usd(netCents)}` : `你方付我们 ${usd(netCents)}`)

export type StatementLine = { date: string; orderNo: string; customer: string; guests: string; city: string; line: PartnerLine }

/**
 * The statement the owner pastes into WeChat for the partner. Chinese, one line per party, then the total.
 * The customer's first name only - the partner already has the order through the invoice link.
 */
export function statementText(partner: string, lines: StatementLine[]): string {
  const sum = lines.reduce((a, l) => a + l.line.netCents, 0)
  const out = [`${partner} 对账（${lines.length} 单）`]
  for (const l of lines) {
    const first = (l.customer.trim().split(/\s+/)[0] ?? "").replace(/[()（）]/g, "") || "客人"
    const got = l.line.collectedCents ? `，我们已收 ${usd(l.line.collectedCents)}` : "，客人钱在你方"
    out.push(`${l.date} ${first} ${l.city} ${l.guests}：总价 ${usd(l.line.totalCents)}，我们 ${ratePct(l.line.rateBps)} = ${usd(l.line.cutCents)}${got} → ${toPartner(l.line.netCents)}`)
  }
  out.push(`合计：${toPartner(sum)}`)
  return out.join("\n")
}
