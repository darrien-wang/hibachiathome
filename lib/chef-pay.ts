// 厨师工价、证件状态：工作台和 API 共用的纯函数（无服务端依赖）。

export type ChefRate = { base_pay_cents: number; head_from: number; per_head_cents: number }

/** 每场工钱 = 底价 + 超过 head_from 的每人加价 × 人头（多位师傅同场按各自那份人头算）。 */
export function chefPayCents(rate: ChefRate, guestShare: number): number {
  const extra = Math.max(0, Math.floor(guestShare) - rate.head_from)
  return Math.max(0, rate.base_pay_cents) + extra * Math.max(0, rate.per_head_cents)
}

export function rateLabel(rate: ChefRate): string {
  const base = `$${(rate.base_pay_cents / 100).toFixed(0)} / 场`
  return rate.per_head_cents > 0 ? `${base} · 超 ${rate.head_from} 人每人 +$${(rate.per_head_cents / 100).toFixed(0)}` : base
}

export type ChefDocs = {
  food_handler_no?: string | null
  food_handler_exp?: string | null
  id_type?: string | null
  id_last4?: string | null
  id_exp?: string | null
  tax_form?: string | null
  tax_legal_name?: string | null
  tax_id_last4?: string | null
  tax_address?: string | null
}

export type DocState = { label: string; level: "ok" | "warn" | "bad" }

