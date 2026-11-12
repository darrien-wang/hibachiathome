import type { SupabaseClient } from "@supabase/supabase-js"
import { CHEF_NOTICE_WHY, isChefNoticeAlarm, openCallback, requestCallback, type RingOutcome } from "@/lib/callback-ring"
import { classifyChefText, type ChefTextKind } from "@/lib/chef-inbound"
import { SHEET_SEND_FAILED, sheetHeld, sheetReachedChef, sheetSendErrorZh, thatPartyZh, type PartyRef, type SheetLink } from "@/lib/chef-notify"
import { wallToInstant } from "@/lib/first-response"
import { loadStaffContacts, staffOnNumber, type StaffContact } from "@/lib/staff-phones"

// chef_change_notices, this side of it (order-flow rebuild 2026-11-11, D-1111-03).
//
// The invoice app (card A) texts the chef on a party whenever the order
// changes inside 72 hours - what changed, a fresh link, "回 1 确认" - and writes
// a row here: id, order_id, staff_member_id, summary, sent_at, acked_at, sms_sid.
// This side closes the loop:
//   - the chef's "1" stamps acked_at (the SMS webhook calls ackNoticesFromPhone)
//   - a notice still open two hours after it went shows in the inbox
//   - one still open three hours before the party rings the owner's App
//     through the callback ring (lead-watch calls ringUnackedNotices)
//   - a notice whose text never went out (no sms_sid, summary starting
//     【短信没发出去：) shows at once: every send issues a new link and revokes the
//     one before it, so that chef is holding no sheet he can open
//   - so does a chef left with no sheet by any other send that failed - the one
//     reassigning makes (D-1112-01), or a sheet text that bounced (loadSheetless)
//
// The table arrives with card A. Until it exists every read here comes back
// empty and every write is a no-op: nothing shows, nothing rings, nothing breaks.

export type ChefNotice = {
  id: string
  order_id: string
  staff_member_id: string
  summary: string | null
  sent_at: string | null
  acked_at: string | null
  /** Twilio's id for the text; empty when it never went out. */
  sms_sid?: string | null
  /** Not in the contract; read when the table has it, for a failed row with no sent_at. */
  created_at?: string | null
}
export type NoticeOrder = PartyRef & { order_status: string | null; customer_phone?: string | null }

/** A notice this old with no "1" is listed for a person. */
export const NOTICE_LIST_AFTER_MS = 2 * 3600_000
/** This close to the start an open notice is urgent: the owner's App rings. */
export const NOTICE_RING_BEFORE_MS = 3 * 3600_000
/** ...but not in the first minutes after it went out: the chef has to be able to read it and answer. */
export const NOTICE_RING_GRACE_MS = 15 * 60_000
/** Past this the party is on or over and a confirmation changes nothing. */
const PARTY_UNDERWAY_MS = 60 * 60_000
/**
 * Open notices older than this are history and are not read: a change text goes out in the last
 * days before a party, and an hour into the party nobody chases it. A failed send that was cured
 * by sending the sheet again is never confirmed by anyone, so without a bound the open rows - read
 * on every inbox poll - would only grow.
 */
export const NOTICE_LOOKBACK_MS = 14 * 24 * 3600_000
/** How card A marks a notice whose text was not sent: the summary opens with this and sms_sid is empty. */
export const FAILED_SEND_MARK = "【短信没发出去："
/** A sheet stamped as sent this long after the failed text is a re-send, not the link that failed text was carrying. */
export const RESEND_MARGIN_MS = 60_000

const validTime = (iso: string | null | undefined): iso is string => Boolean(iso) && Number.isFinite(Date.parse(String(iso)))
const pairKey = (x: { orderId: string; staffId: string }) => `${x.orderId}:${x.staffId}`

/** The change text never reached the chef. His old link was revoked when this one was issued, so he has no working sheet. */
export function isFailedSend(n: Pick<ChefNotice, "summary" | "sms_sid">): boolean {
  return !String(n.sms_sid ?? "").trim() && String(n.summary ?? "").trimStart().startsWith(FAILED_SEND_MARK)
}

