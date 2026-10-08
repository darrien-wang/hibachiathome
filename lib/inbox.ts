import type { SupabaseClient } from "@supabase/supabase-js"
import { loadQuiet } from "@/lib/lead-hold"
import { instantToWallIso, shortDate, wallTime } from "@/lib/first-response"
import { fetchLastByPeer, prettyPhone, toE164 } from "@/lib/sms-thread"
import { CUSTOMER_FORM_TYPES, FORM_LABELS, formSummary } from "@/lib/customer-forms"
import { findOpenTurns, shouldRing } from "@/lib/reply-audit"

// 收件箱. "What needs a person right now", computed fresh each call and kept
// small. It started life inside /api/admin/mobile/inbox (the Android shell
// polls that every 10 s and turns events into notifications); the desk
// endpoint (/api/admin/desk) now builds its cards from the same list, so the
// phone, the desktop and the agent can never disagree on what is open.
//   lead          a new lead nobody (human or auto) has answered
//   sms           a customer text on the 213 line with no reply after it
//   deposit       a deposit that landed in the last two hours
//   order_change  a customer change request still open
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
const CHANGE_LOOKBACK_MS = 24 * 3600_000
const PLANNER_LIVE_MS = 3 * 60_000
const EMAIL_LOOKBACK_MS = 7 * 24 * 3600_000
const FORM_LOOKBACK_MS = 7 * 24 * 3600_000

export type InboxEvent = {
  key: string
  kind: "lead" | "call" | "sms" | "email" | "form" | "deposit" | "order_change" | "reddit" | "party_contact" | "audit" | "undelivered"
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
}

