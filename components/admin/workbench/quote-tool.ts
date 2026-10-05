// 线索弹窗里的「报价工具」：边打电话边算价、生成报价短信。
//
// 起因（老板 2026-10-04）：George Cruz 来电 25 分钟，40 人、周五晚 8 点，老板在
// 电话里给了 $180 的折扣和 4 盘春卷，只能自己心算、再手打短信
// "59.9*40-180 = 2216"——而旁边的报价框只会算标准价（$2,276），协议总价那格
// 签的还是 09-28 就不用的旧机制。这里把让价写成规则（每人价 / 再减 / 送前菜 /
// 送桌椅餐具），价格和发票引擎同一个算法，短信直接生成。
//
// 和发票引擎（v0-real-hibachi-invoice-generator lib/pricing.ts
// customDealPromotions / calcInvoiceTotal）对齐的几点：
//   1. 「每人特价」填的就是每位大人实付多少。发票的 deal_rate 行从 $59.90 原价往下
//      让，而且和周中价叠加，所以周中那天签进链接的 adultRate 要把周中让的 $5 加
//      回去，两边才是同一个数。
//   2. $599 起订在所有折扣之后兜底，路费在兜底之后另加。
//   3. 61 人以上发票不自动给人数折扣（那是定制单），这里算进去的 $180 就签进
//      flatOff，不然付押金后的订单比报价贵。
//   4. 送桌椅、餐具签进链接：发票上"加一行再减一行"，按人头算，总价不变。
//      送前菜**不签**：发票的 freeExtraIds 会把这一类前菜全部退钱——客人在
//      planner 里多点几盘也白送，还会和周中 / 20 人以上自带的那几盘重复退。
//      前菜只记进承诺，发票里按盘数加上。

import {
  calcSimpleEstimate,
  DEPOSIT_AMOUNT,
  earnsLargePartyAppetizer,
  GUEST_TIERS,
  MINIMUM_SPEND,
  PARTY_SIZE_CUSTOM_FROM,
  PARTY_SIZE_DISCOUNT_TIERS,
  partySizeDiscount,
  tierHeadcount,
} from "@/config/pricing-rules"

export const QUOTE_APPETIZERS = {
  gyoza: { zh: "饺子", en: "Gyoza", unit: "tray", price: 15 },
  spring_rolls: { zh: "春卷", en: "Spring rolls", unit: "tray", price: 15 },
  edamame: { zh: "毛豆", en: "Edamame", unit: "serving", price: 10 },
} as const
export type QuoteAppetizer = keyof typeof QUOTE_APPETIZERS

export const TABLES_PER_GUEST = 10
export const UTENSILS_PER_GUEST = 5

/**
 * Last day of the 20+ guest free appetizer. Same date as the invoice tool's
 * platter20 validTo and lib/ai-facts.ts - move all three together.
 */
export const LARGE_PARTY_APPETIZER_UNTIL = "2026-10-31"

export type QuoteInput = {
  adults: number
  kids: number
  weekdaySpecial: boolean
  /** YYYY-MM-DD; only used to judge the 20+ appetizer window. */
  eventDate?: string | null
  /** Travel fee from the site's travel service; null when the address is unknown. */
  travelFee: number | null
  /** What each adult pays for this party (owner's special rate), e.g. 54.90. Empty = list price. */
  adultRate?: number | null
  /** Extra dollars off on top of the party-size tier. */
  flatOff?: number | null
  freeAppetizer?: { id: QuoteAppetizer; trays: number } | null
  freeTables?: boolean
  freeUtensils?: boolean
}

export type QuoteBreakdown = {
  adults: number
  kids: number
  listAdultPrice: number
  adultPrice: number
  childPrice: number
  foodSubtotal: number
  partySize: number
  /** Owner-facing name of the tier, e.g. "31–40 人档". */
  partySizeTier: string | null
  rateCut: number
  flatOff: number
  /** Everything taken off the food line, as one number for the customer. */
  totalDiscount: number
  minApplied: boolean
  travelFee: number
  travelKnown: boolean
  total: number
  perPerson: number
  /** The party already gets a free appetizer (Weekday Special or 20+). */
  autoAppetizer: boolean
  /** How many trays of it: one per 10 paying guests, at least one; 0 when none. */
  autoAppetizerTrays: number
  /** Value of what we give away (appetizers, tables, place settings) - not in the total. */
  freeValue: number
  /** Customer-facing lines for the gifts, e.g. "Spring rolls (4 trays)". */
  freebies: string[]
  /** Owner-facing (Chinese) lines for the gifts. */
  freebiesZh: string[]
  /** custom-deal rules to sign into the deposit link; null when nothing needs signing. */
  deal: { adultRate?: number; flatOff?: number; freeExtraIds?: string[] } | null
}