/** Food Handler 卡 + 证件的一句话状态；today = 太平洋日期 YYYY-MM-DD。 */
export function docState(d: ChefDocs, today: string): DocState {
  const soon = (exp: string) => {
    const ms = Date.parse(`${exp}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)
    return ms / 86400000
  }
  if (!d.food_handler_no || !d.food_handler_exp) return { label: "Food Handler 未登记", level: "bad" }
  const fh = soon(d.food_handler_exp)
  if (fh < 0) return { label: `Food Handler 已过期（${d.food_handler_exp.slice(5).replace("-", "/")}）`, level: "bad" }
  if (fh <= 30) return { label: `Food Handler ${d.food_handler_exp.slice(5).replace("-", "/")} 到期`, level: "warn" }
  if (!d.id_last4 || !d.id_exp) return { label: "证件未登记", level: "warn" }
  const idd = soon(d.id_exp)
  if (idd < 0) return { label: `证件已过期（${d.id_exp.slice(5).replace("-", "/")}）`, level: "bad" }
  if (idd <= 30) return { label: `证件 ${d.id_exp.slice(5).replace("-", "/")} 到期`, level: "warn" }
  return { label: `证件齐全 · Food Handler 到 ${d.food_handler_exp.slice(0, 7).replace("-", "/")}`, level: "ok" }
}

export function taxMissing(d: ChefDocs): boolean {
  return !d.tax_legal_name || !d.tax_id_last4 || !d.tax_address
}

export const BILLING_LABELS: Record<string, string> = {
  weekly: "每周六结（周一–周日，周日提前结进来）",
  biweekly: "每两周",
  semimonthly: "每月 1 / 15 日",
  monthly: "每月 1 日",
  per_event: "每场结",
}

// ---------------------------------------------------------------------------
// 结算明细（2026-09-27 用户定）：一场的钱 = 人头费 + 桌椅 + 路费。
// 规则改这里，工作台和对账单都跟着走；已结的场用冻结值，历史不动。

/** 小孩（收费的，5-12 岁）按半个人头给师傅；免费小孩（3-4 岁 $0）不算。 */
export const KID_HEAD_FACTOR = 0.5
/** 派对带桌椅时付给师傅：$4 × 带桌椅的人头（大人小孩全算）。 */
export const TABLE_CHAIR_PER_HEAD_CENTS = 400
/**
 * 路费（2026-09-28 用户定）：基地 913 Ranlett Ave, La Puente 91744 到客户家
 * 的最短驾驶距离（发票 travelFee.distanceMiles 就是这么算的）。
 * 超过 50 mi 的场：整程 × $1/mi（等价于 $50 起步 + 超出 × $1）；
 * 50 mi 及以内：$0。客户那头免不免路费都照给师傅。
 */
export const TRAVEL_FREE_MILES = 50
export const TRAVEL_BASE_CENTS = 5000 // = 50 mi × $1，只用于对账单展示"起步"口径
export const TRAVEL_PER_MILE_CENTS = 100

export type HeadCounts = { adults: number; kids: number; littles: number }

/** 计钱的人头：大人整头、收费小孩半头、免费小孩 0。 */
export function payableHeads(c: HeadCounts): number {
  return Math.max(0, c.adults) + KID_HEAD_FACTOR * Math.max(0, c.kids)
}

/**
 * 特殊人头规则（老板 2026-10-10，April：35 个 12–13 岁男孩）：发票按大人记，
 * 备料单才会按成人份量做菜；但师傅工钱按小孩算半个人头。谈价时定在线索上
 * （leads.chef_pay_rule），算工钱时顺着订单的 source_metadata.lead_id 读出来，
 * 派师傅、结账的人不用记得手改。adultsAsKids：发票上的大人里有几位按小孩算，
 * "all" = 全部。
 */
export type ChefPayRule = { adultsAsKids: number | "all"; note?: string }

export function normalizeChefPayRule(value: unknown): ChefPayRule | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  const raw = v.adultsAsKids
  const note = typeof v.note === "string" && v.note.trim() ? v.note.trim().slice(0, 200) : undefined
  if (raw === "all") return { adultsAsKids: "all", ...(note ? { note } : {}) }
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return { adultsAsKids: Math.floor(n), ...(note ? { note } : {}) }
}

/** 按规则把发票上的一部分大人挪成收费小孩；规则比现有大人多就全挪（人数后来少了也对）。 */
export function applyChefPayRule(c: HeadCounts, rule: ChefPayRule | null | undefined): HeadCounts {
  if (!rule) return c
  const adults = Math.max(0, c.adults)
  const moved = rule.adultsAsKids === "all" ? adults : Math.min(adults, Math.max(0, Math.floor(rule.adultsAsKids)))
  return { adults: adults - moved, kids: Math.max(0, c.kids) + moved, littles: c.littles }
}

/** 一句话："35 位大人按小孩算" / "全部大人按小孩算"。 */
export function describeChefPayRule(rule: ChefPayRule): string {
  return rule.adultsAsKids === "all" ? "发票上的大人全部按小孩（半个人头）算" : `发票上 ${rule.adultsAsKids} 位大人按小孩（半个人头）算`
}

/** 人头费，允许半个人头（13大+1小 = 13.5 头）。底价 = head_from 个头的钱。 */
export function chefPayCentsFrac(rate: ChefRate, heads: number): number {
  const extra = Math.max(0, heads - rate.head_from)
  return Math.round(Math.max(0, rate.base_pay_cents) + extra * Math.max(0, rate.per_head_cents))
}

export function tableChairCents(tableHeads: number): number {
  return Math.max(0, Math.round(tableHeads)) * TABLE_CHAIR_PER_HEAD_CENTS
}

export function travelCompCents(distanceMiles: number | null | undefined): number {
  if (distanceMiles == null || !Number.isFinite(distanceMiles)) return 0
  if (distanceMiles <= TRAVEL_FREE_MILES) return 0
  // 整程 × $1（≡ $50 + 超出 × $1）
  return Math.round(distanceMiles * TRAVEL_PER_MILE_CENTS)
}

/** 好评奖励：客人扫码留的 Google/Yelp 评价，无图 $2/条、带图 $3/条。 */
export const REVIEW_PLAIN_CENTS = 200
export const REVIEW_PHOTO_CENTS = 300
export function reviewBonusCents(plain: number, photo: number): number {
  return Math.max(0, Math.round(plain)) * REVIEW_PLAIN_CENTS + Math.max(0, Math.round(photo)) * REVIEW_PHOTO_CENTS
}

/**
 * **只用于 v1 口径（2026-10-05 及之前建的单）。** 10-06 起的单（D-1006-05）刷卡
 * 按 Stripe 实际成本 3% 列（config/pricing-rules.ts cardProcessingFeeOn），
 * 税按派对地址另列——见 app/api/admin/chefs/route.ts card_lookup。
 *
 * 结算口径的刷卡手续费：一律按 4% 算，不看 Stripe 实扣（2026-09-28 用户定）。
 * 和发票上收客人的 Card Processing Fee 是同一个数——全链条只有一个 4%。
 * 4% 是加在现金价上的（刷卡价 = 现金 × 1.04），所以从实刷金额里拿掉时用
 * ÷ (1 + CARD_FEE_RATE)，不是 × (1 − CARD_FEE_RATE)。
 */
export const CARD_FEE_RATE = 0.04
