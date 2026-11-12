import type { SupabaseClient } from "@supabase/supabase-js"
import { loadQuiet } from "@/lib/lead-hold"
import { instantToWallIso, shortDate, wallTime, wallToInstant } from "@/lib/first-response"
import { fetchLastByPeer, prettyPhone, toE164 } from "@/lib/sms-thread"
import { CHANNEL_OUT } from "@/lib/channel-messages"
import { CUSTOMER_FORM_TYPES, FORM_LABELS, formSummary } from "@/lib/customer-forms"
import { payloadColumns, payloadFrom } from "@/lib/payload-select"
import { awakeHours, findOpenTurns, shouldRing } from "@/lib/reply-audit"
import { OPT_OUT_REASON_PREFIX } from "@/lib/sms-opt-out"
import { isLookupBlock } from "@/lib/phone-line-type"
import { isStaffNumber, loadStaffContacts, staffOnNumber } from "@/lib/staff-phones"
import { openChefText } from "@/lib/chef-inbound"
import { OPEN_REQUEST_STATUSES, ORPHAN_REQUEST_LOOKBACK_MS, changeRequestBody, changeRequestOpen, changeRequestRings, isHeldRequest } from "@/lib/change-requests"
import { loadNoticeOrders, loadOpenNoticeGroups, noticeState, noticeSummary, type NoticeOrder } from "@/lib/chef-notices"
import { partyLabelZh } from "@/lib/chef-notify"

// 收件箱. "What needs a person right now", computed fresh each call and kept
// small. It started life inside /api/admin/mobile/inbox (the Android shell
// polls that every 10 s and turns events into notifications); the desk
// endpoint (/api/admin/desk) now builds its cards from the same list, so the
// phone, the desktop and the agent can never disagree on what is open.
//   lead          a new lead nobody (human or auto) has answered
//   sms           a customer text on the 213 line with no reply after it
//   deposit       a deposit that landed in the last two hours
//   order_change  a customer change request still open - listed until it is
//                 handled, with what changed; one filed within 48 hours of the
//                 party (held for a person) rings until someone confirms it
//   chef          a text from a staff number nobody answered: listed above the
//                 customers, rings from 15 minutes on (2026-11-11, D-1111-03)
//   chef_notice   a chef who has not confirmed a change to his party two hours
//                 after it was texted; rings inside three hours of the start
//                 (these three new alarms never ring 11 PM - 7 AM Pacific:
//                 lib/reply-audit.ts awakeHours)
//   reddit        someone on a watched subreddit asked for hibachi / a private
//                 chef in the last day and nobody has marked it handled
// `key` is stable per event so the app can dedupe / snooze; `ring` says
// whether it should make noise. Same rules as lead-watch, minus its side
// effects.

const LEAD_LOOKBACK_MS = 24 * 3600_000
/** A text from a number with no lead (spam, platform notifications) drops off after a day... */
const SMS_LOOKBACK_MS = 24 * 3600_000
/** ...a customer's text stays until someone answers it or marks it 不用回 (2026-10-07: it used to vanish after a day). */
const SMS_CUSTOMER_LOOKBACK_MS = 7 * 24 * 3600_000
/** Our newest text to a number still has no delivery receipt after this long = it did not arrive. */
const UNDELIVERED_AFTER_MS = 30 * 60_000
const SMS_GRACE_MS = 2 * 60_000
/** Older than this is still counted, but the phone does not ring for it (no burst of stale alerts on install). */
const MAX_EVENT_AGE_MIN = 180
const DEPOSIT_LOOKBACK_MS = 2 * 3600_000
/** A chef's text rings from here on (owner 2026-11-11); before that it is a quiet line, like a customer's first minutes. */
export const CHEF_RING_AFTER_MIN = 15
const PLANNER_LIVE_MS = 3 * 60_000
const EMAIL_LOOKBACK_MS = 7 * 24 * 3600_000
const FORM_LOOKBACK_MS = 7 * 24 * 3600_000

export type InboxEvent = {
  key: string
  kind: "lead" | "call" | "sms" | "email" | "form" | "deposit" | "order_change" | "reddit" | "party_contact" | "audit" | "undelivered" | "call_summary" | "chef" | "chef_notice"
  title: string
  body: string
  url: string
  at: string
  waitedMinutes: number
  ring: boolean
  /**
   * Unanswered 15+ minutes (2026-09-27 audit: p90 reply time was 103 min, and
   * the 17:00-19:00 dinner-planning hour was our slowest). The app nags louder
   * for these; lead-watch re-notifies them every 10 minutes instead of two hours.
   */
  urgent?: boolean
  /**
   * Inside the grace window - the customer may still be typing the rest of it.
   * Only ever set when the caller asked for these (the desk does); the phone
   * never sees them, which is the whole point of the grace.
   */
  justArrived?: boolean
  /**
   * The body is our account of what is open (what changed, who has not
   * confirmed), not a message someone sent: the desk prints it on the card.
   */
  explain?: boolean
  /** The lead / phone / order behind the event, so a card can be built without re-parsing `url`. */
  leadId?: string | null
  phone?: string | null
  orderId?: string | null
}

export type InboxOptions = {
  /**
   * Include texts younger than the grace window, flagged `justArrived`. The
   * phone must not (a buzz per line while someone types three lines is the
   * thing the grace exists to stop); a person reading the desk must, or a
   * message is invisible to them for two minutes - which is how 951-629-7007
   * reached the owner before it reached the desk on 2026-09-30.
   */
  includeFresh?: boolean
  /** How far back an unanswered text from a known customer still counts (default a week; numbers with no lead: a day). */
  smsLookbackMs?: number
  /** Skip the 60-second Twilio cache; the desk polls on demand and wants the truth. */
  noCache?: boolean
}

export type InboxCounts = {
  unreplied: number
  /** Customer emails (support@, via the Gmail script) newer than our last reply to that lead. */
  emailNew: number
  /** Website forms (Book Now, planner claim, contact form) newer than anything we sent that lead. */
  formNew: number
  /** Booked parties inside 48h whose customer has not answered the pre-party confirmation text (lead-watch). */
  unreachedParties: number
  /** Open customer messages the inbox rules did not show - the content-blind check in lib/reply-audit.ts. */
  silenced: number
  /** Customers whose texts from us never got a delivery receipt. */
  undelivered: number
  newLeads: number
  changedOrders: number
  plannerLive: number
  redditNew: number
  /** 【来电小结】 notes from the last few hours (lib/call-summary.ts), shown as notifications. */
  callSummaries: number
  /** Staff texts nobody answered ([chef]): a chef waiting on us. */
  chefTexts: number
  /** Chefs who have not confirmed a change notice (two hours on, or inside three hours of the party). */
  chefNotices: number
  /** Orders with a change filed within 48 hours of the party that nobody has confirmed yet. */
  heldChanges: number
}

const URGENT_MIN = 15
const MAIL_KEYS = ["subject", "snippet"] as const

