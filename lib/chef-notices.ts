import type { SupabaseClient } from "@supabase/supabase-js"
import { CHEF_NOTICE_WHY, isChefNoticeAlarm, openCallback, requestCallback, type RingOutcome } from "@/lib/callback-ring"
import { classifyChefText, type ChefTextKind } from "@/lib/chef-inbound"
import { thatPartyZh, type PartyRef } from "@/lib/chef-notify"
import { wallToInstant } from "@/lib/first-response"
import { loadStaffContacts, staffOnNumber, type StaffContact } from "@/lib/staff-phones"

// chef_change_notices, this side of it (order-flow rebuild 2026-11-11, D-1111-03).
//
// The invoice app (card A) texts the chef on a party whenever the order
// changes inside 72 hours - what changed, the link, "回 1 确认" - and writes a
// row here: id, order_id, staff_member_id, summary, sent_at, acked_at, sms_sid.
// This side closes the loop:
//   - the chef's "1" stamps acked_at (the SMS webhook calls ackNoticesFromPhone)
//   - a notice still open two hours after it went shows in the inbox
//   - one still open three hours before the party rings the owner's App
//     through the callback ring (lead-watch calls ringUnackedNotices)
//
// The table arrives with card A. Until it exists every read here comes back
// empty and every write is a no-op: nothing shows, nothing rings, nothing breaks.

export type ChefNotice = { id: string; order_id: string; staff_member_id: string; summary: string | null; sent_at: string | null; acked_at: string | null }
export type NoticeOrder = PartyRef & { order_status: string | null; customer_phone?: string | null }

/** A notice this old with no "1" is listed for a person. */
export const NOTICE_LIST_AFTER_MS = 2 * 3600_000
/** This close to the start an open notice is urgent: the owner's App rings. */
export const NOTICE_RING_BEFORE_MS = 3 * 3600_000
/** ...but not in the first minutes after it went out: the chef has to be able to read it and answer. */
export const NOTICE_RING_GRACE_MS = 15 * 60_000
/** Past this the party is on or over and a confirmation changes nothing. */
const PARTY_UNDERWAY_MS = 60 * 60_000

/** Every notice nobody has confirmed, oldest first. [] when the table is not there (card A not deployed) or the read fails. */
export async function loadOpenNotices(supabase: SupabaseClient): Promise<ChefNotice[]> {
  try {
    const { data, error } = await supabase
      .from("chef_change_notices")
      .select("id, order_id, staff_member_id, summary, sent_at, acked_at")
      .is("acked_at", null)
      .order("sent_at", { ascending: true })
      .limit(300)
    if (error) return []
    return ((data ?? []) as ChefNotice[]).filter((n) => n.order_id && n.staff_member_id && n.sent_at && Number.isFinite(Date.parse(n.sent_at)))
  } catch {
    return []
  }
}

export type NoticeGroup = { orderId: string; staffId: string; notices: ChefNotice[]; oldestSentAt: string; newestSentAt: string }

/** One line per chef per party: three saves an hour apart are one thing to chase, not three. */
export function groupNotices(notices: ChefNotice[]): NoticeGroup[] {
  const byKey = new Map<string, NoticeGroup>()
  for (const n of notices) {
    if (!n.sent_at) continue
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

/** What changed, in one line: the notices' own summaries, oldest first. */
export function noticeSummary(group: Pick<NoticeGroup, "notices">, max = 140): string {
  const parts = group.notices
    .slice()
    .sort((a, b) => String(a.sent_at).localeCompare(String(b.sent_at)))
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
 * `orderId` narrows it to one party (a person marking it by hand); the chef's
 * own "1" confirms everything he has open. No table, no rows, a failed write:
 * { acked: 0 }, never a throw - this runs inside the SMS webhook.
 */
export async function ackNotices(
  supabase: SupabaseClient,
  input: { staffIds: string[]; orderId?: string | null; via: string; now?: number },
): Promise<AckOutcome> {
  const staffIds = [...new Set(input.staffIds.filter(Boolean))]
  const none: AckOutcome = { acked: 0, orderIds: [], staffIds }
  if (!staffIds.length) return none
  const at = new Date(input.now ?? Date.now()).toISOString()
  try {
    let q = supabase.from("chef_change_notices").update({ acked_at: at }).in("staff_member_id", staffIds).is("acked_at", null)
    if (input.orderId) q = q.eq("order_id", input.orderId)
    const { data, error } = await q.select("id, order_id, staff_member_id")
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

export type NoticeRing = { orderId: string; orderNo: string | null; staffId: string; chef: string; why: string; notices: string[]; rang: boolean; skipped?: string; error?: string; dryRun?: boolean }

const MARK = (noticeId: string) => `cn:ring:${noticeId}`

/** What the ring says (the callback's `why`): who has not confirmed which party. */
export function noticeAlarmText(chef: string, order: PartyRef): string {
  return `${CHEF_NOTICE_WHY}：${chef} 还没确认 ${thatPartyZh(order)}的改动，派对不到 3 小时就开始。`
}

/**
 * lead-watch's sweep: every notice still unconfirmed three hours before its
 * party rings the owner's App once, through the existing callback ring (which
 * rings again every ten minutes, three times at most, until he picks up).
 * One ring per chef per party; cn:ring:<notice id> in lead_watch_notified keeps
 * it from starting over on the next sweep. The callback lives on the order's
 * lead; when that lead already has a customer's own request open, this waits
 * for the next sweep rather than hide behind it.
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
  const open = await loadOpenNotices(supabase)
  if (!open.length) return []
  const groups = groupNotices(open)
  const orders = await loadNoticeOrders(supabase, groups.map((g) => g.orderId))
  // Only while there is still time to act on it: once the party has started the list keeps it, the phone does not ring.
  const due = groups.filter((g) => {
    const s = noticeState(g, orders.get(g.orderId), now)
    return s.urgent && s.hoursToParty !== null && s.hoursToParty > 0
  })
  if (!due.length) return []
  const keys = due.flatMap((g) => g.notices.map((n) => MARK(n.id)))
  const { data: marks } = await supabase.from("lead_watch_notified").select("key").in("key", keys)
  const marked = new Set(((marks ?? []) as Array<{ key: string }>).map((r) => r.key))
  const staff = new Map((await loadStaffContacts(supabase)).map((s) => [s.id, s]))
  const request = opts.request ?? requestCallback
  const openOf = opts.openOf ?? openCallback

  const out: NoticeRing[] = []
  for (const g of due) {
    const fresh = g.notices.filter((n) => !marked.has(MARK(n.id)))
    if (!fresh.length) continue
    const order = orders.get(g.orderId)!
    const who = staff.get(g.staffId)
    const chef = who?.name ?? "师傅"
    const why = noticeAlarmText(chef, order)
    const base = { orderId: g.orderId, orderNo: order.order_no ?? null, staffId: g.staffId, chef, why, notices: fresh.map((n) => n.id) }
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
    const res = await request(supabase, { leadId, phone: who?.phone || order.customer_phone || "", name: chef, why, source: `chef_notice:${fresh[0].id}` })
    const at = new Date(now).toISOString()
    await supabase.from("lead_watch_notified").upsert(fresh.map((n) => ({ key: MARK(n.id), kind: "cn", notified_at: at })), { onConflict: "key" })
    out.push({ ...base, rang: res.rang, ...(res.skipped ? { skipped: res.skipped } : {}), ...(res.error ? { error: res.error } : {}) })
  }
  return out
}
