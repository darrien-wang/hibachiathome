import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"

import { FULL_SETUP_PER_GUEST, TABLES_CHAIRS_PER_GUEST, calcSimpleEstimate } from "@/config/pricing-rules"
import { escapeHtml } from "@/lib/escape-html"
import { loadQuiet } from "@/lib/lead-hold"
import { MISSED_CALL_TEXT, missedCallTouchpointId } from "@/lib/missed-call"
import { sendCustomerEmail } from "@/lib/ops-notifications"
import { ourSmsNumber, sendSms, toE164 } from "@/lib/sms-thread"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { getWorkbenchSettings } from "@/lib/workbench-settings"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// The lead watcher. A scheduled job calls this every few minutes so a lead
// never again waits hours because nobody happened to be looking:
//
//   1. Landing-page leads that left a phone + email but never reached the
//      quote step got nothing from us (the quote text only fires on step 2).
//      After a short grace period they are sent the price they came for - the
//      same wording the owner approved by hand, priced by the same function
//      and travel fee the page showed them.
//   2. Everything that needs a person - other uncontacted leads, customer
//      texts nobody answered - is returned once, so the job can ping the owner.
//
// Idempotent: a lead with a first response is never touched again, and each
// "needs a human" item is reported once (then again only if it is still open
// two hours later).

// Grace (let step 2 of the form land first), re-notify spacing and the on/off
// switches are owner-editable in /admin → 设置 → 线索巡检; the code defaults
// (5 min / 120 min / on) are what was hard-coded here until 2026-09-21.
const MAX_LEAD_AGE_HOURS = 24
const SMS_LOOKBACK_HOURS = 24
// Missed-call backstop window: long enough to cover a sweep that was late,
// short enough that a text still reads as "we saw you call".
const MISSED_CALL_LOOKBACK_MS = 60 * 60_000
// Give the <Dial action> handler (app/api/twilio/voice-status) first go.
const MISSED_CALL_GRACE_MS = 2 * 60_000
// A customer text unanswered this long is re-notified every 10 minutes instead
// of every renotify_minutes (2026-09-27 audit: p90 reply time was 103 min).
const URGENT_AFTER_MIN = 15
const URGENT_RENOTIFY_MS = 10 * 60_000
// The desktop task only ever ran 07:00-23:59 PT, so the automatic texts
// (first response, missed-call backstop) keep those hours now that a server
// cron calls this around the clock. The backup person is texted in a
// narrower window: nobody is woken for a lead that can wait until 8.
const ACTIVE_HOURS_PT: [number, number] = [7, 24]
const ESCALATE_HOURS_PT: [number, number] = [8, 23]
// A party occupies the desk from 90 min before the booked start (driving,
// setup) to 150 min after it (cooking, packing up).
const PARTY_BEFORE_MS = 90 * 60_000
const PARTY_AFTER_MS = 150 * 60_000
const ESCALATE_RENOTIFY_MS = 60 * 60_000

// Two callers: the workbench / desktop task (admin actor) and the Supabase
// pg_cron job, which carries its own single-purpose key (LEAD_WATCH_CRON_KEY,
// 2026-10-04) so the owner key never sits in the database. The cron key is
// accepted here and nowhere else.
async function isAuthorized(request: NextRequest): Promise<boolean> {
  if (await resolveAdminActor(request)) return true
  const cronKey = process.env.LEAD_WATCH_CRON_KEY?.trim()
  if (!cronKey) return false
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
  const provided = request.headers.get("x-admin-key")?.trim() || bearer
  return provided === cronKey
}

function ptHour(ms: number): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }).format(new Date(ms))
  return Number(h) % 24
}
const withinPt = (ms: number, [from, to]: [number, number]) => {
  const h = ptHour(ms)
  return h >= from && h < to
}

type AnySupabase = NonNullable<ReturnType<typeof getSupabaseAdmin>>

