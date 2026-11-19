// 外包（老板 2026-11-18）：卖给合作公司、由他们去做的派对，和我们自己做的（直营）分开——
// 不进派单路线、不算师傅数、不派师傅、不发备料单、不进备货清单。第一单是 RH-20261107-9978。
// 只在内部看得到：发票、派对页、邮件、短信一个字都不提。
//
// 标记存在 orders.dispatch_plan.outsourced（jsonb，不用加列）：{ at, by, invoice_token, note? }。
// dispatch_plan 的其余字段（chefs / grills / source / stations_note / promise …）照旧；
// lib/dispatch-plan.ts（和发票仓库镜像）的 normalizeDispatchPlan 只认它自己那几个键，读不到
// 这个键，所以备料单、派工规则、lint 都不受影响。整份重写 dispatch_plan 的地方（set_dispatch_plan、
// promise capture、scripts/backfill-dispatch-plan.ts）用 keepOutsourcedMark 把它带过去。
//
// invoice_token：给合作方的 invoice 链接 https://www.realhibachi.com/p/invoice/<token>（合作方要的是
// invoice，不是备料单）。每次打开都按订单现在的 invoice_data 现铸一份（lib/partner-invoice.ts），
// 所以链接在派对后两周内一直能用（lib/partner-invoice.ts PARTNER_LINK_DAYS_AFTER_PARTY）、永远是最新版。改回直营 = 标记连同 token 一起删掉，链接随即 404。
//
// 这个文件浏览器和服务器都用（日地图、订单列表、份额饼图），不能 import 任何 node 模块。

export type OutsourcedMark = {
  /** 标外包的时间（ISO）；手改库写成 true 的是 null。 */
  at: string | null
  /** 谁标的："workbench:<alias>"。 */
  by: string | null
  /** 给合作方的 invoice 链接的 token（32 位 base64url）；null = 还没生成。 */
  invoice_token: string | null
  /** 备注（哪家合作公司之类），可选。 */
  note?: string | null
}

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/

/** A partner invoice token as lib/partner-invoice.ts newInvoiceToken() mints it: 32 base64url characters. */
export const isInvoiceToken = (v: unknown): v is string => typeof v === "string" && TOKEN_RE.test(v)

const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)
const asRecord = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** The outsourced mark on a stored dispatch_plan, or null when the party is ours (直营). */
export function outsourcedMark(dispatchPlan: unknown): OutsourcedMark | null {
  const raw = asRecord(dispatchPlan)?.outsourced
  if (raw === true) return { at: null, by: null, invoice_token: null }
  const r = asRecord(raw)
  if (!r) return null
  const note = text(r.note, 200)
  return {
    at: text(r.at, 40),
    by: text(r.by, 80),
    invoice_token: isInvoiceToken(r.invoice_token) ? r.invoice_token : null,
    ...(note ? { note } : {}),
  }
}

export const isOutsourced = (order: { dispatch_plan?: unknown } | null | undefined): boolean => outsourcedMark(order?.dispatch_plan) !== null

/**
 * The dispatch_plan to store with the mark put on (mark) or taken off (null). Every other key stays as
 * it was, so taking the mark off gives back the plan as it was before; null when nothing is left.
 */
export function withOutsourcedMark(dispatchPlan: unknown, mark: OutsourcedMark | null): Record<string, unknown> | null {
  const next: Record<string, unknown> = { ...(asRecord(dispatchPlan) ?? {}) }
  delete next.outsourced
  if (mark) {
    next.outsourced = {
      at: mark.at,
      by: mark.by,
      invoice_token: mark.invoice_token,
      ...(mark.note ? { note: mark.note } : {}),
    }
  }
  return Object.keys(next).length ? next : null
}

/**
 * For a writer that rebuilds dispatch_plan from scratch (set_dispatch_plan, promise capture, the
 * backfill): the plan it is about to write, with the mark that was on the stored one carried over
 * as it was stored. Without this a promise texted to the customer would quietly bring an outsourced
 * party back onto the dispatch map - and kill the partner's invoice link.
 */
export function keepOutsourcedMark<T extends object>(previous: unknown, next: T): T {
  const raw = asRecord(previous)?.outsourced
  if (raw === undefined || raw === null || raw === false) return next
  return { ...next, outsourced: raw }
}

/** A day's orders: the ones we run (direct) and the ones a partner runs (outsourced), each in the order given. */
export function splitOutsourced<T extends { dispatch_plan?: unknown }>(rows: T[]): { direct: T[]; outsourced: T[] } {
  const direct: T[] = []
  const outsourced: T[] = []
  for (const r of rows) (isOutsourced(r) ? outsourced : direct).push(r)
  return { direct, outsourced }
}

/**
 * Why a party can no longer be handed to a partner, or null when it can. Marking a party outsourced
 * cancels its assignment rows; on one that has started, is done or is settled that would take the
 * chef's pay out of the ledgers (review 2026-11-19). eventStartWall / nowWall are the orders table's
 * wall-clock-as-UTC ISO strings (lib/first-response.ts instantToWallIso).
 */
export function outsourceBlocker(
  eventStartWall: string | null | undefined,
  nowWall: string,
  assignments: Array<{ assignment_status?: string | null; settled_at?: string | null; pay_settled_at?: string | null; settlement_id?: string | null }>,
): string | null {
  if (assignments.some((a) => a.settled_at || a.pay_settled_at || a.settlement_id)) return "这场已经和师傅结过账了，不能再标外包。"
  if (assignments.some((a) => a.assignment_status === "completed")) return "这场已经做完了，不能再标外包。"
  if (eventStartWall && Date.parse(eventStartWall) < Date.parse(nowWall)) return "这场已经开始或办完了，不能再标外包。"
  return null
}

export const PARTNER_INVOICE_BASE = "https://www.realhibachi.com/p/invoice"

/** The partner's durable invoice link, or null when the mark has no token yet. */
export const partnerInvoiceUrl = (token: string | null | undefined): string | null => (isInvoiceToken(token) ? `${PARTNER_INVOICE_BASE}/${token}` : null)

/**
 * The day dispatch dialog's title. Unchanged when nothing is outsourced ("2026-11-21 · 8 场 · 7 个师傅",
 * just the date while the plan is loading); with outsourced parties the direct ones are named as such:
 * "2026-11-21 · 7 场直营 · 1 场外包 · 7 个师傅".
 */
export function dayMapTitle(date: string, direct: number, outsourced: number, chefs: number | null): string {
  if (outsourced <= 0) return chefs === null ? date : `${date} · ${direct} 场 · ${chefs} 个师傅`
  return [date, `${direct} 场直营`, `${outsourced} 场外包`, ...(chefs === null ? [] : [`${chefs} 个师傅`])].join(" · ")
}
