import type { SupabaseClient } from "@supabase/supabase-js"
import { cityOf } from "@/lib/customers"
import { wallToInstant } from "@/lib/first-response"
import { sendSms, toE164, type SendSmsResult } from "@/lib/sms-thread"

// Telling a chef he is off a party (order-flow rebuild 2026-11-11, D-1111-03).
//
// Reassigning in the workbench sent the new chef a prep sheet and told the old
// one nothing: in 45 days six parties had a chef who got a sheet and was later
// taken off, and on 11-09 Blu was swapped out 13 minutes after his sheet went.
// A cancellation was the same by hand - SQL, then a text someone had to
// remember. Both now text the chef, in Chinese, from the 213 line (the same
// sendSms every other text of ours uses), and kill his prep-sheet link.
//
// The text says what changed and nothing else: no reason, no money, and never
// anything about buying (purchasing is the company's, owner 2026-11-11).

export type PartyRef = {
  id: string
  order_no?: string | null
  customer_name: string | null
  /** PT wall clock stored as UTC (lib/first-response.ts wallToInstant). */
  event_start: string | null
  event_address: string | null
  source_metadata?: Record<string, unknown> | null
}

/** "Joyce" from "Joyce Lin"; nothing for a name that is really a phone number. */
function firstNameOf(name: string | null | undefined): string {
  const n = (name ?? "").trim()
  if (!n || !/[a-z一-鿿]/i.test(n) || /^unknown/i.test(n)) return ""
  return n.split(/\s+/)[0]
}

/** "下午5:30" from the wall clock; midnight starts are legal (D-1109-01). */
function wallTimeZh(d: Date): string {
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const part = h < 5 ? "凌晨" : h < 12 ? "上午" : h === 12 ? "中午" : h < 18 ? "下午" : "晚上"
  return `${part}${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`
}

/**
 * The party the way a chef knows it: when, which town, whose.
 * "11月14日下午5:30 Irvine（Joyce）". The time is left out while it is still to
 * be confirmed, the date while the order is on a date hold.
 */
export function partyLabelZh(o: PartyRef): string {
  const ms = o.event_start ? Date.parse(o.event_start) : NaN
  let when = "日期待定"
  if (Number.isFinite(ms)) {
    const d = new Date(ms)
    const tbd = (o.source_metadata ?? {}).event_time_tbd === true
    when = `${d.getUTCMonth() + 1}月${d.getUTCDate()}日${tbd ? "" : wallTimeZh(d)}`
  }
  const city = cityOf(o.event_address) ?? ""
  const name = firstNameOf(o.customer_name)
  const who = city && name ? `${city}（${name}）` : city || name
  return who ? `${when} ${who}` : when
}

/** "…Irvine（Joyce）那场": the label, with a space only when it ends in a Latin letter or a digit. */
export function thatPartyZh(o: PartyRef): string {
  const label = partyLabelZh(o)
  return `${label}${/[A-Za-z0-9]$/.test(label) ? " " : ""}那场`
}
const thatParty = thatPartyZh

/** Reassigned: the chef who was taken off. */
export function removedFromPartyText(o: PartyRef): string {
  return `${thatParty(o)}改给别人了，你不用去，之前的备料单作废。`
}

/** Cancelled: every chef on the party. The sheet sentence only for one who has a sheet. */
export function partyCancelledText(o: PartyRef, hadSheet: boolean): string {
  return `${thatParty(o)}取消了，你不用去${hadSheet ? "，之前的备料单作废" : ""}。`
}

const HELPER_ROLE = "assistant_chef"
type TeamRow = { staff_member_id: string; assignment_role: string | null }

/**
 * Who a new team takes off the party (the workbench's `assign`): the cooks on
 * it now who are not on the new list - unless they stay on as a helper, which
 * is still going to the party.
 */