// Is a party on right now? Any booked order whose window covers this moment.
// The owner cooks most of them, and when he does not, the backup still only
// hears about customers who have already waited escalate_after_minutes.
async function partyInProgress(supabase: AnySupabase, now: number): Promise<boolean> {
  const { data } = await supabase
    .from("orders")
    .select("id, event_start")
    .eq("deposit_status", "paid_verified")
    .gte("event_start", new Date(now - PARTY_AFTER_MS).toISOString())
    .lte("event_start", new Date(now + PARTY_BEFORE_MS).toISOString())
    .limit(1)
  return (data ?? []).length > 0
}

const fmtPhone = (e164: string | null | undefined) => {
  const d = (e164 ?? "").replace(/\D/g, "").slice(-10)
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (e164 ?? "")
}

// The 555 exchange is never assigned to real subscribers; our own tests use it.
const isTestNumber = (e164: string | null) => !e164 || /^\+1\d{3}555\d{4}$/.test(e164)
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function describeDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ""
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

type ContactPayload = {
  adults?: number
  kids?: number
  cityName?: string
  travelFee?: number
  eventDate?: string
}

function buildFirstResponse(p: ContactPayload): { sms: string; emailSubject: string; emailText: string } {
  const adults = Math.max(1, Math.round(Number(p.adults) || 15))
  const kids = Math.max(0, Math.round(Number(p.kids) || 0))
  const city = (p.cityName ?? "").trim()
  const travel = Math.max(0, Math.round(Number(p.travelFee) || 0))
  const weekend = calcSimpleEstimate({ adults, kids, weekdaySpecial: false }).total
  const weekday = calcSimpleEstimate({ adults, kids, weekdaySpecial: true }).total
  const guests = kids > 0 ? `${adults} adults + ${kids} kids` : `${adults} adults`
  const where = city ? ` in ${city}` : ""
  const travelSms = travel > 0 ? `, plus about $${travel} travel` : ", no travel fee"
  const sms =
    `Hi! Bling from Real Hibachi - our system should've texted you a price and didn't, sorry about that. ` +
    `For ${guests}${where} it's ${money(weekend)} Fri-Sun or ${money(weekday)} Mon-Thu${travelSms} ` +
    `(2 proteins each + fried rice, veggies, salad and the chef show), plus 10% sales tax - ` +
    `pay your chef in cash on the day and get a 10% cash discount. What date are you thinking?`
  const emailText = [
    "Hi there,",
    "",
    "Bling here from Real Hibachi. You left your number and email on our site a few minutes ago and our system should have texted you a price right away - it didn't, sorry about that. Here it is:",
    "",
    `- ${guests}, Fri-Sun: ${money(weekend)} total`,
    `- Same party Mon-Thu: ${money(weekday)} (+ a free appetizer of your choice: gyoza, edamame or spring rolls)`,
    travel > 0 ? `- Travel${city ? ` to ${city}` : ""}: about $${travel}` : `- ${city || "Your area"}: no travel fee`,
    "- Includes 2 proteins per guest, fried rice, veggies, salad and the chef show. Kids 5-12 are $29.90, under 5 eat free.",
    "- Prices are plus 10% sales tax. Pay your chef in cash on the day and get a 10% cash discount; card, Venmo and Zelle have no fees.",
    `- Tables, chairs & linens are $${TABLES_CHAIRS_PER_GUEST} a guest if you need them, plates & silverware $${FULL_SETUP_PER_GUEST - TABLES_CHAIRS_PER_GUEST} - or use your own.`,
    "",
    "What date are you thinking?",
    "",
    "Bling",
    "Real Hibachi - (213) 770-7788",
    "",
  ].join("\n")
  return { sms, emailSubject: `Your hibachi quote${city ? ` for ${city}` : ""}`, emailText }
}

type TwilioMessage = { sid: string; from: string; to: string; body: string | null; date_sent: string | null; date_created: string }