/** When a notice happened: sent_at, else the row's created_at where the table has one, else unknown. */
export function noticeAt(n: Pick<ChefNotice, "sent_at" | "created_at">): string | null {
  return validTime(n.sent_at) ? n.sent_at : validTime(n.created_at) ? n.created_at : null
}

/**
 * The notices of the last two weeks nobody has confirmed, oldest first. [] when the table is not
 * there (card A not deployed) or the read fails.
 */
export async function loadOpenNotices(supabase: SupabaseClient, now = Date.now()): Promise<ChefNotice[]> {
  try {
    const since = now - NOTICE_LOOKBACK_MS
    // "*": the rows are few and small, and created_at is read if card A's table has one.
    // A text that was never sent may carry no sent_at; newest first, so the cap cuts history, not today.
    const { data, error } = await supabase
      .from("chef_change_notices")
      .select("*")
      .is("acked_at", null)
      .or(`sent_at.gte.${new Date(since).toISOString()},sent_at.is.null`)
      .order("sent_at", { ascending: false, nullsFirst: true })
      .limit(300)
    if (error) return []
    const when = (n: ChefNotice) => Date.parse(noticeAt(n) ?? "")
    return (
      ((data ?? []) as ChefNotice[])
        // A row that was not sent and is not marked as a failure is not a notice yet.
        .filter((n) => n.order_id && n.staff_member_id && (isFailedSend(n) || validTime(n.sent_at)))
        // The window again, in code: for a row dated only by created_at, and for whatever the filter let through.
        .filter((n) => !(when(n) < since))
        .sort((a, b) => (when(a) || 0) - (when(b) || 0))
    )
  } catch {
    return []
  }
}

export type NoticeGroup = { orderId: string; staffId: string; notices: ChefNotice[]; oldestSentAt: string; newestSentAt: string }

/** One line per chef per party: three saves an hour apart are one thing to chase, not three. Texts that went out only. */
export function groupNotices(notices: ChefNotice[]): NoticeGroup[] {
  const byKey = new Map<string, NoticeGroup>()
  for (const n of notices) {
    if (!n.sent_at || isFailedSend(n)) continue
    const key = `${n.order_id}:${n.staff_member_id}`
    const g = byKey.get(key)
    if (!g) byKey.set(key, { orderId: n.order_id, staffId: n.staff_member_id, notices: [n], oldestSentAt: n.sent_at, newestSentAt: n.sent_at })
    else {
      g.notices.push(n)
      if (n.sent_at < g.oldestSentAt) g.oldestSentAt = n.sent_at
      if (n.sent_at > g.newestSentAt) g.newestSentAt = n.sent_at
    }
  }
  return [...byKey.values()]
}

/** A chef on a party whose latest change text did not go out. `at` = when (newest failure), null when the rows carry no time. */
export type FailedGroup = { orderId: string; staffId: string; notices: ChefNotice[]; at: string | null }

/**
 * The failed sends that still matter, per chef per party. A failed text that
 * was followed by one that did go out is history: the later text carried a
 * newer link. One with no time on it cannot be placed against the other
 * texts and is kept here; the links decide (sheetReachedSince).
 */
export function groupFailedSends(notices: ChefNotice[]): FailedGroup[] {
  const lastDelivered = new Map<string, number>()
  for (const n of notices) {
    if (isFailedSend(n) || !validTime(n.sent_at)) continue
    const key = `${n.order_id}:${n.staff_member_id}`
    lastDelivered.set(key, Math.max(lastDelivered.get(key) ?? 0, Date.parse(n.sent_at)))
  }
  const byKey = new Map<string, FailedGroup>()
  for (const n of notices) {
    if (!isFailedSend(n)) continue
    const key = `${n.order_id}:${n.staff_member_id}`
    const at = noticeAt(n)
    if (at && (lastDelivered.get(key) ?? 0) > Date.parse(at)) continue
    const g = byKey.get(key)
    if (!g) byKey.set(key, { orderId: n.order_id, staffId: n.staff_member_id, notices: [n], at })
    else {
      g.notices.push(n)
      if (at && (!g.at || at > g.at)) g.at = at
    }
  }
  return [...byKey.values()]
}

export type SentLink = {
  order_id: string
  staff_member_id: string | null
  sent_via: string | null
  sent_at: string | null
  first_opened_at: string | null
  revoked_at?: string | null
}