export function chefsRemovedByAssign(active: TeamRow[], want: string[]): string[] {
  const stayingHelpers = new Set(active.filter((a) => a.assignment_role === HELPER_ROLE && !want.includes(a.staff_member_id)).map((a) => a.staff_member_id))
  const cooks = active.filter((a) => a.assignment_role !== HELPER_ROLE)
  return [...new Set(cooks.map((a) => a.staff_member_id).filter((id) => !want.includes(id) && !stayingHelpers.has(id)))]
}

/** Who a new helper list takes off the party (`assign_helpers`): the helpers dropped, unless they cook on it. */
export function helpersRemovedByAssign(active: TeamRow[], wantHelpers: string[]): string[] {
  const cooks = new Set(active.filter((a) => a.assignment_role !== HELPER_ROLE).map((a) => a.staff_member_id))
  const helpers = active.filter((a) => a.assignment_role === HELPER_ROLE).map((a) => a.staff_member_id)
  return [...new Set(helpers.filter((id) => !wantHelpers.includes(id) && !cooks.has(id)))]
}

export type ChefNoticeResult = {
  staffId: string
  name: string
  phone: string | null
  /** A prep sheet reached him (texted, handed over, or opened). */
  hadSheet: boolean
  linksRevoked: number
  /** What was sent, or would be on a dry run; null when nothing goes out. */
  text: string | null
  texted: boolean
  sid?: string
  /** Why the text did not go: staff_has_no_phone, or what Twilio said. */
  error?: string
  /** Why nobody is texted at all. */
  skipped?: "no_sheet" | "party_started" | "party_over"
}

type LinkRow = { id: string; staff_member_id: string | null; sent_via: string | null; first_opened_at: string | null; revoked_at: string | null }

// A chef's prep-sheet links for one party. Since 2026-11-11 the invoice app mints a new link on
// every send and revokes the one before it, so a chef and a party have a history of rows, at most
// one of them live. Three questions are asked of it, and they are not the same question:
export type SheetLink = { staff_member_id: string | null; sent_via: string | null; first_opened_at: string | null; revoked_at: string | null; stale?: boolean | null }

/** This link got to him: it was texted, handed over, or he opened it. (sent_via "failed" and never opened = it did not.) */
export function sheetReachedChef(l: Pick<SheetLink, "sent_via" | "first_opened_at">): boolean {
  return l.sent_via === "twilio" || l.sent_via === "manual" || Boolean(l.first_opened_at)
}

/**
 * What he is holding for this party right now:
 *   opened / sent   a live link that reached him
 *   stale           a live link that reached him, void since the order changed materially - a new one is pending
 *   undelivered     a live link exists but its text never reached him
 *   none            no live link at all
 */
export function sheetHeld(links: SheetLink[], staffId: string): "opened" | "sent" | "stale" | "undelivered" | "none" {
  const live = links.filter((l) => l.staff_member_id === staffId && !l.revoked_at)
  if (!live.length) return "none"
  const reached = live.filter(sheetReachedChef)
  if (!reached.length) return "undelivered"
  if (reached.every((l) => l.stale === true)) return "stale"
  return reached.some((l) => !l.stale && l.first_opened_at) ? "opened" : "sent"
}

/**
 * The chefs on the team who still have to be sent the sheet by a person, once this party's sheets
 * have started going out. A change notice only goes to a chef who already holds a link, so a chef
 * who has just been put on the party - or whose only link never reached him - gets nothing from
 * that flow. One whose link is stale is not listed: the change flow is about to send him the new one.
 * Before any sheet has gone out for the party nobody is listed (assigning early texts no one).
 */
export function teamNeedingSheet(team: string[], links: SheetLink[]): string[] {
  if (!links.some(sheetReachedChef)) return []
  return [...new Set(team)].filter((id) => !links.some((l) => l.staff_member_id === id && !l.revoked_at && sheetReachedChef(l)))
}
type StaffRow = { id: string; display_name: string | null; full_name: string | null; phone: string | null }

/** Three hours after the start a cancellation is bookkeeping, not news for the chef. */
const CANCEL_STILL_NEWS_MS = 3 * 3600_000