const URGENT_MIN = 15

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

  // ---- new leads nobody answered ------------------------------------------
  const { data: leads } = await supabase
    .from("leads")
    .select("id, created_at, full_name, phone, lead_source, city_or_zip, guest_count, latest_message")
    .eq("status", "new")
    .gte("created_at", new Date(now - LEAD_LOOKBACK_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(40)
  const leadRows = (leads ?? []) as Array<{ id: string; created_at: string; full_name: string | null; phone: string | null; lead_source: string | null; city_or_zip: string | null; guest_count: number | null; latest_message: string | null }>
  const leadIds = leadRows.map((l) => l.id)
  const { data: responded } = leadIds.length
    ? await supabase.from("lead_touchpoints").select("lead_id").in("lead_id", leadIds).eq("touchpoint_type", "agent_first_response")
    : { data: [] as Array<{ lead_id: string }> }
  const answered = new Set((responded ?? []).map((t) => t.lead_id))
  let newLeadsTotal = 0
  for (const l of leadRows) {
    if (answered.has(l.id)) continue
    const phone = toE164(l.phone)
    if (isTestNumber(phone)) continue
    if (quiet.quiet(l.phone, Date.parse(l.created_at))) continue
    newLeadsTotal += 1
    if (minutesSince(l.created_at, now) > MAX_EVENT_AGE_MIN) continue
    const name = (l.full_name ?? "").trim() || (phone ? prettyPhone(phone) : "新询盘")
    const bits = [l.guest_count ? `${l.guest_count} 人` : null, l.city_or_zip, SOURCE_LABELS[l.lead_source ?? ""] ?? null].filter(Boolean)
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
    if (isTestNumber(peer)) continue
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

  // ---- deposits that just landed --------------------------------------------
  const { data: paid } = await supabase
    .from("payments")
    .select("id, order_id, amount_cents, paid_at")
    .eq("type", "deposit")
    .gte("paid_at", new Date(now - DEPOSIT_LOOKBACK_MS).toISOString())
    .order("paid_at", { ascending: false })
    .limit(20)
  const payRows = (paid ?? []) as Array<{ id: string; order_id: string | null; amount_cents: number | null; paid_at: string }>
  const { data: changes } = await supabase
    .from("invoice_update_requests")
    .select("id, order_id, customer_name, customer_message, created_at")
    .in("status", ["received", "confirmed_in_progress"])
    .gte("created_at", new Date(now - CHANGE_LOOKBACK_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(20)
  const changeRows = (changes ?? []) as Array<{ id: string; order_id: string | null; customer_name: string | null; customer_message: string | null; created_at: string }>
  const orderIds = Array.from(new Set([...payRows.map((p) => p.order_id), ...changeRows.map((c) => c.order_id)].filter((x): x is string => Boolean(x))))
  const { data: orders } = orderIds.length ? await supabase.from("orders").select("id, order_no, customer_name, customer_phone").in("id", orderIds) : { data: [] as Array<{ id: string; order_no: string | null; customer_name: string | null; customer_phone: string | null }> }
  const orderById = new Map(((orders ?? []) as Array<{ id: string; order_no: string | null; customer_name: string | null; customer_phone: string | null }>).map((o) => [o.id, o]))
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
  for (const c of changeRows) {
    const o = c.order_id ? orderById.get(c.order_id) : undefined
    events.push({
      key: `change:${c.id}`,
      kind: "order_change",
      title: `客户改单 · ${c.customer_name ?? o?.customer_name ?? "客户"}`,
      body: (c.customer_message ?? "").trim().slice(0, 60) || o?.order_no || "有改动请求等确认",
      url: c.order_id ? `/admin?tab=orders&order=${c.order_id}` : "/admin?tab=orders&filter=changed",
      at: c.created_at,
      waitedMinutes: minutesSince(c.created_at, now),
      ring: false,
      orderId: c.order_id,
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
      title: `Reddit 有人在问 · r/${r.subreddit}`,
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
  // an email from the desk or a text - is waiting, under the same hold /
  // "no reply needed" rules as a text.
  const emailSince = new Date(now - EMAIL_LOOKBACK_MS).toISOString()
  const { data: mailRows } = await supabase
    .from("lead_touchpoints")
    .select("lead_id, touchpoint_type, occurred_at, raw_payload_json")
    .in("touchpoint_type", ["email_inbound", "email_outbound", "sms_outbound"])
    .gte("occurred_at", emailSince)
    .order("occurred_at", { ascending: false })
    .limit(400)
  const mailByLead = new Map<string, { lastIn: { at: string; subject: string; snippet: string } | null; lastOutAt: string | null }>()
  for (const r of (mailRows ?? []) as Array<{ lead_id: string; touchpoint_type: string; occurred_at: string; raw_payload_json: Record<string, unknown> | null }>) {
    const m = mailByLead.get(r.lead_id) ?? { lastIn: null, lastOutAt: null }
    if (r.touchpoint_type === "email_inbound") {
      if (!m.lastIn) m.lastIn = { at: r.occurred_at, subject: String(r.raw_payload_json?.subject ?? ""), snippet: String(r.raw_payload_json?.snippet ?? "") }
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
  const { data: formRows } = await supabase
    .from("lead_touchpoints")
    .select("lead_id, touchpoint_type, occurred_at, raw_payload_json")
    .in("touchpoint_type", [...CUSTOMER_FORM_TYPES, "sms_outbound", "email_outbound"])
    .gte("occurred_at", formSince)
    .order("occurred_at", { ascending: false })
    .limit(800)
  type FormRow = { lead_id: string; touchpoint_type: string; occurred_at: string; raw_payload_json: Record<string, unknown> | null }
  const formByLead = new Map<string, { lastForm: FormRow | null; lastOutAt: string | null }>()
  for (const r of (formRows ?? []) as FormRow[]) {
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
      .select("id, full_name, phone, email, status, acked_until, hold_until, first_response_at")
      .in("id", formCandidates.map(([id]) => id))
    type FormLead = { id: string; full_name: string | null; phone: string | null; email: string | null; status: string | null; acked_until: string | null; hold_until: string | null; first_response_at: string | null }
    const formLeadById = new Map(((formLeads ?? []) as FormLead[]).map((l) => [l.id, l]))
    for (const [leadId, m] of formCandidates) {
      const l = formLeadById.get(leadId)
      const form = m.lastForm!
      // A booked customer re-quoting, or a lost one coming back, is talking to us too (2026-10-08).
      if (!l || l.status === "disqualified") continue
      // The form that created the lead is the lead (handled above); only a form after our first reply is a reply.
      if (!l.first_response_at || form.occurred_at <= l.first_response_at) continue
      const peer = toE164(l.phone)
      if (peer && isTestNumber(peer)) continue
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
    if (age < UNDELIVERED_AFTER_MS || age > SMS_CUSTOMER_LOOKBACK_MS || isTestNumber(peer)) continue
    notDelivered.push({ peer, at: v.lastOutAt, status: v.lastOutStatus })
  }
  let undelivered = 0
  if (notDelivered.length) {
    const known = await leadsByPhones(supabase, notDelivered.map((n) => n.peer))
    for (const n of notDelivered) {
      const lead = known.get(n.peer)
      if (!lead || lead.status === "lost" || lead.status === "disqualified") continue
      undelivered += 1
      const who = (lead.full_name ?? "").trim() || prettyPhone(n.peer)
      events.push({
        key: `undelivered:${n.peer}:${n.at}`,
        kind: "undelivered",
        title: `短信没送达 · ${who}`,
        body: `给这个号码发的短信一直没有送达回执（最后一条 ${ptStamp(n.at)}，${n.status}），换邮件或打电话`,
        url: `/admin?tab=leads&lead=${lead.id}`,
        at: n.at,
        waitedMinutes: minutesSince(n.at, now),
        ring: false,
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

  events.sort((a, b) => (a.ring === b.ring ? b.at.localeCompare(a.at) : a.ring ? -1 : 1))
  return {
    counts: {
      unreplied: unrepliedTotal,
      silenced,
      undelivered,
      emailNew,
      formNew,
      unreachedParties,
      newLeads: newLeadsTotal,
      changedOrders: changeRows.length,
      plannerLive,
      redditNew: redditRows.length,
    },
    events,
  }
}

/** The newest lead on each of these numbers (any age), by the 10-digit normalized_phone. */
async function leadsByPhones(
  supabase: SupabaseClient,
  peers: string[],
): Promise<Map<string, { id: string; full_name: string | null; status: string | null }>> {
  const digits = Array.from(new Set(peers.map((p) => p.replace(/\D/g, "").slice(-10)).filter((d) => d.length === 10)))
  const out = new Map<string, { id: string; full_name: string | null; status: string | null }>()
  if (!digits.length) return out
  const { data } = await supabase
    .from("leads")
    .select("id, full_name, status, normalized_phone, created_at")
    .in("normalized_phone", digits)
    .order("created_at", { ascending: false })
    .limit(500)
  for (const r of (data ?? []) as Array<{ id: string; full_name: string | null; status: string | null; normalized_phone: string | null }>) {
    const e164 = r.normalized_phone ? `+1${r.normalized_phone}` : null
    if (e164 && !out.has(e164)) out.set(e164, { id: r.id, full_name: r.full_name, status: r.status })
  }
  return out
}

const PT_STAMP = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const ptStamp = (iso: string) => PT_STAMP.format(Date.parse(iso)).replace(",", "")