/**
 * This chef is holding a sheet again, so the failed text is over. Every send
 * mints a new link and revokes the one before it (the invoice app, 2026-11-11),
 * so what he holds is his one live link, and the question is whether that link
 * got to him after the failure:
 *   - it was texted or handed over more than a minute after the failed text
 *     (the link that text was carrying is stamped at about the same moment and
 *     must not count as its own cure), or
 *   - he has opened it since.
 * The token is not compared with anything: a re-send is a new row, and a
 * revoked row - an older sheet, or one he opened before it was replaced - is
 * not in his hands. A failed row with no time on it is judged by the live
 * link alone: it reached him, or it did not.
 */
export function sheetReachedSince(group: Pick<FailedGroup, "orderId" | "staffId" | "at">, links: SentLink[]): boolean {
  const failedAt = group.at ? Date.parse(group.at) : null
  return links.some((l) => {
    if (l.order_id !== group.orderId || l.staff_member_id !== group.staffId || l.revoked_at) return false
    if (failedAt === null) return sheetReachedChef(l)
    if (validTime(l.first_opened_at) && Date.parse(l.first_opened_at) > failedAt) return true
    return (l.sent_via === "twilio" || l.sent_via === "manual") && validTime(l.sent_at) && Date.parse(l.sent_at) > failedAt + RESEND_MARGIN_MS
  })
}

/** A chef on a coming party with no sheet he can open, because a sheet sent to him did not get to him. */
export type SheetlessGroup = {
  orderId: string
  staffId: string
  /** When that send failed. */
  at: string | null
  /** Why, as the send reported it, in words a person can act on; null when nothing said. */
  reason: string | null
  /** Names this failure for the ring sweep's once-only mark: the dead link, or the refused send. */
  mark: string
}

/** Refused sends older than this are history (the lookback of loadSheetless). */
export const SHEETLESS_LOOKBACK_MS = 7 * 24 * 3600_000

/**
 * Chefs left without a sheet by a send that did not get to them (owner
 * 2026-11-12, D-1112-01: chefs work only from the sheet and the order). Two
 * kinds of trace, both read narrowly so the inbox poll stays cheap:
 *   - a live link whose text failed (sent_via "failed") and that he never opened:
 *     any sheet text - the day-before send, a re-send, the one reassigning makes;
 *   - a send that made no link at all (order_events chef_sheet_send_failed,
 *     written by lib/chef-notify.ts sendSheetsToNewTeam): refused by the invoice
 *     app, or it could not be reached.
 * Each is kept only while he is still on the party as one of its chefs and
 * holds no live link that reached him (lib/chef-notify.ts sheetHeld: none or
 * undelivered); a stale link is the change flow's to replace and is not listed
 * here. Helpers are not listed: the invoice app sends them the lead's sheet as
 * it goes, and a helper with no phone on file (易非: both failed links on record,
 * 10-22 and 10-24, are his) would otherwise ring on every send. Unreadable
 * tables give [] - the board's other lists still answer.
 */
