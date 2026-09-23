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
  weekly: "每周六结（周日–周六）",
  biweekly: "每两周",
  semimonthly: "每月 1 / 15 日",
  monthly: "每月 1 日",
  per_event: "每场结",
}