async function listTwilio(query: string): Promise<TwilioMessage[]> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return []
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?${query}&PageSize=60`, {
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
    cache: "no-store",
  })
  if (!res.ok) return []
  const data = (await res.json().catch(() => ({}))) as { messages?: TwilioMessage[] }
  return data.messages ?? []
}

const when = (m: TwilioMessage) => new Date(m.date_sent ?? m.date_created).getTime()

type TwilioCall = {
  sid: string
  from: string
  to: string
  direction: string | null
  status: string
  duration: string | null
  start_time: string | null
  date_created: string
}

/** Calls into the 213 line since yesterday, newest first (one page is plenty). */
async function listTwilioCalls(ours: string): Promise<TwilioCall[]> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return []
  const day = new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json?To=${encodeURIComponent(ours)}&StartTime%3E=${day}&PageSize=50`,
    { headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` }, cache: "no-store" },
  )
  if (!res.ok) return []
  const data = (await res.json().catch(() => ({}))) as { calls?: TwilioCall[] }
  return data.calls ?? []
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const dryRun = request.nextUrl.searchParams.get("dry") === "1"
  // consumer=cron: nobody reads that response, so the "reported once" marks
  // for plain items are left alone - otherwise the server run at :05 would
  // swallow the push the desktop task sends at :10. Escalation keeps its own marks.
  const cronCaller = request.nextUrl.searchParams.get("consumer") === "cron"
  const now = Date.now()
  const watch = (await getWorkbenchSettings()).lead_watch
  if (!watch.enabled) {
    return NextResponse.json({ ok: true, dryRun, disabled: true, checkedAt: new Date(now).toISOString(), autoSent: [], needsHuman: [], stillOpen: 0 })
  }
  if (!withinPt(now, ACTIVE_HOURS_PT)) {
    return NextResponse.json({ ok: true, dryRun, quietHours: true, checkedAt: new Date(now).toISOString(), autoSent: [], needsHuman: [], stillOpen: 0 })
  }

  // ---- open leads with no first response --------------------------------
  const since = new Date(now - MAX_LEAD_AGE_HOURS * 3600_000).toISOString()
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, created_at, full_name, phone, email, status, lead_source, city_or_zip, guest_count, latest_message")
    .eq("status", "new")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const ids = (leads ?? []).map((l) => l.id)
  const { data: touchpoints } = ids.length
    ? await supabase
        .from("lead_touchpoints")
        .select("lead_id, touchpoint_type, raw_payload_json, created_at")
        .in("lead_id", ids)
        .in("touchpoint_type", ["agent_first_response", "landing_contact", "landing_quote_text"])
    : { data: [] as Array<{ lead_id: string; touchpoint_type: string; raw_payload_json: unknown; created_at: string }> }

  const autoSent: Array<Record<string, unknown>> = []
  const humanLeads: Array<Record<string, unknown>> = []

  for (const lead of leads ?? []) {
    const tps = (touchpoints ?? []).filter((t) => t.lead_id === lead.id)
    if (tps.some((t) => t.touchpoint_type === "agent_first_response")) continue
    const phone = toE164(lead.phone)
    if (isTestNumber(phone)) continue
    const ageMin = Math.round((now - new Date(lead.created_at).getTime()) / 60_000)
    const contact = tps.find((t) => t.touchpoint_type === "landing_contact")
    const gotQuote = tps.some((t) => t.touchpoint_type === "landing_quote_text")

    // Left contact details, never reached the quote step: send the price.
    if (contact && !gotQuote) {
      if (ageMin < watch.grace_minutes) continue
      const payload = (contact.raw_payload_json ?? {}) as ContactPayload
      if (!watch.auto_first_response || (payload.eventDate && describeDate(payload.eventDate))) {
        // A date is already on file, so the approved "what date?" wording does
        // not fit - hand this one to a person instead of improvising.
        humanLeads.push({ kind: "lead", leadId: lead.id, phone, email: lead.email, city: lead.city_or_zip, minutesWaiting: ageMin, summary: lead.latest_message })
        continue
      }
      const msg = buildFirstResponse(payload)
      if (dryRun) {
        autoSent.push({ leadId: lead.id, phone, email: lead.email, minutesWaiting: ageMin, dryRun: true, sms: msg.sms })
        continue
      }
      const sms = phone ? await sendSms(phone, msg.sms) : ({ ok: false, error: "no_phone" } as const)
      const email = lead.email
        ? await sendCustomerEmail({
            to: lead.email,
            subject: msg.emailSubject,
            text: msg.emailText,
            html: msg.emailText
              .split("\n")
              .map((l) => (l ? `<p style="margin:0 0 8px">${escapeHtml(l)}</p>` : "<br>"))
              .join(""),
          })
        : null
      const reached = sms.ok || Boolean(email?.delivered)
      if (reached) {
        await supabase.from("lead_touchpoints").insert([
          {
            lead_id: lead.id,
            touchpoint_type: "agent_first_response",
            touchpoint_source: "lead_watch",
            raw_payload_json: { via: sms.ok ? "sms" : "email", auto: true, sms_sid: sms.ok ? sms.sid : null },
          },
          {
            lead_id: lead.id,
            touchpoint_type: "agent_note",
            touchpoint_source: "lead_watch",
            raw_payload_json: {
              note: `[SOP:first_response] AUTO (lead-watch, ${ageMin} min after signup): price sent - SMS ${sms.ok ? "ok" : `failed (${sms.error})`}, email ${email?.delivered ? "ok" : "not sent"}. ${msg.sms}`.slice(0, 1900),
            },
          },
        ])
        await supabase.from("leads").update({ status: "qualified", updated_at: new Date().toISOString() }).eq("id", lead.id).eq("status", "new")
      }
      // 这里原来写了两次 email：客户地址被投递状态覆盖，通知里一直没有地址。
      // 保持 email=投递状态（消费方在读这个），地址改名放回来。
      autoSent.push({ leadId: lead.id, phone, toEmail: lead.email, city: lead.city_or_zip, minutesWaiting: ageMin, sms: sms.ok ? "sent" : sms.error, email: email?.delivered ? "sent" : "no", reached })
      continue
    }

    // Any other uncontacted lead needs a person.
    humanLeads.push({ kind: "lead", leadId: lead.id, name: lead.full_name, phone, email: lead.email, city: lead.city_or_zip, source: lead.lead_source, guests: lead.guest_count, minutesWaiting: ageMin, summary: lead.latest_message })
  }

  // ---- customer texts nobody answered ------------------------------------
  const ours = ourSmsNumber()
  const cutoff = now - SMS_LOOKBACK_HOURS * 3600_000
  const [inbound, outbound] = await Promise.all([listTwilio(`To=${encodeURIComponent(ours)}`), listTwilio(`From=${encodeURIComponent(ours)}`)])

  // 挂起中的线索不提醒（老板 2026-09-23 定）：客人说了他会回头找我们，那条
  // "Thanks, I'll get back to you" 不是在等我们回，一直提醒只是噪音。规则和
  // 手机收件箱共用一份，见 lib/lead-hold.ts。
  const quiet = await loadQuiet(supabase, now)

  const lastOut = new Map<string, number>()
  for (const m of outbound) if (!lastOut.has(m.to)) lastOut.set(m.to, when(m))
  const humanSms: Array<Record<string, unknown>> = []
  const seen = new Set<string>()
  for (const m of inbound) {
    if (seen.has(m.from)) continue
    seen.add(m.from)
    const at = when(m)
    if (at < cutoff || isTestNumber(m.from)) continue
    if ((lastOut.get(m.from) ?? 0) >= at) continue
    const body = (m.body ?? "").trim()
    // 挂起中、老板标过「不用回」、或者这条本来就不是问题 —— 一条规则，见
    // lib/lead-hold.ts loadQuiet（老板 2026-09-24：免得一直提醒）。
    if (quiet.quiet(m.from, at, body)) continue
    humanSms.push({ kind: "sms", sid: m.sid, from: m.from, minutesWaiting: Math.round((now - at) / 60_000), body: body.slice(0, 400) })
  }

  // ---- missed calls nobody texted back (2026-09-27 audit) -----------------
  // The <Dial action> handler texts a caller nobody picked up for, but a caller
  // who hangs up while we are still ringing never reaches it - Twilio's call
  // log does. 4 of the 8 missed calls in the audit window got nothing from us,
  // and 5 of the 18 bookings started with a phone call. Same text and the same
  // CallSid key as the handler (lib/missed-call.ts), so nobody is texted twice.
  const missedCallTexts: Array<Record<string, unknown>> = []
  for (const c of await listTwilioCalls(ours)) {
    if (!(c.direction ?? "").startsWith("inbound")) continue
    const from = toE164(c.from)
    const startedAt = new Date(c.start_time ?? c.date_created).getTime()
    if (!from || isTestNumber(from) || Number.isNaN(startedAt)) continue
    if (now - startedAt > MISSED_CALL_LOOKBACK_MS || now - startedAt < MISSED_CALL_GRACE_MS) continue
    if (c.status === "completed" && (Number(c.duration) || 0) >= 20) continue
    // Anyone (the handler, a person, the app) already texted after the call.
    if ((lastOut.get(from) ?? 0) >= startedAt) continue
    const digits = from.replace(/\D/g, "").slice(-10)
    const { data: leadRow } = await supabase
      .from("leads")
      .select("id, sms_blocked_at")
      .eq("normalized_phone", digits)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    const lead = leadRow as { id: string; sms_blocked_at: string | null } | null
    if (lead?.sms_blocked_at) continue
    if (lead) {
      const { data: done } = await supabase
        .from("lead_touchpoints")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("external_touchpoint_id", missedCallTouchpointId(c.sid))
        .limit(1)
      if (done && done.length > 0) continue
    }
    if (dryRun) {
      missedCallTexts.push({ from, callSid: c.sid, callStatus: c.status, dryRun: true })
      continue
    }
    const sms = await sendSms(from, MISSED_CALL_TEXT)
    if (lead) {
      const at = new Date().toISOString()
      await supabase.from("lead_touchpoints").insert({
        lead_id: lead.id,
        touchpoint_type: "sms_outbound",
        touchpoint_source: "missed_call",
        external_touchpoint_id: missedCallTouchpointId(c.sid),
        raw_payload_json: {
          to: from,
          body: MISSED_CALL_TEXT,
          status: sms.ok ? sms.status : `failed: ${sms.error}`,
          call_sid: c.sid,
          call_status: c.status,
          call_seconds: Number(c.duration) || 0,
          sid: sms.ok ? sms.sid : null,
          auto: true,
          via: "lead_watch",
        },
        occurred_at: at,
      })
      await supabase
        .from("leads")
        .update({ latest_message: `我方 ${at.slice(0, 10)} 未接来电已自动短信：${MISSED_CALL_TEXT}`.slice(0, 500), last_seen_at: at, updated_at: at })
        .eq("id", lead.id)
    }
    missedCallTexts.push({ from, callSid: c.sid, callStatus: c.status, sms: sms.ok ? "sent" : sms.error })
  }

  // ---- report each open item once (again after two hours; urgent ones every 10 min)
  const candidates = [
    ...humanLeads.map((h) => ({ key: `lead:${h.leadId}`, item: h, urgent: false })),
    ...humanSms.map((h) => ({ key: `sms:${h.sid}`, item: h, urgent: Number(h.minutesWaiting) >= URGENT_AFTER_MIN })),
  ]
  let needsHuman = candidates.map((c) => ({ ...c.item, urgent: c.urgent }))
  if (candidates.length > 0) {
    const { data: already } = await supabase
      .from("lead_watch_notified")
      .select("key, notified_at")
      .in("key", candidates.map((c) => c.key))
    const notifiedAt = new Map((already ?? []).map((r) => [r.key as string, new Date(r.notified_at).getTime()]))
    // A customer question that has sat 15+ minutes is the one thing on this
    // list that costs money by the minute, so it keeps coming back until
    // someone answers it; everything else waits renotify_minutes as before.
    const fresh = candidates.filter((c) => {
      const last = notifiedAt.get(c.key)
      if (last === undefined) return true
      return now - last >= (c.urgent ? URGENT_RENOTIFY_MS : watch.renotify_minutes * 60_000)
    })
    needsHuman = fresh.map((c) => ({ ...c.item, urgent: c.urgent }))
    if (!dryRun && !cronCaller && fresh.length > 0) {
      await supabase
        .from("lead_watch_notified")
        .upsert(fresh.map((c) => ({ key: c.key, kind: c.key.split(":")[0], notified_at: new Date().toISOString() })), { onConflict: "key" })
    }
  }

  // ---- 派对时段转接 -------------------------------------------------------
  // 2026-10-01~03: the owner was cooking Friday and Saturday, six leads waited
  // three hours or more, and that cohort closed 0 of 20 (the week before: 9 of
  // 30). When a party is on and a customer has waited escalate_after_minutes,
  // the backup number gets one text with the queue; the same item is re-sent
  // after an hour if it is still open. Off until a number is set.
  const escalated: Array<Record<string, unknown>> = []
  const escalateTo = watch.escalate_mode !== "off" ? toE164(watch.escalate_phone) : null
  if (escalateTo && !isTestNumber(escalateTo) && candidates.length > 0 && withinPt(now, ESCALATE_HOURS_PT)) {
    const busy = watch.escalate_mode === "always" ? true : await partyInProgress(supabase, now)
    const due = busy ? candidates.filter((c) => Number(c.item.minutesWaiting) >= watch.escalate_after_minutes) : []
    if (due.length > 0) {
      const keys = due.map((c) => `esc:${c.key}`)
      const { data: already } = await supabase.from("lead_watch_notified").select("key, notified_at").in("key", keys)
      const lastAt = new Map((already ?? []).map((r) => [r.key as string, new Date(r.notified_at).getTime()]))
      const fresh = due.filter((c) => {
        const last = lastAt.get(`esc:${c.key}`)
        return last === undefined || now - last >= ESCALATE_RENOTIFY_MS
      })
      if (fresh.length > 0) {
        const lines = fresh.slice(0, 3).map((c, i) => {
          const it = c.item as Record<string, unknown>
          const wait = `等 ${Number(it.minutesWaiting)} 分`
          if (c.key.startsWith("sms:")) {
            const body = String(it.body ?? "").replace(/\s+/g, " ").slice(0, 60)
            return `${i + 1}. ${fmtPhone(String(it.from ?? ""))} 问“${body}”（${wait}）`
          }
          const who = [it.city, it.guests ? `${it.guests} 人` : null].filter(Boolean).join(" ")
          return `${i + 1}. 新线索 ${who || fmtPhone(String(it.phone ?? ""))}（${wait}）`
        })
        const more = fresh.length > 3 ? ` 还有 ${fresh.length - 3} 条。` : ""
        const text = `Real Hibachi 值班：${watch.escalate_mode === "always" ? "" : "老板在场上，"}${fresh.length} 位客人等回复。${lines.join(" ")}${more} 工作台：https://www.realhibachi.com/admin/leads`
        const sms = dryRun ? ({ ok: true } as const) : await sendSms(escalateTo, text)
        escalated.push({ to: fmtPhone(escalateTo), items: fresh.map((c) => c.key), sms: sms.ok ? (dryRun ? "dry" : "sent") : ("error" in sms ? sms.error : "failed"), text })
        if (!dryRun && sms.ok) {
          await supabase
            .from("lead_watch_notified")
            .upsert(fresh.map((c) => ({ key: `esc:${c.key}`, kind: "esc", notified_at: new Date().toISOString() })), { onConflict: "key" })
        }
      }
    }
  }

  return NextResponse.json({ ok: true, dryRun, checkedAt: new Date(now).toISOString(), autoSent, missedCallTexts, needsHuman, escalated, stillOpen: candidates.length })
}