export async function loadSheetless(supabase: SupabaseClient, now = Date.now()): Promise<SheetlessGroup[]> {
  try {
    const nowIso = new Date(now).toISOString()
    const [dead, refused] = await Promise.all([
      supabase
        .from("chef_sheet_links")
        .select("id, order_id, staff_member_id, sent_at")
        .eq("sent_via", "failed")
        .is("revoked_at", null)
        .is("first_opened_at", null)
        .gt("expires_at", nowIso)
        .limit(100),
      supabase
        .from("order_events")
        .select("order_id, created_at, metadata")
        .eq("action", SHEET_SEND_FAILED)
        .gte("created_at", new Date(now - SHEETLESS_LOOKBACK_MS).toISOString())
        .order("created_at", { ascending: false })
        .limit(100),
    ])
    const found = new Map<string, SheetlessGroup & { linkId?: string }>()
    const keep = (g: SheetlessGroup & { linkId?: string }) => {
      const key = pairKey(g)
      const had = found.get(key)
      if (!had || Date.parse(g.at ?? "") > Date.parse(had.at ?? "")) found.set(key, g)
    }
    for (const l of (dead.error ? [] : (dead.data ?? [])) as Array<{ id: string; order_id: string | null; staff_member_id: string | null; sent_at: string | null }>) {
      if (l.order_id && l.staff_member_id) keep({ orderId: l.order_id, staffId: l.staff_member_id, at: validTime(l.sent_at) ? l.sent_at : null, reason: null, mark: `link:${l.id}`, linkId: l.id })
    }
    for (const e of (refused.error ? [] : (refused.data ?? [])) as Array<{ order_id: string | null; created_at: string; metadata: Record<string, unknown> | null }>) {
      const staffId = String(e.metadata?.staff_member_id ?? "")
      if (!e.order_id || !/^[0-9a-f-]{36}$/i.test(staffId)) continue
      keep({ orderId: e.order_id, staffId, at: e.created_at, reason: sheetSendErrorZh(String(e.metadata?.error ?? "")), mark: `send:${e.order_id}:${staffId}:${e.created_at}` })
    }
    if (!found.size) return []
    const orderIds = [...new Set([...found.values()].map((g) => g.orderId))]
    const [asg, links] = await Promise.all([
      supabase
        .from("order_staff_assignments")
        .select("order_id, staff_member_id")
        .in("order_id", orderIds)
        .in("assignment_status", ["tentative", "confirmed", "completed"])
        .neq("assignment_role", "assistant_chef"),
      supabase.from("chef_sheet_links").select("order_id, staff_member_id, sent_via, first_opened_at, revoked_at, stale").in("order_id", orderIds),
    ])
    let out = [...found.values()]
    if (!asg.error) {
      const on = new Set(((asg.data ?? []) as Array<{ order_id: string; staff_member_id: string }>).map((a) => `${a.order_id}:${a.staff_member_id}`))
      out = out.filter((g) => on.has(pairKey(g)))
    }
    if (!links.error) {
      const byOrder = new Map<string, SheetLink[]>()
      for (const l of (links.data ?? []) as Array<SheetLink & { order_id: string }>) byOrder.set(l.order_id, [...(byOrder.get(l.order_id) ?? []), l])
      out = out.filter((g) => {
        const held = sheetHeld(byOrder.get(g.orderId) ?? [], g.staffId)
        return held === "none" || held === "undelivered"
      })
    }
    // Why a text bounced: the send that made the link said so on the order's timeline.
    const needReason = out.filter((g) => g.linkId)
    if (needReason.length) {
      const { data: evs } = await supabase
        .from("order_events")
        .select("order_id, metadata")
        .in("order_id", [...new Set(needReason.map((g) => g.orderId))])
        .in("action", ["chef_sheet_sent", "chef_change_notice_failed"])
        .order("created_at", { ascending: false })
        .limit(200)
      const why = new Map<string, string>()
      for (const e of (evs ?? []) as Array<{ metadata: Record<string, unknown> | null }>) {
        const linkId = String(e.metadata?.link_id ?? "")
        const sms = (e.metadata?.sms ?? null) as { error?: unknown } | null
        if (linkId && sms?.error && !why.has(linkId)) why.set(linkId, sheetSendErrorZh(String(sms.error)))
      }
      for (const g of needReason) g.reason = why.get(g.linkId!) ?? null
    }
    return out.map((g) => ({ orderId: g.orderId, staffId: g.staffId, at: g.at, reason: g.reason, mark: g.mark }))
  } catch {
    return []
  }
}

/** What is open: texts waiting for a "1", chefs whose change text never arrived, and chefs a sheet never reached. */
export type NoticeBoard = { waiting: NoticeGroup[]; failed: FailedGroup[]; sheetless: SheetlessGroup[] }

/**
 * Open notices for chefs who are still on the party. A chef who was taken off
 * it after the notice went (reassigned, or the party cancelled) has nothing
 * left to confirm and no sheet to be missing: his notice must not sit on the
 * list or ring the owner about a party he is not cooking. A failed send is
 * dropped once that chef holds a sheet again (sheetReachedSince) - and comes
 * back if the re-send's own text fails, because then he does not. When the
 * assignments or the links cannot be read, nothing is filtered - an extra
 * line beats a missing one.
 */