/**
 * Text the chefs who are off this party and revoke their prep-sheet links.
 *
 *   reassigned  only a chef who had been sent a sheet (one who never heard of
 *               the party has nothing to be told), and only before the start -
 *               moving names on a party that already happened is bookkeeping.
 *   cancelled   every chef on the party, sheet or not.
 *
 * Never throws: the assignment or the order has already changed by the time
 * this runs, so a failed text comes back as `error` for a person to pass on.
 * `dryRun` reads and plans, writes and sends nothing. `send` is the SMS sender
 * (lib/sms-thread.ts sendSms); tests hand in their own.
 */
export async function notifyRemovedChefs(
  supabase: SupabaseClient,
  input: {
    order: PartyRef
    staffIds: string[]
    reason: "reassigned" | "cancelled"
    now?: number
    dryRun?: boolean
    send?: (phone: string, body: string) => Promise<SendSmsResult>
  },
): Promise<ChefNoticeResult[]> {
  const ids = [...new Set(input.staffIds.filter(Boolean))]
  if (!ids.length) return []
  const now = input.now ?? Date.now()
  const send = input.send ?? ((phone: string, body: string) => sendSms(phone, body))
  const order = input.order
  const start = order.event_start ? wallToInstant(order.event_start) : NaN
  const skipAll: ChefNoticeResult["skipped"] | undefined = !Number.isFinite(start)
    ? undefined
    : input.reason === "reassigned"
      ? start <= now
        ? "party_started"
        : undefined
      : start + CANCEL_STILL_NEWS_MS <= now
        ? "party_over"
        : undefined

  let staff: StaffRow[] = []
  let links: LinkRow[] = []
  try {
    const [s, l] = await Promise.all([
      supabase.from("staff_members").select("id, display_name, full_name, phone").in("id", ids),
      // Every link he has had for this party, not only the live one: a re-send replaces the link, and
      // the one that reached him may be a revoked row by now.
      supabase.from("chef_sheet_links").select("id, staff_member_id, sent_via, first_opened_at, revoked_at").eq("order_id", order.id).in("staff_member_id", ids),
    ])
    staff = (s.data ?? []) as StaffRow[]
    links = (l.data ?? []) as LinkRow[]
  } catch {
    // Read failed: fall through with what we have, so the caller still hears who was not told.
  }
  const staffById = new Map(staff.map((s) => [s.id, s]))
  const nowIso = new Date(now).toISOString()

  const out: ChefNoticeResult[] = []
  for (const staffId of ids) {
    const s = staffById.get(staffId)
    const name = (s?.display_name ?? s?.full_name ?? "").trim() || "?"
    const phone = toE164(s?.phone ?? null)
    const all = links.filter((l) => l.staff_member_id === staffId)
    const mine = all.filter((l) => !l.revoked_at)
    // He knows this party when he holds a link now and a sheet has reached him: the live one, or -
    // every send replaces the link - an older one, when the live one's own text bounced (which is
    // what a failed change text leaves behind). "failed" and never opened = he never saw that page.
    // No live link at all = nothing has been sent since he was last taken off, and he was told then.
    const hadSheet = mine.length > 0 && all.some(sheetReachedChef)
    const res: ChefNoticeResult = { staffId, name, phone, hadSheet, linksRevoked: 0, text: null, texted: false }
    if (skipAll) {
      out.push({ ...res, skipped: skipAll })
      continue
    }
    // The link dies either way: he is not on this party any more.
    if (mine.length && !input.dryRun) {
      try {
        const { error } = await supabase.from("chef_sheet_links").update({ revoked_at: nowIso, updated_at: nowIso }).in("id", mine.map((l) => l.id))
        if (!error) res.linksRevoked = mine.length
      } catch {
        // reported as linksRevoked: 0
      }
    } else if (input.dryRun) {
      res.linksRevoked = mine.length
    }
    if (input.reason === "reassigned" && !hadSheet) {
      out.push({ ...res, skipped: "no_sheet" })
      continue
    }
    res.text = input.reason === "reassigned" ? removedFromPartyText(order) : partyCancelledText(order, hadSheet)
    if (!phone) {
      out.push({ ...res, error: "staff_has_no_phone" })
      continue
    }
    if (input.dryRun) {
      out.push(res)
      continue
    }
    try {
      const sms = await send(phone, res.text)
      if (sms.ok) out.push({ ...res, texted: true, sid: sms.sid })
      else out.push({ ...res, error: sms.error })
    } catch (e) {
      out.push({ ...res, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return out
}

/** One order_events row per chef who was told (or should have been): the trail the 11-25 review reads. */
export async function logChefNotices(supabase: SupabaseClient, orderId: string, actor: string, reason: "reassigned" | "cancelled", results: ChefNoticeResult[]): Promise<void> {
  const rows = results
    .filter((r) => r.text || r.linksRevoked > 0)
    .map((r) => ({
      order_id: orderId,
      actor,
      action: "chef_removed_notified",
      metadata: {
        reason,
        staff_member_id: r.staffId,
        staff_name: r.name,
        to: r.phone,
        sms: r.texted ? { sid: r.sid ?? null } : { error: r.error ?? r.skipped ?? "not_sent" },
        links_revoked: r.linksRevoked,
        text: r.text,
      },
    }))
  if (!rows.length) return
  try {
    await supabase.from("order_events").insert(rows)
  } catch {
    // the trail is best effort; the text itself already went
  }
}

// ---- the chef put on a party gets its sheet (owner 2026-11-12, D-1112-01) ---------------
// 「给师傅更新发也是直接发，不要拖延」: a chef put on a party whose prep sheet has already
// gone out to someone is sent his own at once - no prompt, and no waiting for the
// morning. A change notice only goes to a chef who holds a link, so until someone
// remembered he would have had nothing. Before any sheet has gone out for the party
// nothing is sent: the day-before send covers the whole team.

/** What the invoice app's POST /api/chef-sheet/send answered, as the caller passes it on. */
export type SheetSendResult =
  | { ok: true; url?: string | null; resent?: boolean; sms?: { delivered?: boolean; error?: string | null } | null }
  | { ok: false; error: string; code?: string | null }

export type SheetSendInput = { orderNo: string; staffMemberId: string; sendSms: true; sentBy: string }

export type SheetAutoSend = {
  staffId: string
  name: string
  /** The invoice app took the send and made him a link. */
  sent: boolean
  /** ...and the text with it reached Twilio. */
  delivered: boolean
  error?: string
  code?: string
  dryRun?: boolean
}

/** order_events action for a send the invoice app refused or that never got there: no link was made. */
export const SHEET_SEND_FAILED = "chef_sheet_send_failed"

/**
 * Send the sheet to everyone on the team who has none, once the party's sheets
 * are out (teamNeedingSheet). `send` is the call to the invoice app - the
 * route's, or a test's. One send per chef, one after another; a send that is
 * refused or throws is written to order_events (SHEET_SEND_FAILED) so the inbox
 * can list him - a text that went nowhere leaves his link marked failed, and
 * the inbox finds that by itself. A cancelled party, or one already under way,
 * sends nothing (moving names then is bookkeeping, as for the chef taken off).
 * Never throws: the assignment is written before this runs.
 */
export async function sendSheetsToNewTeam(
  supabase: SupabaseClient,
  input: { orderId: string; team: string[]; sentBy: string; send: (x: SheetSendInput) => Promise<SheetSendResult>; dryRun?: boolean; now?: number },
): Promise<SheetAutoSend[]> {
  const team = [...new Set(input.team.filter(Boolean))]
  if (!team.length) return []
  const now = input.now ?? Date.now()
  try {
    const [{ data: order }, { data: links }] = await Promise.all([
      supabase.from("orders").select("id, order_no, event_start, order_status").eq("id", input.orderId).maybeSingle(),
      supabase.from("chef_sheet_links").select("staff_member_id, sent_via, first_opened_at, revoked_at, stale").eq("order_id", input.orderId),
    ])
    const o = order as { order_no?: string | null; event_start?: string | null; order_status?: string | null } | null
    if (!o?.order_no || o.order_status === "cancelled") return []
    const start = o.event_start ? wallToInstant(o.event_start) : NaN
    if (Number.isFinite(start) && start <= now) return []
    const need = teamNeedingSheet(team, (links ?? []) as SheetLink[])
    if (!need.length) return []
    const { data: staff } = await supabase.from("staff_members").select("id, display_name, full_name").in("id", need)
    const nameOf = new Map(((staff ?? []) as Array<{ id: string; display_name: string | null; full_name: string | null }>).map((s) => [s.id, (s.display_name ?? s.full_name ?? "").trim() || "?"]))
    if (input.dryRun) return need.map((id) => ({ staffId: id, name: nameOf.get(id) ?? "?", sent: false, delivered: false, dryRun: true }))
    const out: SheetAutoSend[] = []
    for (const id of need) {
      const name = nameOf.get(id) ?? "?"
      let res: SheetSendResult
      try {
        res = await input.send({ orderNo: o.order_no, staffMemberId: id, sendSms: true, sentBy: input.sentBy })
      } catch (e) {
        res = { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
      if (res.ok) {
        const delivered = res.sms?.delivered === true
        out.push({ staffId: id, name, sent: true, delivered, ...(delivered ? {} : { error: res.sms?.error || "not_delivered" }) })
        continue
      }
      out.push({ staffId: id, name, sent: false, delivered: false, error: res.error, ...(res.code ? { code: res.code } : {}) })
      try {
        await supabase.from("order_events").insert({
          order_id: input.orderId,
          actor: input.sentBy,
          action: SHEET_SEND_FAILED,
          metadata: { staff_member_id: id, staff_name: name, error: res.error, code: res.code ?? null },
        })
      } catch {
        // reported to the caller all the same
      }
    }
    return out
  } catch (e) {
    console.error("[chef-notify] sheet send to the new team failed", e instanceof Error ? e.message : e)
    return []
  }
}

/** "没存手机号" for the errors a person can act on; anything else as it came, short. */
export function sheetSendErrorZh(error: string | null | undefined): string {
  const e = String(error ?? "").trim()
  if (!e || e === "not_delivered") return "原因不明"
  if (e === "staff_has_no_phone") return "没存手机号"
  if (e === "sms_skipped") return "没走短信"
  return e.length > 80 ? `${e.slice(0, 79)}…` : e
}

/** "备料单已发给 Gary；Blu 的备料单短信没发出去（没存手机号），已进收件箱" for the workbench and the desk. */
export function sheetSendSummaryZh(results: SheetAutoSend[]): string {
  const planned = results.filter((r) => r.dryRun).map((r) => r.name)
  const done = results.filter((r) => !r.dryRun && r.delivered).map((r) => r.name)
  const bits: string[] = []
  if (planned.length) bits.push(`会自动给 ${planned.join("、")} 发备料单`)
  if (done.length) bits.push(`备料单已发给 ${done.join("、")}`)
  for (const r of results.filter((x) => !x.dryRun && !x.delivered)) {
    bits.push(`${r.name} 的备料单${r.sent ? "短信" : ""}没发出去（${sheetSendErrorZh(r.error)}），已进收件箱`)
  }
  return bits.join("；")
}

/** "已短信通知 Blu；Gary 没通知到（没存手机号），自己说一声" for the workbench and the desk. */
export function chefNoticeSummaryZh(results: ChefNoticeResult[]): string {
  const told = results.filter((r) => r.texted).map((r) => r.name)
  const failed = results.filter((r) => r.text && !r.texted && r.error)
  const bits: string[] = []
  if (told.length) bits.push(`已短信通知 ${told.join("、")} 不用去了`)
  for (const r of failed) bits.push(`${r.name} 没通知到（${r.error === "staff_has_no_phone" ? "没存手机号" : r.error}），自己说一声`)
  return bits.join("；")
}