const r2 = (n: number) => Math.round(n * 100) / 100
const pos = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0)

export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function computeQuote(q: QuoteInput): QuoteBreakdown {
  const adults = Math.max(0, Math.floor(q.adults || 0))
  const kids = Math.max(0, Math.floor(q.kids || 0))
  const heads = adults + kids
  const est = calcSimpleEstimate({ adults, kids, weekdaySpecial: q.weekdaySpecial, travelFee: 0 })
  const listAdultPrice = q.weekdaySpecial ? GUEST_TIERS.adult.weekdayPrice : GUEST_TIERS.adult.price
  const childPrice = q.weekdaySpecial ? GUEST_TIERS.child.weekdayPrice : GUEST_TIERS.child.price

  const rate = r2(pos(q.adultRate))
  const special = rate > 0 && rate < listAdultPrice
  const adultPrice = special ? rate : listAdultPrice
  const rateCut = special ? r2((listAdultPrice - adultPrice) * adults) : 0
  const flatOff = r2(pos(q.flatOff))

  const partySize = partySizeDiscount({ adults, kids })
  const count = tierHeadcount({ adults, kids })
  const tier = PARTY_SIZE_DISCOUNT_TIERS.find((t) => count >= t.minGuests && count <= t.maxGuests)
  const partySizeTier = tier ? `${tier.minGuests}–${tier.maxGuests} 人档` : partySize > 0 ? `${PARTY_SIZE_CUSTOM_FROM} 人以上` : null

  const afterDiscounts = est.subtotal - partySize - rateCut - flatOff
  const food = Math.max(afterDiscounts, MINIMUM_SPEND)
  const travelFee = q.travelFee == null ? 0 : Math.max(0, Math.round(q.travelFee))
  const total = r2(food + travelFee)

  const today = new Date().toISOString().slice(0, 10)
  const autoAppetizer =
    heads > 0 &&
    (q.weekdaySpecial || (earnsLargePartyAppetizer({ adults, kids }) && (q.eventDate || today) <= LARGE_PARTY_APPETIZER_UNTIL))
  // One tray per 10 paying guests, at least one (owner 2026-10-01, after 21
  // people shared one tray of gyoza; Annie Phan's 21 got 2). The invoice still
  // seeds 1 - `desk order set --free-appetizer-trays` raises it.
  const autoAppetizerTrays = autoAppetizer ? Math.max(1, Math.floor(count / 10)) : 0

  const freebies: string[] = []
  const freebiesZh: string[] = []
  const freeExtraIds: string[] = []
  let freeValue = 0
  const app = q.freeAppetizer && q.freeAppetizer.trays > 0 ? q.freeAppetizer : null
  if (app) {
    const def = QUOTE_APPETIZERS[app.id]
    // Never quote fewer trays than the party gets anyway.
    const trays = Math.max(app.trays, autoAppetizerTrays)
    const value = def.price * trays
    freeValue += value
    freebies.push(`${def.en} (${trays} ${def.unit}${trays === 1 ? "" : "s"})`)
    freebiesZh.push(`${def.zh} ${trays} 盘（$${value}${autoAppetizerTrays ? `，含本来就送的 ${autoAppetizerTrays} 盘` : ""}）`)
  } else if (autoAppetizerTrays) {
    // Already theirs; worth saying when the owner is listing what they get.
    freebies.push(
      autoAppetizerTrays === 1
        ? "An appetizer of your choice (gyoza, spring rolls or edamame)"
        : `${autoAppetizerTrays} appetizer trays of your choice (gyoza, spring rolls or edamame)`,
    )
  }
  if (q.freeTables && heads > 0) {
    freeValue += TABLES_PER_GUEST * heads
    freebies.push("Tables and chairs")
    freebiesZh.push(`桌椅（$${TABLES_PER_GUEST * heads}）`)
    freeExtraIds.push("tables_chairs")
  }
  if (q.freeUtensils && heads > 0) {
    freeValue += UTENSILS_PER_GUEST * heads
    freebies.push("Plates, napkins and silverware")
    freebiesZh.push(`餐具（$${UTENSILS_PER_GUEST * heads}）`)
    freeExtraIds.push("utensils")
  }

  const deal: NonNullable<QuoteBreakdown["deal"]> = {}
  // The invoice measures the rate from $59.90 and stacks the Weekday Special on top.
  if (special) deal.adultRate = r2(adultPrice + (GUEST_TIERS.adult.price - listAdultPrice))
  // Above the tier table the invoice gives no automatic discount, so sign it.
  const signedFlat = r2(flatOff + (count >= PARTY_SIZE_CUSTOM_FROM ? partySize : 0))
  if (signedFlat > 0) deal.flatOff = signedFlat
  if (freeExtraIds.length) deal.freeExtraIds = freeExtraIds

  return {
    adults,
    kids,
    listAdultPrice,
    adultPrice,
    childPrice,
    foodSubtotal: est.subtotal,
    partySize,
    partySizeTier,
    rateCut,
    flatOff,
    totalDiscount: r2(Math.max(0, est.subtotal - food)),
    minApplied: afterDiscounts < MINIMUM_SPEND,
    travelFee,
    travelKnown: q.travelFee != null,
    total,
    perPerson: heads > 0 ? r2(total / heads) : 0,
    autoAppetizer,
    autoAppetizerTrays,
    freeValue,
    freebies,
    freebiesZh,
    deal: Object.keys(deal).length > 0 ? deal : null,
  }
}