export async function loadNoticeBoard(supabase: SupabaseClient, now = Date.now()): Promise<NoticeBoard> {
  const [open, sheetlessAll] = await Promise.all([loadOpenNotices(supabase, now), loadSheetless(supabase, now)])
  let waiting = groupNotices(open)
  let failed = groupFailedSends(open)
  // One line per chef per party: a failed change notice says it with what changed.
  const withSheetless = (f: FailedGroup[]) => {
    const failedPairs = new Set(f.map(pairKey))
    return sheetlessAll.filter((g) => !failedPairs.has(pairKey(g)))
  }
  if (!waiting.length && !failed.length) return { waiting, failed, sheetless: withSheetless(failed) }
  try {
    const { data, error } = await supabase
      .from("order_staff_assignments")
      .select("order_id, staff_member_id")
      .in("order_id", [...new Set([...waiting, ...failed].map((g) => g.orderId))])
      .in("assignment_status", ["tentative", "confirmed", "completed"])
    if (!error) {
      const on = new Set(((data ?? []) as Array<{ order_id: string; staff_member_id: string }>).map((a) => `${a.order_id}:${a.staff_member_id}`))
      waiting = waiting.filter((g) => on.has(pairKey(g)))
      failed = failed.filter((g) => on.has(pairKey(g)))
    }
  } catch {
    // keep them all
  }
  if (failed.length) {
    try {
      const { data, error } = await supabase
        .from("chef_sheet_links")
        .select("order_id, staff_member_id, sent_via, sent_at, first_opened_at, revoked_at")
        .in("order_id", [...new Set(failed.map((g) => g.orderId))])
        .in("staff_member_id", [...new Set(failed.map((g) => g.staffId))])
      if (!error) failed = failed.filter((g) => !sheetReachedSince(g, (data ?? []) as SentLink[]))
    } catch {
      // keep them all
    }
  }
  return { waiting, failed, sheetless: withSheetless(failed) }
}

/** The texts still waiting for a "1" (see loadNoticeBoard). */
export async function loadOpenNoticeGroups(supabase: SupabaseClient, now = Date.now()): Promise<NoticeGroup[]> {
  return (await loadNoticeBoard(supabase, now)).waiting
}

export type NoticeState = {
  /** Belongs on the list: two hours without a "1", or urgent. */
  show: boolean
  /** Three hours or less to the start and still no "1": ring. */
  urgent: boolean
  waitedMinutes: number
  /** Hours until the party starts; null when the order has no date. */
  hoursToParty: number | null
}

/**
 * Where an unconfirmed notice stands. orders.event_start is the PT wall clock
 * stored as UTC, so it is turned into the real instant before it meets `now`.
 * A cancelled order, or a party already an hour in, is nobody's to chase.
 */
export function noticeState(group: Pick<NoticeGroup, "oldestSentAt">, order: Pick<NoticeOrder, "event_start" | "order_status"> | null | undefined, now: number): NoticeState {
  const sent = Date.parse(group.oldestSentAt)
  const waitedMinutes = Math.max(0, Math.round((now - sent) / 60_000))
  const off: NoticeState = { show: false, urgent: false, waitedMinutes, hoursToParty: null }
  if (!order || order.order_status === "cancelled" || !Number.isFinite(sent)) return off
  const start = order.event_start ? wallToInstant(order.event_start) : NaN
  if (!Number.isFinite(start)) return { ...off, show: now - sent >= NOTICE_LIST_AFTER_MS }
  const hoursToParty = Math.round(((start - now) / 3600_000) * 10) / 10
  if (now - start > PARTY_UNDERWAY_MS) return { ...off, hoursToParty }
  const urgent = start - now <= NOTICE_RING_BEFORE_MS && now - sent >= NOTICE_RING_GRACE_MS
  return { show: urgent || now - sent >= NOTICE_LIST_AFTER_MS, urgent, waitedMinutes, hoursToParty }
}

/**
 * Where a failed send stands. It shows from the moment it failed - there is no
 * two-hour wait for a text that never went and no grace for a chef to answer
 * it. `urgent` (three hours to the start) is when lead-watch also calls the
 * owner. Same ends as any notice: a cancelled order, a party an hour in.
 */