// The 555 exchange is never assigned to real subscribers; our own tests use it.
const isTestNumber = (e164: string | null) => !e164 || /^\+1\d{3}555\d{4}$/.test(e164)
const minutesSince = (iso: string, now: number) => Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
// A customer text that only says thanks / ok / paid needs no answer, so it
// must not ring a phone every 15 minutes. The rule lives in
// lib/courtesy-text.ts so the lead-watch sweep applies exactly the same one.

const SOURCE_LABELS: Record<string, string> = {
  landing_inline: "落地页",
  landing_contact: "落地页",
  quote_unlock: "报价页",
  planner_unlock: "Planner",
  contact_form: "联系表单",
  manual_facebook: "Facebook",
  ai_agent: "AI 代理",
}

export async function computeInbox(
  supabase: SupabaseClient,
  now = Date.now(),
  opts: InboxOptions = {},
): Promise<{ counts: InboxCounts; events: InboxEvent[] }> {
  const events: InboxEvent[] = []
  // 挂起中的客人不响手机：他说了他会回头找我们，这不是我们欠回复。
  // 同一份规则巡检也在用（lib/lead-hold.ts）。
  const quiet = await loadQuiet(supabase, now)
  // A chef answering a prep sheet is not a customer waiting (Gary's "好的",
  // 2026-10-13): staff numbers never show as customers, same as our 555 test
  // numbers. Since 2026-11-11 they have a list of their own, further down.
  const staffContacts = await loadStaffContacts(supabase)
  const staff = new Set(staffContacts.map((c) => c.digits).filter(Boolean))
  const notCustomer = (e164: string | null) => isTestNumber(e164) || isStaffNumber(staff, e164)

  // ---- new leads nobody answered ------------------------------------------
  const { data: leads } = await supabase
    .from("leads")
    .select("id, created_at, full_name, phone, lead_source, city_or_zip, guest_count, latest_message, sms_blocked_reason")
    .eq("status", "new")
    .gte("created_at", new Date(now - LEAD_LOOKBACK_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(40)
  const leadRows = (leads ?? []) as Array<{ id: string; created_at: string; full_name: string | null; phone: string | null; lead_source: string | null; city_or_zip: string | null; guest_count: number | null; latest_message: string | null; sms_blocked_reason: string | null }>
  const leadIds = leadRows.map((l) => l.id)
  const { data: responded } = leadIds.length
    ? await supabase.from("lead_touchpoints").select("lead_id").in("lead_id", leadIds).eq("touchpoint_type", "agent_first_response")
    : { data: [] as Array<{ lead_id: string }> }
  const answered = new Set((responded ?? []).map((t) => t.lead_id))
  let newLeadsTotal = 0
  for (const l of leadRows) {
    if (answered.has(l.id)) continue
    const phone = toE164(l.phone)
    if (notCustomer(phone)) continue
    if (quiet.quiet(l.phone, Date.parse(l.created_at))) continue
    newLeadsTotal += 1
    if (minutesSince(l.created_at, now) > MAX_EVENT_AGE_MIN) continue
    const name = (l.full_name ?? "").trim() || (phone ? prettyPhone(phone) : "新询盘")
    // Lookup said landline / fixed VoIP before the first text: the quote went
    // by email and every follow-up has to as well (lib/phone-line-type.ts).
    const landline = isLookupBlock(l.sms_blocked_reason) ? "☎ 座机，短信发不了，报价已邮件发出，跟进走邮件" : null
    const bits = [l.guest_count ? `${l.guest_count} 人` : null, l.city_or_zip, SOURCE_LABELS[l.lead_source ?? ""] ?? null, landline].filter(Boolean)
    // A lead the voice line created from an inbound call already rang the
    // owner's phone; a second ring two minutes later is noise, so it lands
    // on the quiet channel as "call" and just asks for a follow-up.
    const fromCall = /^inbound phone call/i.test(l.latest_message ?? "") || /call|phone_inbound/i.test(l.lead_source ?? "")
    events.push({
      key: `lead:${l.id}`,
      kind: fromCall ? "call" : "lead",
      title: fromCall ? `来电待跟进 · ${name}` : `新询盘 · ${name}`,
      body: bits.join(" · ") || (fromCall ? "打过来的电话，还没有记录跟进" : (l.latest_message ?? "").slice(0, 60) || "还没有人回"),
      url: `/admin?tab=leads&lead=${l.id}`,
      at: l.created_at,
      waitedMinutes: minutesSince(l.created_at, now),
      ring: !fromCall,
      urgent: minutesSince(l.created_at, now) >= URGENT_MIN,
      leadId: l.id,
      phone,
    })
  }

  // ---- customer texts nobody answered ---------------------------------------
  // The phone polls every 10 s and is happy with the 60-second cache; the desk
  // asks on demand, usually right after the owner says "anything new?", and a
  // cached answer there is a blind spot rather than a saving.
  const byPeer = await fetchLastByPeer(800, opts.noCache ? 0 : undefined).catch(() => new Map())
  let unanswered: Array<{ peer: string; at: string; body: string }> = []
  const smsLookback = opts.smsLookbackMs ?? SMS_CUSTOMER_LOOKBACK_MS
  for (const [peer, v] of byPeer) {
    if (!v.lastInAt || v.last.direction !== "inbound") continue
    if (v.lastOutAt && v.lastOutAt >= v.lastInAt) continue
    // Judge the newest inbound that says something, not a reaction or a
    // "thanks" that followed it: "Loved …" 30 s after three patio photos hid
    // the photos for two days (909-268-7235, 2026-10-05). A photo has no
    // body, and an empty body must not read as courtesy.
    const real = v.lastRealIn && (!v.lastOutAt || v.lastRealIn.at > v.lastOutAt) ? v.lastRealIn : null
    const judged = real ?? { at: v.lastInAt, body: v.last.body, media: v.last.media }
    const atMs = Date.parse(judged.at)
    if (now - atMs > smsLookback) continue
    if (now - atMs < SMS_GRACE_MS && !opts.includeFresh) continue
    if (notCustomer(peer)) continue
    const body = (judged.body ?? "").trim()
    // 一条规则管三件事：挂起中、老板标过「不用回」、这条本来就不是问题（点赞
    // 回执 / STOP / 光道谢）。见 lib/lead-hold.ts loadQuiet。
    if (quiet.quiet(peer, atMs, judged.media > 0 ? undefined : body)) continue
    unanswered.push({ peer, at: judged.at, body: body || (judged.media > 0 ? `[${judged.media} 张图片]` : "") })
  }
  // Past a day, only numbers we know as customers stay: spam and platform
  // notifications have no lead (the inbound webhook files every customer text on one).
  const stale = unanswered.filter((u) => now - Date.parse(u.at) > SMS_LOOKBACK_MS)
  if (stale.length) {
    const known = await leadsByPhones(supabase, stale.map((u) => u.peer))
    unanswered = unanswered.filter((u) => now - Date.parse(u.at) <= SMS_LOOKBACK_MS || (known.get(u.peer) && known.get(u.peer)!.status !== "disqualified"))
  }
  const unrepliedTotal = unanswered.length
  if (unanswered.length) {
    // Name the customer when we know them: recent leads, matched by number.
    const { data: known } = await supabase
      .from("leads")
      .select("id, full_name, phone, created_at")
      .not("phone", "is", null)
      .gte("created_at", new Date(now - 90 * 86400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(600)
    const byPhone = new Map<string, { id: string; full_name: string | null }>()
    for (const k of (known ?? []) as Array<{ id: string; full_name: string | null; phone: string | null }>) {
      const p = toE164(k.phone)
      if (p && !byPhone.has(p)) byPhone.set(p, k)
    }
    for (const u of unanswered) {
      const lead = byPhone.get(u.peer)
      const who = (lead?.full_name ?? "").trim() || prettyPhone(u.peer)
      const waited = minutesSince(u.at, now)
      // Older ones are listed silently instead of dropped: a count of "1 待回"
      // with nothing to tap on was the phone's own mystery (2026-09-22).
      const hours = Math.floor(waited / 60)
      events.push({
        key: `sms:${u.peer}:${u.at}`,
        kind: "sms",
        title: `${who} 等了 ${waited > MAX_EVENT_AGE_MIN ? `${hours} 小时` : `${waited} 分钟`}`,
        body: u.body.slice(0, 60) || "（图片或空消息）",
        url: lead ? `/admin?tab=leads&lead=${lead.id}` : "/admin?tab=leads&filter=unreplied",
        at: u.at,
        waitedMinutes: waited,
        ring: shouldRing(waited, now),
        urgent: waited >= URGENT_MIN,
        justArrived: now - Date.parse(u.at) < SMS_GRACE_MS,
        leadId: lead?.id ?? null,
        phone: u.peer,
      })
    }
  }

  // ---- staff texts nobody answered (2026-11-11, D-1111-03) ---------------------
  // A chef asking for a fresh prep sheet sat 18 hours with every staff number
  // filtered out of this list. His texts are read by their own rule
  // (lib/chef-inbound.ts): a "1" confirms a change notice and never shows, a
  // bare 好的 / 收到 shows only while a notice of his is still unconfirmed, and
  // anything else is a chef waiting on us - until we text him back, or someone
  // marks the thread handled (chef:ack:<number> in lead_watch_notified).
  const noticeGroups = await loadOpenNoticeGroups(supabase)
  const chefHandled = new Map<string, number>()
  {
    const { data: marks } = await supabase.from("lead_watch_notified").select("key, notified_at").like("key", "chef:ack:%").limit(200)
    for (const r of (marks ?? []) as Array<{ key: string; notified_at: string }>) {
      const at = Date.parse(r.notified_at)
      if (Number.isFinite(at)) chefHandled.set(r.key.slice("chef:ack:".length), at)
    }
  }
  let chefTexts = 0
  for (const [peer, v] of byPeer) {
    if (isTestNumber(peer) || !isStaffNumber(staff, peer)) continue
    const who = staffOnNumber(staffContacts, peer)
    const pending = noticeGroups.filter((g) => who.some((s) => s.id === g.staffId)).map((g) => Date.parse(g.oldestSentAt))
    const open = openChefText(v, pending.length ? Math.min(...pending) : null, chefHandled.get(peer.replace(/\D/g, "").slice(-10)) ?? null)
    if (!open) continue
    const atMs = Date.parse(open.at)
    if (now - atMs > smsLookback) continue
    if (now - atMs < SMS_GRACE_MS && !opts.includeFresh) continue
    chefTexts += 1
    const waited = minutesSince(open.at, now)
    const name = who[0]?.name ?? prettyPhone(peer)
    const said = open.body.trim()
    events.push({
      key: `chef:${peer}:${open.at}`,
      kind: "chef",
      title: `${who[0]?.role === "logistics" ? "后勤" : "师傅"} ${name} 等了 ${waited > MAX_EVENT_AGE_MIN ? `${Math.floor(waited / 60)} 小时` : `${waited} 分钟`}`,
      body: open.ackOnly
        ? `回了「${said.slice(0, 20)}」，没回 1：他还有改动没确认，算不算确认要人定`
        : said.slice(0, 80) || (open.media > 0 ? `[${open.media} 张图片]` : "（空消息）"),
      // Opens the staff dialog on its 短信 page: the thread, a reply box, and 不用回.
      url: who[0] ? `/admin?tab=chefs&chef=${who[0].id}&ctab=sms` : "/admin?tab=chefs",
      at: open.at,
      waitedMinutes: waited,
      ring: waited >= CHEF_RING_AFTER_MIN && awakeHours(now) && shouldRing(waited, now),
      urgent: waited >= CHEF_RING_AFTER_MIN,
      justArrived: now - atMs < SMS_GRACE_MS,
      ...(open.ackOnly ? { explain: true } : {}),
      phone: peer,
    })
  }

  // ---- change notices a chef has not confirmed (lib/chef-notices.ts) -----------
  // Listed two hours after the text went with no "1"; inside three hours of the
  // party it rings here and lead-watch calls the owner's App. Gone the moment
  // the chef replies 1 or a person marks it confirmed. No table yet = no rows.
  let chefNotices = 0
  if (noticeGroups.length) {
    const noticeOrders = await loadNoticeOrders(supabase, noticeGroups.map((g) => g.orderId)).catch(() => new Map<string, NoticeOrder>())
    const staffById = new Map(staffContacts.map((s) => [s.id, s]))
    for (const g of noticeGroups) {
      const o = noticeOrders.get(g.orderId)
      const st = noticeState(g, o, now)
      if (!o || !st.show) continue
      chefNotices += 1
      const who = staffById.get(g.staffId)
      const waited = st.waitedMinutes
      const left =
        st.hoursToParty === null
          ? null
          : st.hoursToParty > 0
            ? `离开场 ${st.hoursToParty < 1 ? `${Math.max(1, Math.round(st.hoursToParty * 60))} 分钟` : `${Math.round(st.hoursToParty)} 小时`}`
            : "已经开场"
      events.push({
        key: `chef-notice:${g.orderId}:${g.staffId}`,
        kind: "chef_notice",
        title: `师傅没确认改动 · ${who?.name ?? "师傅"}`,
        body: [partyLabelZh(o), st.urgent ? left : null, noticeSummary(g) || `${g.notices.length} 条改动`, `发出 ${waited >= 120 ? `${Math.floor(waited / 60)} 小时` : `${waited} 分钟`}没回 1`]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 260),
        url: `/admin?tab=orders&order=${g.orderId}`,
        at: new Date(Date.parse(g.oldestSentAt)).toISOString(),
        waitedMinutes: waited,
        ring: st.urgent && awakeHours(now),
        urgent: st.urgent,
        explain: true,
        orderId: g.orderId,
        phone: toE164(who?.phone ?? null),
      })
    }
  }

  // ---- deposits that just landed --------------------------------------------
  const { data: paid } = await supabase
    .from("payments")
    .select("id, order_id, amount_cents, paid_at")
    .eq("type", "deposit")
    .gte("paid_at", new Date(now - DEPOSIT_LOOKBACK_MS).toISOString())
    .order("paid_at", { ascending: false })
    .limit(20)
  const payRows = (paid ?? []) as Array<{ id: string; order_id: string | null; amount_cents: number | null; paid_at: string }>
  // Every open change request, however old (2026-11-11): the 24-hour window
  // this used to have is how twelve of them fell off the list unhandled.
  // lib/change-requests.ts decides which still belong here. The phone polls
  // this every 10 seconds, so the first read is the small columns only (and
  // leaves out old rows tied to no order, which can never show); what changed
  // and what the customer wrote are fetched below for the few rows that do.
  const { data: changes } = await supabase
    .from("invoice_update_requests")
    .select("id, order_id, external_order_id, request_source, status, customer_name, created_at")
    .in("status", [...OPEN_REQUEST_STATUSES])
    .or(`order_id.not.is.null,external_order_id.not.is.null,created_at.gte.${new Date(now - ORPHAN_REQUEST_LOOKBACK_MS).toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(100)
  type ChangeRow = { id: string; order_id: string | null; external_order_id: string | null; request_source: string | null; status: string; customer_name: string | null; customer_message: string | null; change_summary: unknown; created_at: string }
  const changeRows = ((changes ?? []) as Array<Omit<ChangeRow, "customer_message" | "change_summary">>).map((c) => ({ ...c, customer_message: null, change_summary: null }) as ChangeRow)
  type InboxOrder = { id: string; order_no: string | null; customer_name: string | null; customer_phone: string | null; event_start: string | null; order_status: string | null; source_ref: string | null }
  const INBOX_ORDER_COLUMNS = "id, order_no, customer_name, customer_phone, event_start, order_status, source_ref"
  const orderIds = Array.from(new Set([...payRows.map((p) => p.order_id), ...changeRows.map((c) => c.order_id)].filter((x): x is string => Boolean(x))))
  const { data: orders } = orderIds.length ? await supabase.from("orders").select(INBOX_ORDER_COLUMNS).in("id", orderIds) : { data: [] as InboxOrder[] }
  const orderById = new Map(((orders ?? []) as InboxOrder[]).map((o) => [o.id, o]))
  // A request filed by the website's own reference hangs on its order through source_ref.
  const changeRefs = Array.from(new Set(changeRows.filter((c) => !c.order_id && c.external_order_id).map((c) => c.external_order_id as string)))
  const orderByRef = new Map<string, InboxOrder>()
  if (changeRefs.length) {
    const { data: byRef } = await supabase.from("orders").select(INBOX_ORDER_COLUMNS).in("source_ref", changeRefs)
    for (const o of (byRef ?? []) as InboxOrder[]) if (o.source_ref) orderByRef.set(o.source_ref, o)
  }
  const orderOfChange = (c: ChangeRow): InboxOrder | null => (c.order_id ? orderById.get(c.order_id) : c.external_order_id ? orderByRef.get(c.external_order_id) : undefined) ?? null
  for (const p of payRows) {
    const o = p.order_id ? orderById.get(p.order_id) : undefined
    events.push({
      key: `deposit:${p.id}`,
      kind: "deposit",
      title: `押金到账 · ${o?.customer_name ?? "客户"}`,
      body: [o?.order_no, p.amount_cents ? money(p.amount_cents) : null].filter(Boolean).join(" · "),
      url: p.order_id ? `/admin?tab=orders&order=${p.order_id}` : "/admin?tab=orders",
      at: p.paid_at,
      waitedMinutes: minutesSince(p.paid_at, now),
      ring: false,
      orderId: p.order_id,
      phone: toE164(o?.customer_phone ?? null),
    })
  }
  // ---- dates locked with a card on file (2026-10-08) ---------------------------
  // Since 10-06 a date is locked by saving a card ($0, D-1006-04): the order is
  // created paid_verified but no payment row is written, so the deposit list
  // above never saw a lock and the phone went quiet on new bookings (Craig 10-06,
  // Tonia 10-08). Same notification as a deposit used to be: once, quiet channel.
  const paidOrderIds = new Set(payRows.map((p) => p.order_id).filter(Boolean))
  const { data: locks } = await supabase
    .from("orders")
    .select("id, order_no, customer_name, customer_phone, created_at, event_start, guest_adult_count, guest_child_count")
    .eq("deposit_status", "paid_verified")
    .gte("created_at", new Date(now - DEPOSIT_LOOKBACK_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(20)
  type LockRow = { id: string; order_no: string | null; customer_name: string | null; customer_phone: string | null; created_at: string; event_start: string | null; guest_adult_count: number | null; guest_child_count: number | null }
  for (const o of (locks ?? []) as LockRow[]) {
    if (paidOrderIds.has(o.id)) continue
    const when = o.event_start ? `${shortDate(o.event_start.slice(0, 10))} ${wallTime(o.event_start)}` : null
    const guests = o.guest_adult_count ? `${o.guest_adult_count} 大${o.guest_child_count ? ` ${o.guest_child_count} 小` : ""}` : null
    events.push({
      key: `lock:${o.id}`,
      kind: "deposit",
      title: `锁日期 · ${(o.customer_name ?? "").trim() || "客户"}`,
      body: [o.order_no, when, guests, "留卡，没扣钱"].filter(Boolean).join(" · "),
      url: `/admin?tab=orders&order=${o.id}`,
      at: o.created_at,
      waitedMinutes: minutesSince(o.created_at, now),
      ring: false,
      orderId: o.id,
      phone: toE164(o.customer_phone ?? null),
    })
  }
  // One line per order, not per submit: a customer who saves the party page
  // three times is one thing to handle (the order dialog merges them the same
  // way). A change held inside 48 hours that nobody has confirmed rings - until
  // 2026-11-11 it was a quiet line for a day and then nothing at all.
  const changeGroups = new Map<string, { order: InboxOrder | null; rows: ChangeRow[] }>()
  for (const c of changeRows) {
    const o = orderOfChange(c)
    if (!changeRequestOpen(c, o, now)) continue
    const key = o?.id ?? `req:${c.id}`
    const g = changeGroups.get(key) ?? { order: o, rows: [] }
    g.rows.push(c)
    changeGroups.set(key, g)
  }
  const shownChangeIds = Array.from(changeGroups.values()).flatMap((g) => g.rows.map((r) => r.id))
  if (shownChangeIds.length) {
    const { data: details } = await supabase.from("invoice_update_requests").select("id, change_summary, customer_message").in("id", shownChangeIds)
    const detailById = new Map(((details ?? []) as Array<{ id: string; change_summary: unknown; customer_message: string | null }>).map((d) => [d.id, d]))
    for (const g of changeGroups.values()) {
      for (const r of g.rows) {
        const d = detailById.get(r.id)
        if (d) Object.assign(r, { change_summary: d.change_summary, customer_message: d.customer_message })
      }
    }
  }
  let heldChanges = 0
  for (const g of changeGroups.values()) {
    const rows = g.rows.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
    const newest = rows[rows.length - 1]
    const o = g.order
    const heldWaiting = rows.filter((r) => isHeldRequest(r) && r.status === "received")
    const since = (heldWaiting[0] ?? rows[0]).created_at
    const waited = minutesSince(since, now)
    if (heldWaiting.length) heldChanges += 1
    const hoursLeft = o?.event_start ? Math.round((wallToInstant(o.event_start) - now) / 3600_000) : null
    const when = o?.event_start
      ? `${shortDate(o.event_start.slice(0, 10))} ${wallTime(o.event_start)}${hoursLeft === null || !Number.isFinite(hoursLeft) ? "" : hoursLeft > 0 ? `（还有 ${hoursLeft} 小时）` : "（已到开场时间）"}`
      : null
    const state = heldWaiting.length
      ? "48 小时内提交，确认后才写进订单"
      : rows.every((r) => r.status === "confirmed_in_progress")
        ? "已核对，还没通知师傅"
        : null
    events.push({
      key: `change:${newest.id}`,
      kind: "order_change",
      title: `${heldWaiting.length ? "改单等确认" : "客户改单"} · ${newest.customer_name ?? o?.customer_name ?? "客户"}`,
      body: [o?.order_no, when, state, changeRequestBody(rows) || "有改动请求等确认", rows.length > 1 ? `共 ${rows.length} 次提交` : null]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 300),
      url: o ? `/admin?tab=orders&order=${o.id}` : "/admin?tab=orders&filter=changed",
      at: since,
      waitedMinutes: waited,
      ring: heldWaiting.length > 0 && changeRequestRings(heldWaiting[0], waited, now),
      urgent: heldWaiting.length > 0,
      explain: true,
      orderId: o?.id ?? null,
      phone: toE164(o?.customer_phone ?? null),
    })
  }

  // ---- reddit: a direct ask on a watched subreddit ---------------------------
  // Only tier 1 (hibachi / private chef asked outright) reaches the phone; the
  // adjacent tier stays on the desktop panel. Rings while fresh, then it is a
  // quiet line like everything else older than MAX_EVENT_AGE_MIN.
  const { data: redditHits } = await supabase
    .from("reddit_mentions")
    .select("id, subreddit, title, found_at, posted_at")
    .eq("status", "new")
    .eq("tier", 1)
    .gte("found_at", new Date(now - LEAD_LOOKBACK_MS).toISOString())
    .order("found_at", { ascending: false })
    .limit(10)
  const redditRows = (redditHits ?? []) as Array<{ id: string; subreddit: string; title: string; found_at: string; posted_at: string }>
  for (const r of redditRows) {
    const waited = minutesSince(r.found_at, now)
    events.push({
      key: `reddit:${r.id}`,
      kind: "reddit",
      title: r.subreddit === "facebook" ? "Facebook 有人在问" : `Reddit 有人在问 · r/${r.subreddit}`,
      body: r.title.slice(0, 60),
      url: "/admin?tab=leads",
      at: r.found_at,
      waitedMinutes: waited,
      ring: waited <= MAX_EVENT_AGE_MIN,
    })
  }

  // ---- planner: is anyone in there right now --------------------------------
  const { data: live } = await supabase.from("planner_events").select("sid").gte("created_at", new Date(now - PLANNER_LIVE_MS).toISOString()).limit(500)
  const plannerLive = new Set(((live ?? []) as Array<{ sid: string | null }>).map((r) => r.sid).filter(Boolean)).size

  // ---- customer emails nobody answered ----------------------------------------
  // support@ mail is filed on the lead by /api/admin/email-inbound (Gmail
  // script, 2026-10-07). An inbound newer than anything we sent that lead -
  // an email from the desk, a text, or a reply on Yelp or Facebook - is
  // waiting, under the same hold / "no reply needed" rules as a text.
  const emailSince = new Date(now - EMAIL_LOOKBACK_MS).toISOString()
  const { data: mailRows } = await supabase
    .from("lead_touchpoints")
    .select(`lead_id, touchpoint_type, occurred_at, ${payloadColumns(MAIL_KEYS)}`)
    .in("touchpoint_type", ["email_inbound", "email_outbound", "sms_outbound", CHANNEL_OUT])
    .gte("occurred_at", emailSince)
    .order("occurred_at", { ascending: false })
    .limit(400)
  const mailByLead = new Map<string, { lastIn: { at: string; subject: string; snippet: string } | null; lastOutAt: string | null }>()
  for (const r of (mailRows ?? []) as unknown as Array<Record<string, unknown> & { lead_id: string; touchpoint_type: string; occurred_at: string }>) {
    const m = mailByLead.get(r.lead_id) ?? { lastIn: null, lastOutAt: null }
    if (r.touchpoint_type === "email_inbound") {
      const p = payloadFrom(r, MAIL_KEYS)
      if (!m.lastIn) m.lastIn = { at: r.occurred_at, subject: String(p.subject ?? ""), snippet: String(p.snippet ?? "") }
    } else if (!m.lastOutAt) m.lastOutAt = r.occurred_at
    mailByLead.set(r.lead_id, m)
  }
  const mailWaiting = Array.from(mailByLead).filter(([, m]) => m.lastIn && (!m.lastOutAt || m.lastOutAt < m.lastIn.at))
  let emailNew = 0
  if (mailWaiting.length) {
    const { data: mailLeads } = await supabase
      .from("leads")
      .select("id, full_name, phone, email, acked_until, hold_until")
      .in("id", mailWaiting.map(([id]) => id))
    type MailLead = { id: string; full_name: string | null; phone: string | null; email: string | null; acked_until: string | null; hold_until: string | null }
    const leadById = new Map(((mailLeads ?? []) as MailLead[]).map((l) => [l.id, l]))
    for (const [leadId, m] of mailWaiting) {
      const l = leadById.get(leadId)
      const atMs = Date.parse(m.lastIn!.at)
      if (quiet.quiet(l?.phone ?? null, atMs)) continue
      // Email-only leads have no phone for the quiet lookup, so apply the same
      // watermark and hold by lead: "不用回" up to acked_until, held = silent.
      if (l?.acked_until && Date.parse(l.acked_until) >= atMs) continue
      if (l?.hold_until && Date.parse(l.hold_until) > now) continue
      emailNew += 1
      const waited = minutesSince(m.lastIn!.at, now)
      const who = (l?.full_name ?? "").trim() || l?.email || "邮件"
      events.push({
        key: `email:${leadId}:${m.lastIn!.at}`,
        kind: "email",
        title: `${who} 来邮件 等了 ${waited > MAX_EVENT_AGE_MIN ? `${Math.floor(waited / 60)} 小时` : `${waited} 分钟`}`,
        body: `${m.lastIn!.subject} — ${m.lastIn!.snippet}`.slice(0, 80),
        url: `/admin?tab=leads&lead=${leadId}`,
        at: m.lastIn!.at,
        waitedMinutes: waited,
        ring: shouldRing(waited, now),
        urgent: waited >= URGENT_MIN,
        leadId,
        phone: toE164(l?.phone ?? null),
      })
    }
  }

  // ---- customers who answered through the website -----------------------------
  // "Book Now" on the quote page, a claimed planner party, a second contact
  // form: the customer talking back (lib/customer-forms.ts). Newer than
  // anything we sent that lead - a text on the 213 line, an email - and after
  // our first response (the first form is the lead itself, listed above) =
  // waiting, under the same hold / "no reply needed" rules.
  const formSince = new Date(now - FORM_LOOKBACK_MS).toISOString()
  // Forms carry their payload (a few dozen a week); what we sent needs only its
  // time. One query for both pulled every outbound text's whole Twilio payload
  // each poll - egress that got the project stopped on 2026-10-13.
  type FormRow = { lead_id: string; touchpoint_type: string; occurred_at: string; raw_payload_json: Record<string, unknown> | null }
  const [{ data: formOnly }, { data: sentOnly }] = await Promise.all([
    supabase
      .from("lead_touchpoints")
      .select("lead_id, touchpoint_type, occurred_at, raw_payload_json")
      .in("touchpoint_type", [...CUSTOMER_FORM_TYPES])
      .gte("occurred_at", formSince)
      .order("occurred_at", { ascending: false })
      .limit(400),
    supabase
      .from("lead_touchpoints")
      .select("lead_id, touchpoint_type, occurred_at")
      .in("touchpoint_type", ["sms_outbound", "email_outbound"])
      .gte("occurred_at", formSince)
      .order("occurred_at", { ascending: false })
      .limit(1000),
  ])
  const formRows: FormRow[] = [
    ...((formOnly ?? []) as FormRow[]),
    ...((sentOnly ?? []) as Array<Omit<FormRow, "raw_payload_json">>).map((r) => ({ ...r, raw_payload_json: null })),
  ].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
  const formByLead = new Map<string, { lastForm: FormRow | null; lastOutAt: string | null }>()
  for (const r of formRows) {
    const m = formByLead.get(r.lead_id) ?? { lastForm: null, lastOutAt: null }
    if ((CUSTOMER_FORM_TYPES as readonly string[]).includes(r.touchpoint_type)) {
      if (!m.lastForm) m.lastForm = r
    } else if (!m.lastOutAt) m.lastOutAt = r.occurred_at
    formByLead.set(r.lead_id, m)
  }
  const formCandidates = Array.from(formByLead).filter(([, m]) => m.lastForm && (!m.lastOutAt || m.lastOutAt < m.lastForm.occurred_at))
  let formNew = 0
  if (formCandidates.length) {
    const { data: formLeads } = await supabase
      .from("leads")
      .select("id, full_name, phone, email, status, acked_until, hold_until")
      .in("id", formCandidates.map(([id]) => id))
    type FormLead = { id: string; full_name: string | null; phone: string | null; email: string | null; status: string | null; acked_until: string | null; hold_until: string | null }
    const formLeadById = new Map(((formLeads ?? []) as FormLead[]).map((l) => [l.id, l]))
    // When we first answered each candidate. leads has no first_response_at
    // column (the desk computes it from touchpoints); selecting one that does
    // not exist made PostgREST return no rows at all, so from 10-07 to 10-19
    // no website reply ever reached this list and a second form only surfaced
    // through the 15-minute audit below (818-645's second landing form on
    // 2026-10-19 "waited 16 minutes"). Earliest of the first-response marker,
    // a text or an email, per lead.
    const firstReplyAt = new Map<string, string>()
    {
      const { data: firsts } = await supabase
        .from("lead_touchpoints")
        .select("lead_id, occurred_at")
        .in("lead_id", formCandidates.map(([id]) => id))
        .in("touchpoint_type", ["agent_first_response", "sms_outbound", "email_outbound"])
        .order("occurred_at", { ascending: true })
        .limit(2000)
      for (const r of (firsts ?? []) as Array<{ lead_id: string; occurred_at: string }>) {
        if (!firstReplyAt.has(r.lead_id)) firstReplyAt.set(r.lead_id, r.occurred_at)
      }
    }
    for (const [leadId, m] of formCandidates) {
      const l = formLeadById.get(leadId)
      const form = m.lastForm!
      // A booked customer re-quoting, or a lost one coming back, is talking to us too (2026-10-08).
      if (!l || l.status === "disqualified") continue
      // The form that created the lead is the lead (handled above); only a form after our first reply is a reply.
      const firstAt = firstReplyAt.get(leadId)
      if (!firstAt || form.occurred_at <= firstAt) continue
      const peer = toE164(l.phone)
      if (peer && notCustomer(peer)) continue
      // Twilio is the truth for texts: a text after the form answered it.
      const tw = peer ? byPeer.get(peer) : undefined
      if (tw?.lastOutAt && tw.lastOutAt >= form.occurred_at) continue
      const atMs = Date.parse(form.occurred_at)
      if (quiet.quiet(l.phone ?? null, atMs)) continue
      if (l.acked_until && Date.parse(l.acked_until) >= atMs) continue
      if (l.hold_until && Date.parse(l.hold_until) > now) continue
      formNew += 1
      const waited = minutesSince(form.occurred_at, now)
      const who = (l.full_name ?? "").trim() || (peer ? prettyPhone(peer) : l.email || "网站")
      events.push({
        key: `form:${leadId}:${form.occurred_at}`,
        kind: "form",
        title: `${who} 在网站回了 等了 ${waited > MAX_EVENT_AGE_MIN ? `${Math.floor(waited / 60)} 小时` : `${waited} 分钟`}`,
        body: `${FORM_LABELS[form.touchpoint_type] ?? form.touchpoint_type}：${formSummary(form.touchpoint_type, form.raw_payload_json)}`.slice(0, 100),
        url: `/admin?tab=leads&lead=${leadId}`,
        at: form.occurred_at,
        waitedMinutes: waited,
        ring: shouldRing(waited, now),
        urgent: waited >= URGENT_MIN,
        leadId,
        phone: peer,
      })
    }
  }

  // ---- booked parties nobody has reached (lead-watch pre-party contact) -------
  // lead-watch texts a booked customer 72h out; silence at 48h / the day
  // before leaves pcf:48 / pcf:24 in lead_watch_notified (pc:ok once they
  // answer), so this list and the sweep can never disagree. The day-before
  // one rings: the owner has to reach them by phone (owner 2026-10-07).
  const { data: pcMarks } = await supabase
    .from("lead_watch_notified")
    .select("key, notified_at")
    .or("key.like.pcf:%,key.like.pc:ok:%")
    .gte("notified_at", new Date(now - 7 * 86400_000).toISOString())
    .limit(200)
  const pcByOrder = new Map<string, { ok: boolean; flag24: string | null; flag48: string | null }>()
  for (const r of (pcMarks ?? []) as Array<{ key: string; notified_at: string }>) {
    const m = /^(?:pcf:(48|24)|pc:(ok)):(.+)$/.exec(r.key)
    if (!m) continue
    const id = m[3]
    const s = pcByOrder.get(id) ?? { ok: false, flag24: null, flag48: null }
    if (m[2] === "ok") s.ok = true
    else if (m[1] === "24") s.flag24 = r.notified_at
    else s.flag48 = r.notified_at
    pcByOrder.set(id, s)
  }
  const unreachedIds = Array.from(pcByOrder)
    .filter(([, s]) => !s.ok && (s.flag24 || s.flag48))
    .map(([id]) => id)
  let unreachedParties = 0
  if (unreachedIds.length) {
    const { data: pcOrders } = await supabase
      .from("orders")
      .select("id, order_no, customer_name, customer_phone, event_start")
      .in("id", unreachedIds)
      .eq("order_status", "active")
      .gte("event_start", instantToWallIso(now - 3 * 3600_000))
    for (const o of (pcOrders ?? []) as Array<{ id: string; order_no: string | null; customer_name: string | null; customer_phone: string | null; event_start: string }>) {
      const s = pcByOrder.get(o.id)
      if (!s) continue
      const dayBefore = Boolean(s.flag24)
      const since = s.flag48 ?? s.flag24!
      unreachedParties += 1
      const when = `${shortDate(o.event_start.slice(0, 10))} ${wallTime(o.event_start)}`
      events.push({
        key: `pc:${o.id}:${dayBefore ? "24" : "48"}`,
        kind: "party_contact",
        title: `派对前联系不上 · ${(o.customer_name ?? "").trim() || o.order_no || "客户"}`,
        body: dayBefore ? `${when} · 确认短信两条都没回，明天的派对，打电话` : `${when} · 72 小时前的确认短信没回`,
        url: `/admin?tab=orders&order=${o.id}`,
        at: since,
        waitedMinutes: minutesSince(since, now),
        ring: dayBefore,
        urgent: dayBefore,
        orderId: o.id,
        phone: toE164(o.customer_phone),
      })
    }
  }

  // ---- texts that never arrived (2026-10-07) -----------------------------------
  // Three texts to one lead sat at "sent" for a day - no delivery receipt, so
  // she never saw them - while every list counted her as answered. 874 of 880
  // texts in two weeks came back "delivered", so a number with none is a real
  // signal: email or call instead.
  const notDelivered: Array<{ peer: string; at: string; status: string }> = []
  for (const [peer, v] of byPeer) {
    if (!v.lastOutAt || v.deliveredOutAt || !v.lastOutStatus) continue
    if (!["sent", "undelivered", "failed"].includes(v.lastOutStatus)) continue
    const age = now - Date.parse(v.lastOutAt)
    if (age < UNDELIVERED_AFTER_MS || age > SMS_CUSTOMER_LOOKBACK_MS || notCustomer(peer)) continue
    notDelivered.push({ peer, at: v.lastOutAt, status: v.lastOutStatus })
  }
  let undelivered = 0
  if (notDelivered.length) {
    const known = await leadsByPhones(supabase, notDelivered.map((n) => n.peer))
    const ids = Array.from(new Set(Array.from(known.values()).map((l) => l.id)))
    const oldest = notDelivered.reduce((a, n) => (n.at < a ? n.at : a), notDelivered[0].at)
    const { data: mailed } = ids.length
      ? await supabase.from("lead_touchpoints").select("lead_id, occurred_at").in("lead_id", ids).eq("touchpoint_type", "email_outbound").gte("occurred_at", oldest)
      : { data: [] as Array<{ lead_id: string; occurred_at: string }> }
    const emailedAt = new Map<string, string>()
    for (const m of (mailed ?? []) as Array<{ lead_id: string; occurred_at: string }>) {
      const prev = emailedAt.get(m.lead_id)
      if (!prev || m.occurred_at > prev) emailedAt.set(m.lead_id, m.occurred_at)
    }
    for (const n of notDelivered) {
      const lead = known.get(n.peer)
      if (!lead || !undeliveredStillOpen(lead, n.at, emailedAt.get(lead.id) ?? null)) continue
      undelivered += 1
      const who = (lead.full_name ?? "").trim() || prettyPhone(n.peer)
      const blocked = Boolean(lead.sms_blocked_at)
      const waited = minutesSince(n.at, now)
      events.push({
        key: `undelivered:${n.peer}:${n.at}`,
        kind: "undelivered",
        title: blocked ? `短信打不通，改发邮件 · ${who}` : `短信没送达 · ${who}`,
        body: blocked
          ? `这个号码收不了短信（${lead.sms_blocked_reason ?? n.status}），${lead.email ? `留了邮箱 ${lead.email}，还没发过邮件` : "没留邮箱，只能打电话"}`
          : `给这个号码发的短信一直没有送达回执（最后一条 ${ptStamp(n.at)}，${n.status}），换邮件或打电话`,
        url: `/admin?tab=leads&lead=${lead.id}`,
        at: n.at,
        waitedMinutes: waited,
        ring: undeliveredRings(lead, now, waited),
        leadId: lead.id,
        phone: n.peer,
      })
    }
  }

  // ---- the content-blind check (lib/reply-audit.ts) ----------------------------
  // Every customer message on the timeline that needs an answer, 15+ minutes
  // old, nothing from us after it, not silenced by a person - and not on this
  // list already. Anything left is a blind spot of the rules above.
  let silenced = 0
  const shownLeads = new Set(events.map((e) => e.leadId).filter(Boolean))
  const shownPhones = new Set(events.map((e) => e.phone).filter(Boolean))
  for (const t of await findOpenTurns(supabase, now, byPeer, opts.noCache ? 0 : undefined).catch(() => [])) {
    const phone = toE164(t.lead.phone)
    if (phone && isStaffNumber(staff, phone)) continue
    if (shownLeads.has(t.lead.id) || (phone && shownPhones.has(phone))) continue
    silenced += 1
    const waited = minutesSince(t.first.at, now)
    const who = (t.lead.full_name ?? "").trim() || (phone ? prettyPhone(phone) : t.lead.email || "客人")
    const what =
      t.first.kind === "sms"
        ? `短信：${t.first.body.trim() || ""}${t.first.media ? ` [${t.first.media} 张图片]` : ""}`
        : t.first.kind === "email"
          ? `邮件：${t.first.body}`
          : `${FORM_LABELS[t.first.type] ?? t.first.type}`
    events.push({
      key: `audit:${t.lead.id}:${t.first.at}`,
      kind: "audit",
      title: `漏网 · ${who} 等了 ${waited > 120 ? `${Math.floor(waited / 60)} 小时` : `${waited} 分钟`}`,
      body: `${what}${t.count > 1 ? `（共 ${t.count} 条没回）` : ""}`.slice(0, 100),
      url: `/admin?tab=leads&lead=${t.lead.id}`,
      at: t.first.at,
      waitedMinutes: waited,
      ring: shouldRing(waited, now),
      urgent: true,
      leadId: t.lead.id,
      phone,
    })
  }

  // ---- call summaries (lib/call-summary.ts) ------------------------------------
  // The two-line 【来电小结】 the server files a few minutes after a call. Shown
  // for three hours so the owner sees what the call was about without reading
  // the captions (owner 2026-10-20). Quiet: a summary never rings.
  let callSummaries = 0
  {
    const since = new Date(now - 3 * 3600_000).toISOString()
    const { data: summaryRows } = await supabase
      .from("lead_touchpoints")
      .select("lead_id, occurred_at, raw_payload_json")
      .eq("touchpoint_type", "agent_note")
      .gte("occurred_at", since)
      .like("raw_payload_json->>note", "【来电小结】%")
      .order("occurred_at", { ascending: false })
      .limit(20)
    type SummaryRow = { lead_id: string; occurred_at: string; raw_payload_json: Record<string, unknown> | null }
    const latest = new Map<string, SummaryRow>()
    for (const r of (summaryRows ?? []) as SummaryRow[]) if (!latest.has(r.lead_id)) latest.set(r.lead_id, r)
    if (latest.size) {
      const { data: summaryLeads } = await supabase
        .from("leads")
        .select("id, full_name, phone")
        .in("id", Array.from(latest.keys()))
      const byId = new Map(((summaryLeads ?? []) as Array<{ id: string; full_name: string | null; phone: string | null }>).map((l) => [l.id, l]))
      for (const [leadId, r] of latest) {
        const l = byId.get(leadId)
        const phone = toE164(l?.phone ?? null)
        const who = (l?.full_name ?? "").trim() || (phone ? prettyPhone(phone) : "客人")
        const text = String(r.raw_payload_json?.note ?? "").replace("【来电小结】", "").trim()
        if (!text) continue
        callSummaries += 1
        events.push({
          key: `call-summary:${leadId}:${r.occurred_at}`,
          kind: "call_summary",
          title: `来电小结 · ${who}`,
          body: text.slice(0, 200),
          url: `/admin?tab=leads&lead=${leadId}`,
          at: r.occurred_at,
          waitedMinutes: minutesSince(r.occurred_at, now),
          ring: false,
          urgent: false,
          leadId,
          phone,
        })
      }
    }
  }

  // Chefs first (owner 2026-11-11: a chef's text must not queue behind the
  // customers), then whatever rings, then newest.
  const chefFirst = (e: InboxEvent) => (e.kind === "chef" || e.kind === "chef_notice" ? 0 : 1)
  events.sort((a, b) => chefFirst(a) - chefFirst(b) || (a.ring === b.ring ? b.at.localeCompare(a.at) : a.ring ? -1 : 1))
  return {
    counts: {
      unreplied: unrepliedTotal,
      silenced,
      undelivered,
      emailNew,
      formNew,
      unreachedParties,
      newLeads: newLeadsTotal,
      changedOrders: changeGroups.size,
      plannerLive,
      redditNew: redditRows.length,
      callSummaries,
      chefTexts,
      chefNotices,
      heldChanges,
    },
    events,
  }
}

/** The newest lead on each of these numbers (any age), by the 10-digit normalized_phone. */
type PhoneLead = {
  id: string
  full_name: string | null
  status: string | null
  email: string | null
  created_at: string | null
  sms_blocked_at: string | null
  sms_blocked_reason: string | null
}

async function leadsByPhones(supabase: SupabaseClient, peers: string[]): Promise<Map<string, PhoneLead>> {
  const digits = Array.from(new Set(peers.map((p) => p.replace(/\D/g, "").slice(-10)).filter((d) => d.length === 10)))
  const out = new Map<string, PhoneLead>()
  if (!digits.length) return out
  const { data } = await supabase
    .from("leads")
    .select("id, full_name, status, email, normalized_phone, created_at, sms_blocked_at, sms_blocked_reason")
    .in("normalized_phone", digits)
    .order("created_at", { ascending: false })
    .limit(500)
  for (const r of (data ?? []) as Array<PhoneLead & { normalized_phone: string | null }>) {
    const e164 = r.normalized_phone ? `+1${r.normalized_phone}` : null
    if (e164 && !out.has(e164)) {
      out.set(e164, {
        id: r.id,
        full_name: r.full_name,
        status: r.status,
        email: r.email,
        created_at: r.created_at,
        sms_blocked_at: r.sms_blocked_at,
        sms_blocked_reason: r.sms_blocked_reason,
      })
    }
  }
  return out
}

/**
 * Should a text that never arrived still be on the list?
 *
 * 30003 / 30006 (number off, landline) make twilio/sms-status block the number
 * and mark the lead lost, and lost leads used to be skipped here - so the one
 * lead that most needed an email vanished from every list. A planner customer
 * (14 adults, 10/29) sat 15 hours with no email after her "party saved" text
 * bounced (2026-10-12). Lost by that carrier block, with an email on file,
 * still shows; an opt-out (21610 / STOP) never does. Once an email has gone
 * out after the text, it is handled and drops off (Ash's sat there a day
 * after she was emailed).
 */
export function undeliveredStillOpen(
  lead: Pick<PhoneLead, "status" | "email" | "sms_blocked_at" | "sms_blocked_reason"> | null | undefined,
  lastOutAt: string,
  emailedAt: string | null,
): boolean {
  if (!lead || lead.status === "disqualified") return false
  const reason = lead.sms_blocked_reason ?? ""
  if (reason.startsWith("21610") || reason.startsWith(OPT_OUT_REASON_PREFIX)) return false
  if (lead.status === "lost" && !(lead.sms_blocked_at && (lead.email ?? "").trim())) return false
  if (emailedAt && Date.parse(emailedAt) >= Date.parse(lastOutAt)) return false
  return true
}

/**
 * Whether a text that never arrived rings the phone. A brand-new lead whose
 * only way in is email is a first response, not a data chore, so it rings
 * like a new lead does - but only when there is an email to send. With none
 * there is nothing left to do from the phone, and it stays on the list
 * quietly: 11-03 626-819 called, the owner's call back went unanswered, both
 * texts came back 30005, no email, and the app rang every 15 minutes for
 * three hours.
 */
export function undeliveredRings(
  lead: Pick<PhoneLead, "email" | "created_at">,
  nowMs: number,
  waitedMin: number,
): boolean {
  const fresh = Boolean(lead.created_at && nowMs - Date.parse(lead.created_at) < LEAD_LOOKBACK_MS)
  return fresh && Boolean((lead.email ?? "").trim()) && shouldRing(waitedMin, nowMs)
}

const PT_STAMP = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const ptStamp = (iso: string) => PT_STAMP.format(Date.parse(iso)).replace(",", "")