/** "Friday, Nov 13 at 8 PM" from YYYY-MM-DD and HH:MM, or "" when there is no date. */
export function quoteDateLabel(ymd: string | null | undefined, time?: string | null): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ""
  const [y, m, d] = ymd.split("-").map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return day
  const [hh, mm] = time.split(":").map(Number)
  const h12 = ((hh + 11) % 12) + 1
  return `${day} at ${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${hh < 12 ? "AM" : "PM"}`
}

/**
 * The quote text the owner sends. Plain lines a customer can check with a
 * calculator: what they pay per head, one discount line, what is on us, the
 * total, and the deposit link.
 */
export function quoteSms(b: QuoteBreakdown, opts: { dateLabel?: string; depositLink?: string }): string {
  const lines: string[] = []
  lines.push(opts.dateLabel ? `Here's your quote for ${opts.dateLabel}:` : "Here's your quote:")
  const special = b.adultPrice < b.listAdultPrice
  if (b.adults > 0) {
    lines.push(`${b.adults} ${b.adults === 1 ? "adult" : "adults"} x ${usd(b.adultPrice)}${special ? ` (instead of ${usd(b.listAdultPrice)})` : ""} = ${usd(r2(b.adults * b.adultPrice))}`)
  }
  if (b.kids > 0) lines.push(`${b.kids} ${b.kids === 1 ? "kid" : "kids"} x ${usd(b.childPrice)} = ${usd(r2(b.kids * b.childPrice))}`)
  // The per-head cut is already in the line above, so only the rest is "discount" here.
  const shownDiscount = r2(b.totalDiscount - b.rateCut)
  if (b.minApplied) lines.push(`Party minimum: ${usd(MINIMUM_SPEND)}`)
  else if (shownDiscount > 0) lines.push(`Discount: -${usd(shownDiscount)}`)
  for (const f of b.freebies) lines.push(`${f} on us`)
  const travel = !b.travelKnown ? "" : b.travelFee > 0 ? ` (includes ${usd(b.travelFee)} travel)` : ", no travel fee"
  lines.push(`Total: ${usd(b.total)}, tax included${travel}`)
  // Owner 2026-10-05: say it before they decide - cash on the day is the price,
  // card / Venmo / Zelle add 4% (Zelle is not the cash price).
  lines.push("That's the cash price - pay your chef in cash on the day and nothing's added; card is 4% more.")
  if (opts.depositLink) lines.push(`${usd(DEPOSIT_AMOUNT)} locks the date: ${opts.depositLink}`)
  return lines.join("\n")
}

/** One-line owner record of what was promised, for the lead's 承诺 list. */
export function quotePromiseNote(b: QuoteBreakdown, dateLabel: string): string {
  const parts = [`报价 ${usd(b.total)}`, `${b.adults} 大${b.kids ? ` ${b.kids} 小` : ""}`]
  if (dateLabel) parts.push(dateLabel)
  if (b.rateCut > 0) parts.push(`每人 ${usd(b.adultPrice)}`)
  const extra = r2(b.totalDiscount - b.rateCut)
  if (extra > 0) parts.push(`折扣 -${usd(extra)}`)
  if (b.freebiesZh.length) parts.push(`送 ${b.freebiesZh.join("、")}`)
  return parts.join(" · ")
}