export function failedSendState(group: Pick<FailedGroup, "at">, order: Pick<NoticeOrder, "event_start" | "order_status"> | null | undefined, now: number): NoticeState {
  const waitedMinutes = group.at ? Math.max(0, Math.round((now - Date.parse(group.at)) / 60_000)) : 0
  const off: NoticeState = { show: false, urgent: false, waitedMinutes, hoursToParty: null }
  if (!order || order.order_status === "cancelled") return off
  const start = order.event_start ? wallToInstant(order.event_start) : NaN
  if (!Number.isFinite(start)) return { ...off, show: true }
  const hoursToParty = Math.round(((start - now) / 3600_000) * 10) / 10
  if (now - start > PARTY_UNDERWAY_MS) return { ...off, hoursToParty }
  return { show: true, urgent: start - now <= NOTICE_RING_BEFORE_MS, waitedMinutes, hoursToParty }
}

/** What changed, in one line: the notices' own summaries, oldest first. */
export function noticeSummary(group: { notices: ChefNotice[] }, max = 140): string {
  const parts = group.notices
    .slice()
    .sort((a, b) => String(noticeAt(a) ?? "").localeCompare(String(noticeAt(b) ?? "")))
    .map((n) => (n.summary ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
  const text = [...new Set(parts)].join("；")
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const ORDER_COLUMNS = "id, order_no, customer_name, customer_phone, event_start, event_address, order_status, source_metadata"

export async function loadNoticeOrders(supabase: SupabaseClient, orderIds: string[]): Promise<Map<string, NoticeOrder>> {
  const ids = [...new Set(orderIds)]
  if (!ids.length) return new Map()
  const { data } = await supabase.from("orders").select(ORDER_COLUMNS).in("id", ids)
  return new Map(((data ?? []) as NoticeOrder[]).map((o) => [o.id, o]))
}

// ---- the chef's "1" -----------------------------------------------------------

export type AckOutcome = { acked: number; orderIds: string[]; staffIds: string[] }

/**
 * Mark open notices confirmed and leave a line on each order's timeline.
 * `orderId` narrows it to one party (a person marking it by hand).
 *
 * The chef's own "1" confirms what reached him: every text that went out, and
 * a failed one only when a later text on the same party did go out (that one
 * carried the newer link). A failed send he never saw is not his to confirm -
 * his "1" to an earlier text must not take it off the list while he has no
 * sheet. A person can (`includeFailed`): they know he has it some other way.
 *
 * No table, no rows, a failed write: { acked: 0 }, never a throw - this runs
 * inside the SMS webhook.
 */
export async function ackNotices(
  supabase: SupabaseClient,
  input: { staffIds: string[]; orderId?: string | null; via: string; now?: number; includeFailed?: boolean },
): Promise<AckOutcome> {
  const staffIds = [...new Set(input.staffIds.filter(Boolean))]
  const none: AckOutcome = { acked: 0, orderIds: [], staffIds }
  if (!staffIds.length) return none
  const at = new Date(input.now ?? Date.now()).toISOString()
  try {
    let read = supabase.from("chef_change_notices").select("*").in("staff_member_id", staffIds).is("acked_at", null)
    if (input.orderId) read = read.eq("order_id", input.orderId)
    const { data: openRows, error: readError } = await read
    if (readError) return none
    const open = (openRows ?? []) as ChefNotice[]
    const delivered = open.filter((n) => !isFailedSend(n))
    const superseded = (f: ChefNotice) => {
      const failedAt = noticeAt(f)
      return Boolean(failedAt) && delivered.some((d) => d.order_id === f.order_id && d.staff_member_id === f.staff_member_id && validTime(d.sent_at) && Date.parse(d.sent_at) > Date.parse(failedAt!))
    }
    const ids = (input.includeFailed ? open : open.filter((n) => !isFailedSend(n) || superseded(n))).map((n) => n.id)
    if (!ids.length) return none
    const { data, error } = await supabase.from("chef_change_notices").update({ acked_at: at }).in("id", ids).is("acked_at", null).select("id, order_id, staff_member_id")
    if (error) return none
    const rows = (data ?? []) as Array<{ id: string; order_id: string; staff_member_id: string }>
    if (!rows.length) return none
    try {
      await supabase.from("order_events").insert(
        rows.map((r) => ({ order_id: r.order_id, actor: input.via, action: "chef_change_acked", metadata: { notice_id: r.id, staff_member_id: r.staff_member_id, acked_at: at } })),
      )
    } catch {
      // the timeline line is best effort; acked_at is what counts
    }
    return { acked: rows.length, orderIds: [...new Set(rows.map((r) => r.order_id))], staffIds }
  } catch {
    return none
  }
}

/** The SMS webhook's side of "回 1 确认": whose number is this, and confirm what they have open. */
export async function ackNoticesFromPhone(supabase: SupabaseClient, fromPhone: string, now = Date.now(), contacts?: StaffContact[]): Promise<AckOutcome> {
  const staff = staffOnNumber(contacts ?? (await loadStaffContacts(supabase)), fromPhone)
  return ackNotices(supabase, { staffIds: staff.map((s) => s.id), via: "chef_sms", now })
}

/**
 * A text from a staff number, as the SMS webhook handles it: a "1" confirms
 * his open change notices, and nothing else is written anywhere - the inbox
 * reads the thread from Twilio and lists whatever needs a person as [chef].
 */
export async function onStaffText(
  supabase: SupabaseClient,
  input: { from: string; body: string; media: number; now?: number },
): Promise<{ kind: ChefTextKind; acked: number; orderIds: string[] }> {
  const kind = classifyChefText(input.body, input.media)
  if (kind !== "confirm") return { kind, acked: 0, orderIds: [] }
  const out = await ackNoticesFromPhone(supabase, input.from, input.now ?? Date.now())
  return { kind, acked: out.acked, orderIds: out.orderIds }
}

// ---- three hours before the party: ring the owner -------------------------------

export type NoticeRing = {
  orderId: string
  orderNo: string | null
  staffId: string
  chef: string
  why: string
  notices: string[]
  /** The text never reached him (he has no working sheet), as opposed to "has not confirmed". */
  failedSend?: boolean
  rang: boolean
  skipped?: string
  error?: string
  dryRun?: boolean
}

const MARK = (noticeId: string) => `cn:ring:${noticeId}`

/** What the ring says (the callback's `why`): who has not confirmed which party. */
export function noticeAlarmText(chef: string, order: PartyRef): string {
  return `${CHEF_NOTICE_WHY}：${chef} 还没确认 ${thatPartyZh(order)}的改动，派对不到 3 小时就开始。`
}

/** The same ring for a text that never went out: he cannot confirm what he has not seen, and he has no sheet. */
export function failedSendAlarmText(chef: string, order: PartyRef): string {
  return `${CHEF_NOTICE_WHY}：${chef} 没收到 ${thatPartyZh(order)}的改单短信，手里没有能打开的备料单，派对不到 3 小时就开始。`
}

/** ...and for a sheet that never reached him (D-1112-01). */
export function sheetlessAlarmText(chef: string, order: PartyRef): string {
  return `${CHEF_NOTICE_WHY}：${chef} 没收到 ${thatPartyZh(order)}的备料单，手里没有能打开的，派对不到 3 小时就开始。`
}

/**
 * lead-watch's sweep: every notice still unconfirmed three hours before its
 * party rings the owner's App once, through the existing callback ring (which
 * rings again every ten minutes, three times at most, until he picks up).
 * One ring per chef per party; cn:ring:<notice id> in lead_watch_notified keeps
 * it from starting over on the next sweep. A chef whose text never went out
 * rings the same way, with its own words, and stands in for his unconfirmed
 * texts on that party. The callback lives on the order's lead; when that lead
 * already has a customer's own request open, this waits for the next sweep
 * rather than hide behind it.
 */
export async function ringUnackedNotices(
  supabase: SupabaseClient,
  now = Date.now(),
  opts: {
    dryRun?: boolean
    request?: (supabase: SupabaseClient, input: { leadId: string; phone: string; name: string; why: string; source: string }) => Promise<RingOutcome>
    openOf?: typeof openCallback
  } = {},
): Promise<NoticeRing[]> {
  const board = await loadNoticeBoard(supabase, now)
  if (!board.waiting.length && !board.failed.length && !board.sheetless.length) return []
  const orders = await loadNoticeOrders(supabase, [...board.waiting, ...board.failed, ...board.sheetless].map((g) => g.orderId))
  // Only while there is still time to act on it: once the party has started the list keeps it, the phone does not ring.
  const ahead = (s: NoticeState) => s.urgent && s.hoursToParty !== null && s.hoursToParty > 0
  const failedDue = board.failed.filter((g) => ahead(failedSendState(g, orders.get(g.orderId), now)))
  const sheetlessDue = board.sheetless.filter((g) => ahead(failedSendState(g, orders.get(g.orderId), now)))
  const failedPairs = new Set([...failedDue, ...sheetlessDue].map(pairKey))
  const waitingByPair = new Map(board.waiting.map((g) => [pairKey(g), g]))
  const idsOf = (notices: ChefNotice[]) => notices.map((n) => n.id)
  // `ids` name what the owner is being told about, for the once-only marks: notice ids, or the failed send.
  const due: Array<{ orderId: string; staffId: string; ids: string[]; failedSend: boolean; sheetless?: boolean }> = [
    // The owner hears about this chef and this party once: his unconfirmed texts ride along with the failed one.
    ...failedDue.map((g) => ({ orderId: g.orderId, staffId: g.staffId, ids: idsOf([...g.notices, ...(waitingByPair.get(pairKey(g))?.notices ?? [])]), failedSend: true })),
    ...sheetlessDue.map((g) => ({ orderId: g.orderId, staffId: g.staffId, ids: [`sheet:${g.mark}`, ...idsOf(waitingByPair.get(pairKey(g))?.notices ?? [])], failedSend: true, sheetless: true })),
    ...board.waiting
      .filter((g) => !failedPairs.has(pairKey(g)) && ahead(noticeState(g, orders.get(g.orderId), now)))
      .map((g) => ({ orderId: g.orderId, staffId: g.staffId, ids: idsOf(g.notices), failedSend: false })),
  ]
  if (!due.length) return []
  const keys = due.flatMap((g) => g.ids.map((id) => MARK(id)))
  const { data: marks } = await supabase.from("lead_watch_notified").select("key").in("key", keys)
  const marked = new Set(((marks ?? []) as Array<{ key: string }>).map((r) => r.key))
  const staff = new Map((await loadStaffContacts(supabase)).map((s) => [s.id, s]))
  const request = opts.request ?? requestCallback
  const openOf = opts.openOf ?? openCallback

  const out: NoticeRing[] = []
  for (const g of due) {
    const fresh = g.ids.filter((id) => !marked.has(MARK(id)))
    if (!fresh.length) continue
    const order = orders.get(g.orderId)!
    const who = staff.get(g.staffId)
    const chef = who?.name ?? "师傅"
    const why = g.sheetless ? sheetlessAlarmText(chef, order) : g.failedSend ? failedSendAlarmText(chef, order) : noticeAlarmText(chef, order)
    const base = { orderId: g.orderId, orderNo: order.order_no ?? null, staffId: g.staffId, chef, why, notices: fresh, ...(g.failedSend ? { failedSend: true } : {}) }
    const leadId = String((order.source_metadata ?? {}).lead_id ?? "")
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
      out.push({ ...base, rang: false, skipped: "no_lead" })
      continue
    }
    if (opts.dryRun) {
      out.push({ ...base, rang: false, dryRun: true })
      continue
    }
    const already = await openOf(supabase, leadId)
    if (already && !isChefNoticeAlarm(already.why)) {
      out.push({ ...base, rang: false, skipped: "customer_callback_open" })
      continue
    }
    // The chef's number rides on the request: an answered call to him after it closes the alarm.
    // (The ring needs some number on file to go out at all; the customer's stands in when the chef has none.)
    const res = await request(supabase, { leadId, phone: who?.phone || order.customer_phone || "", name: chef, why, source: `chef_notice:${fresh[0]}` })
    const at = new Date(now).toISOString()
    await supabase.from("lead_watch_notified").upsert(fresh.map((id) => ({ key: MARK(id), kind: "cn", notified_at: at })), { onConflict: "key" })
    out.push({ ...base, rang: res.rang, ...(res.skipped ? { skipped: res.skipped } : {}), ...(res.error ? { error: res.error } : {}) })
  }
  return out
}
