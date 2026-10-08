import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"

import { FULL_SETUP_PER_GUEST, TABLES_CHAIRS_PER_GUEST, calcSimpleEstimate } from "@/config/pricing-rules"
import { escapeHtml } from "@/lib/escape-html"
import { notAQuestion } from "@/lib/courtesy-text"
import {
  PARTY_CONTACT_FIRST_TEXT_H,
  PARTY_CONTACT_MIN_ORDER_AGE_MS,
  PARTY_CONTACT_URGENT_H,
  instantToWallIso,
  partyContactFirstText,
  partyContactSecondText,
  partyContactStage,
  ptDate,
  quoteFollowUpPlan,
  shortDate,
  wallTime,
  wallToInstant,
} from "@/lib/first-response"
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
// Template B after the site's automatic quote (owner 2026-10-07 "交给机器"):
// sent a couple of minutes later so it reads as the person following up, not
// the same robot twice. A per-minute cron (stage=first_response) makes that
// latency real; the wording and the hand-to-a-person rules live in
// lib/first-response.ts.
const QUOTE_FOLLOW_UP_GRACE_MIN = 2
// Pre-party contact: the 48h flag comes back every renotify_minutes like any
// other item; the day-before one is re-pushed hourly until someone reaches them.
const PARTY_CONTACT_RENOTIFY_24H_MS = 60 * 60_000
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
// 越等越响 (owner 2026-10-07): a customer still waiting after three hours goes
// to the backup person even when no party is on, again every three hours.
const ESCALATE_LONG_WAIT_MIN = 180
const ESCALATE_LONG_RENOTIFY_MS = 3 * 3600_000

// Two callers: the workbench / desktop task (admin actor) and the Supabase
// pg_cron job, which carries its own single-purpose key (LEAD_WATCH_CRON_KEY,
// 2026-10-04) so the owner key never sits in the database. The cron key is
// accepted here and nowhere else.
// Who is calling: a workbench / desktop actor, or the pg_cron job with its
// own key. null = not allowed. The name is what the status panel shows.
async function callerOf(request: NextRequest): Promise<string | null> {
  const actor = await resolveAdminActor(request)
  if (actor) return request.nextUrl.searchParams.get("consumer") === "cron" ? "cron" : actor.alias
  const cronKey = process.env.LEAD_WATCH_CRON_KEY?.trim()
  if (!cronKey) return null
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
  const provided = request.headers.get("x-admin-key")?.trim() || bearer
  return provided === cronKey ? "cron" : null
}

// full = the 10-minute sweep; first_response = the per-minute cron that only
// runs the leads section (template A / B) and records a run only when it sent.
type WatchStage = "full" | "first_response"

type Candidate = { key: string; item: Record<string, unknown>; urgent: boolean; renotifyMs?: number }

type WatchResult = {
  ok: true
  dryRun: boolean
  stage?: WatchStage
  checkedAt: string
  disabled?: boolean
  quietHours?: boolean
  autoSent: unknown[]
  missedCallTexts?: unknown[]
  partyContact?: unknown[]
  needsHuman: unknown[]
  escalated?: unknown[]
  stillOpen: number
}

// Every real run leaves a row in lead_watch_runs so the workbench can show
// the patrol is alive and what it did (2026-10-06). Dry runs are not
// recorded, and a failure here never fails the run itself.
async function recordRun(supabase: AnySupabase, caller: string, t0: number, out: WatchResult | null, error?: string) {
  try {
    await supabase.from("lead_watch_runs").insert({
      caller,
      dry_run: false,
      quiet_hours: Boolean(out?.quietHours),
      disabled: Boolean(out?.disabled),
      auto_sent: out?.autoSent.length ?? 0,
      missed_call_texts: out?.missedCallTexts?.length ?? 0,
      needs_human: out?.needsHuman.length ?? 0,
      still_open: out?.stillOpen ?? 0,
      escalated: out?.escalated?.length ?? 0,
      duration_ms: Date.now() - t0,
      ok: !error,
      error: error ?? null,
    })
    // Keep two weeks; an occasional delete here beats another cron job.
    if (Math.random() < 0.02) {
      await supabase.from("lead_watch_runs").delete().lt("ran_at", new Date(Date.now() - 14 * 86400_000).toISOString())
    }
  } catch {
    // status is best effort
  }
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
    // event_start is the PT wall clock stored as UTC (lib/first-response.ts);
    // comparing it with a real instant was seven hours off until 2026-10-07.
    .gte("event_start", instantToWallIso(now - PARTY_AFTER_MS))
    .lte("event_start", instantToWallIso(now + PARTY_BEFORE_MS))
    .limit(1)
  return (data ?? []).length > 0
}

/** File an automatic text on the lead behind a phone number (bare SID as the id, the same key sms reconcile uses). */
async function logAutoSms(supabase: AnySupabase, phone: string, sid: string, body: string, source: string, extra: Record<string, unknown>) {
  const digits = phone.replace(/\D/g, "").slice(-10)
  const { data: leadRow } = await supabase.from("leads").select("id").eq("normalized_phone", digits).order("created_at", { ascending: false }).limit(1).maybeSingle()
  const lead = leadRow as { id: string } | null
  if (!lead) return
  await supabase.from("lead_touchpoints").insert({
    lead_id: lead.id,
    touchpoint_type: "sms_outbound",
    touchpoint_source: source,
    external_touchpoint_id: sid,
    raw_payload_json: { to: phone, body, sid, auto: true, via: "lead_watch", ...extra },
    occurred_at: new Date().toISOString(),
  })
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
    // Listed price only: nothing about tax or payment method is brought up
    // before the booking is confirmed (owner 2026-10-06); the invoice and the
    // pay page carry the itemised bills.
    `For ${guests}${where} it's ${money(weekend)} Fri-Sun or ${money(weekday)} Mon-Thu${travelSms} ` +
    `(2 proteins each + fried rice, veggies, salad and the chef show). What date are you thinking?`
  const emailText = [
    "Hi there,",
    "",
    "Bling here from Real Hibachi. You left your number and email on our site a few minutes ago and our system should have texted you a price right away - it didn't, sorry about that. Here it is:",
    "",
    `- ${guests}, Fri-Sun: ${money(weekend)} total`,
    `- Same party Mon-Thu: ${money(weekday)} (+ a free appetizer of your choice: gyoza, edamame or spring rolls)`,
    travel > 0 ? `- Travel${city ? ` to ${city}` : ""}: about $${travel}` : `- ${city || "Your area"}: no travel fee`,
    "- Includes 2 proteins per guest, fried rice, veggies, salad and the chef show. Kids 5-12 are $29.90, under 5 eat free.",
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

type TwilioMessage = { sid: string; from: string; to: string; body: string | null; date_sent: string | null; date_created: string; num_media?: string }

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
  const caller = await callerOf(request)
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const dryRun = request.nextUrl.searchParams.get("dry") === "1"
  // stage=first_response is the per-minute cron: only the leads section runs
  // (no Twilio sweeps, no escalation), and a run that sent nothing leaves no
  // row in lead_watch_runs - 1,440 silent rows a day would drown the panel.
  const stage: WatchStage = request.nextUrl.searchParams.get("stage") === "first_response" ? "first_response" : "full"
  const t0 = Date.now()
  try {
    const out = await runWatch(supabase, dryRun, caller === "cron", stage)
    if (!dryRun && (stage === "full" || out.autoSent.length > 0)) await recordRun(supabase, caller, t0, out)
    return NextResponse.json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!dryRun) await recordRun(supabase, caller, t0, null, msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// 巡检状态（工作台线索页顶栏 + 设置页）：最近一次、最近一次服务器 cron、
// 24 小时跑了几次、今天（PT）自动首响 / 漏接来电短信 / 转接各几条。
export async function GET(request: NextRequest) {
  if (!(await resolveAdminActor(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const now = Date.now()
  const { data: rows, error } = await supabase
    .from("lead_watch_runs")
    .select("ran_at, caller, quiet_hours, disabled, auto_sent, missed_call_texts, needs_human, still_open, escalated, duration_ms, ok, error")
    .gte("ran_at", new Date(now - 24 * 3600_000).toISOString())
    .order("ran_at", { ascending: false })
    .limit(400)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  type Run = { ran_at: string; caller: string; quiet_hours: boolean; disabled: boolean; auto_sent: number; missed_call_texts: number; needs_human: number; still_open: number; escalated: number; duration_ms: number | null; ok: boolean; error: string | null }
  const all = (rows ?? []) as Run[]
  const ptDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
  const today = ptDay(new Date(now).toISOString())
  const todayRows = all.filter((r) => ptDay(r.ran_at) === today)
  const last = all[0] ?? null
  const lastCron = all.find((r) => r.caller === "cron") ?? null
  const sum = (k: "auto_sent" | "missed_call_texts" | "escalated") => todayRows.reduce((a, r) => a + (Number(r[k]) || 0), 0)
  const ageMinutes = last ? Math.round((now - new Date(last.ran_at).getTime()) / 60_000) : null
  // The cron fires every 10 minutes around the clock, so 25 minutes of
  // silence means the job or the site is down, whatever the hour.
  const health = !last ? "never" : !last.ok ? "error" : ageMinutes !== null && ageMinutes > 25 ? "stale" : "ok"
  return NextResponse.json({
    ok: true,
    health,
    lastRunAt: last?.ran_at ?? null,
    lastCaller: last?.caller ?? null,
    ageMinutes,
    lastError: last?.error ?? null,
    lastCronAt: lastCron?.ran_at ?? null,
    quietHours: Boolean(last?.quiet_hours),
    disabled: Boolean(last?.disabled),
    runs24h: all.length,
    cronRuns24h: all.filter((r) => r.caller === "cron").length,
    failed24h: all.filter((r) => !r.ok).length,
    today: { autoSent: sum("auto_sent"), missedCallTexts: sum("missed_call_texts"), escalated: sum("escalated") },
    stillOpen: last?.still_open ?? 0,
    recent: all.slice(0, 12),
  })
}

// cronCaller: nobody reads that response, so the "reported once" marks for
// plain items are left alone - otherwise the server run at :05 would swallow
// the push the desktop task sends at :10. Escalation keeps its own marks.
async function runWatch(supabase: AnySupabase, dryRun: boolean, cronCaller: boolean, stage: WatchStage = "full"): Promise<WatchResult> {
  const now = Date.now()
  const watch = (await getWorkbenchSettings()).lead_watch
  if (!watch.enabled) {
    return { ok: true, dryRun, stage, disabled: true, checkedAt: new Date(now).toISOString(), autoSent: [], needsHuman: [], stillOpen: 0 }
  }
  if (!withinPt(now, ACTIVE_HOURS_PT)) {
    return { ok: true, dryRun, stage, quietHours: true, checkedAt: new Date(now).toISOString(), autoSent: [], needsHuman: [], stillOpen: 0 }
  }
  const ours = ourSmsNumber()

  // ---- open leads with no first response --------------------------------
  const since = new Date(now - MAX_LEAD_AGE_HOURS * 3600_000).toISOString()
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, created_at, full_name, phone, email, status, lead_source, city_or_zip, guest_count, latest_message, sms_blocked_at, adult_count, child_count")
    .eq("status", "new")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40)
  if (error) throw new Error(error.message)

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

    const human = (why: string) =>
      humanLeads.push({ kind: "lead", leadId: lead.id, name: lead.full_name, phone, email: lead.email, city: lead.city_or_zip, source: lead.lead_source, guests: lead.guest_count, minutesWaiting: ageMin, summary: lead.latest_message, why })

    // Got the site's automatic quote (price + lock link already texted):
    // template B - what's the celebration? (D-1008-02; was "4 PM or 7 PM?" /
    // "which date?"), machine-sent since 2026-10-07; anything the template does not fit goes
    // to a person with the reason attached.
    if (gotQuote) {
      // The grace counts from the quote text, not from the contact step: a
      // visitor who leaves contact details and then finishes step 2 two
      // minutes later got B 33 seconds after the quote on the first live run.
      const quoteTp = tps.filter((t) => t.touchpoint_type === "landing_quote_text").sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      const quoteAgeMin = quoteTp ? Math.round((now - new Date(quoteTp.created_at).getTime()) / 60_000) : ageMin
      if (quoteAgeMin < QUOTE_FOLLOW_UP_GRACE_MIN) continue
      if (!watch.auto_quote_follow_up) {
        human("auto_quote_follow_up off")
        continue
      }
      if (!phone || lead.sms_blocked_at) {
        human(phone ? "sms blocked" : "no phone")
        continue
      }
      const payload = (quoteTp?.raw_payload_json ?? {}) as { adults?: number; kids?: number; eventDate?: string; cityName?: string }
      const plan = quoteFollowUpPlan({
        adults: Number(payload.adults ?? lead.adult_count ?? 0) || 0,
        kids: Number(payload.kids ?? lead.child_count ?? 0) || 0,
        eventDate: payload.eventDate ?? null,
        city: payload.cityName ?? null,
        todayPt: ptDate(now),
      })
      if (!plan.send) {
        human(plan.reason)
        continue
      }
      // The conversation may already be under way - the customer texted first,
      // or a person already sent something after the quote. Twilio is the truth
      // for both (the desk and the app both send through it); the quote itself
      // is the one outbound that starts "Real Hibachi:".
      const createdMs = new Date(lead.created_at).getTime()
      const sinceDay = new Date(createdMs - 86400_000).toISOString().slice(0, 10)
      const [inbound, outbound] = await Promise.all([
        listTwilio(`From=${encodeURIComponent(phone)}&To=${encodeURIComponent(ours)}&DateSent%3E=${sinceDay}`),
        listTwilio(`From=${encodeURIComponent(ours)}&To=${encodeURIComponent(phone)}&DateSent%3E=${sinceDay}`),
      ])
      const humanOut = outbound.find((m) => when(m) >= createdMs && !/^Real Hibachi:/.test(m.body ?? ""))
      if (humanOut) {
        // Someone already answered by hand: file that as the first response so
        // this lead is not re-examined every minute.
        if (!dryRun) {
          await supabase.from("lead_touchpoints").insert({
            lead_id: lead.id,
            touchpoint_type: "agent_first_response",
            touchpoint_source: "lead_watch",
            raw_payload_json: { via: "sms", auto: false, inferred_from: "twilio_outbound", sms_sid: humanOut.sid },
          })
        }
        continue
      }
      if (inbound.some((m) => when(m) >= createdMs)) {
        human("customer texted first")
        continue
      }
      if (dryRun) {
        autoSent.push({ leadId: lead.id, phone, template: "B", minutesWaiting: ageMin, dryRun: true, sms: plan.text })
        continue
      }
      const sms = await sendSms(phone, plan.text)
      if (sms.ok) {
        const at = new Date().toISOString()
        await supabase.from("lead_touchpoints").insert([
          {
            lead_id: lead.id,
            touchpoint_type: "agent_first_response",
            touchpoint_source: "lead_watch",
            raw_payload_json: { via: "sms", auto: true, template: "B", sms_sid: sms.sid },
          },
          {
            lead_id: lead.id,
            touchpoint_type: "sms_outbound",
            touchpoint_source: "lead_watch",
            external_touchpoint_id: sms.sid,
            raw_payload_json: { to: phone, body: plan.text, status: sms.status, sid: sms.sid, auto: true, via: "lead_watch", template: "B" },
            occurred_at: at,
          },
          {
            lead_id: lead.id,
            touchpoint_type: "agent_note",
            touchpoint_source: "lead_watch",
            raw_payload_json: { note: `[SOP:first_response] AUTO template B (lead-watch, ${ageMin} min after the quote): ${plan.text}`.slice(0, 1900) },
          },
        ])
        await supabase.from("leads").update({ status: "qualified", updated_at: at }).eq("id", lead.id).eq("status", "new")
      }
      autoSent.push({ leadId: lead.id, phone, template: "B", dated: plan.dated, minutesWaiting: ageMin, sms: sms.ok ? "sent" : sms.error, reached: sms.ok })
      continue
    }

    // Any other uncontacted lead needs a person.
    human("no template fits")
  }

  if (stage === "first_response") {
    return { ok: true, dryRun, stage, checkedAt: new Date(now).toISOString(), autoSent, needsHuman: [], stillOpen: humanLeads.length }
  }

  // ---- customer texts nobody answered ------------------------------------
  const cutoff = now - SMS_LOOKBACK_HOURS * 3600_000
  const [inbound, outbound] = await Promise.all([listTwilio(`To=${encodeURIComponent(ours)}`), listTwilio(`From=${encodeURIComponent(ours)}`)])

  // 挂起中的线索不提醒（老板 2026-09-23 定）：客人说了他会回头找我们，那条
  // "Thanks, I'll get back to you" 不是在等我们回，一直提醒只是噪音。规则和
  // 手机收件箱共用一份，见 lib/lead-hold.ts。
  const quiet = await loadQuiet(supabase, now)

  const lastOut = new Map<string, number>()
  for (const m of outbound) if (!lastOut.has(m.to)) lastOut.set(m.to, when(m))
  // Per number: the newest inbound, and the newest one that says something.
  // A "Loved …" reaction or a bare "thanks" after a real question (or photos)
  // must not hide it - same rule as the inbox, lib/sms-thread.ts foldLastByPeer.
  const mediaCount = (m: TwilioMessage) => Number(m.num_media ?? 0) || 0
  const newest = new Map<string, TwilioMessage>()
  const newestReal = new Map<string, TwilioMessage>()
  for (const m of inbound) {
    if (!newest.has(m.from)) newest.set(m.from, m)
    if (!newestReal.has(m.from) && (mediaCount(m) > 0 || !notAQuestion(m.body ?? ""))) newestReal.set(m.from, m)
  }
  const humanSms: Array<Record<string, unknown>> = []
  for (const [from, n] of newest) {
    const at = when(n)
    if (at < cutoff || isTestNumber(from)) continue
    if ((lastOut.get(from) ?? 0) >= at) continue
    const real = newestReal.get(from)
    const m = real && when(real) > (lastOut.get(from) ?? 0) ? real : n
    const mAt = when(m)
    const media = mediaCount(m)
    const body = (m.body ?? "").trim()
    // 挂起中、老板标过「不用回」、或者这条本来就不是问题 —— 一条规则，见
    // lib/lead-hold.ts loadQuiet（老板 2026-09-24：免得一直提醒）。图片没有正文，不走"不是问题"那条。
    if (quiet.quiet(from, mAt, media > 0 ? undefined : body)) continue
    humanSms.push({ kind: "sms", sid: m.sid, from, minutesWaiting: Math.round((now - mAt) / 60_000), body: (body || (media > 0 ? `[${media} image(s)]` : "")).slice(0, 400) })
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

  // ---- pre-party contact (owner 2026-10-07) --------------------------------
  // A booked customer we have not heard from must be reached before the party
  // - the day before at the latest; a party nobody confirmed may not happen.
  // 72h out: a confirmation text. Still silent at 48h: flagged to a person.
  // Still silent the day before: one more text, then an hourly push until
  // someone reaches them by phone. Any inbound text since the window opened
  // counts as reached and ends it. Steps are marked in lead_watch_notified
  // (pc:sent / pc:sent24 / pc:ok), which the inbox reads to show the flags.
  const partyContact: Array<Record<string, unknown>> = []
  const partyCandidates: Candidate[] = []
  if (watch.party_contact_check) {
    type Upcoming = { id: string; order_no: string | null; customer_name: string | null; customer_phone: string | null; event_start: string; event_address: string | null; source_metadata: Record<string, unknown> | null; created_at: string }
    const { data: upcoming } = await supabase
      .from("orders")
      .select("id, order_no, customer_name, customer_phone, event_start, event_address, source_metadata, created_at")
      .eq("order_status", "active")
      .eq("deposit_status", "paid_verified")
      .gte("event_start", instantToWallIso(now))
      .lte("event_start", instantToWallIso(now + (PARTY_CONTACT_FIRST_TEXT_H + 1) * 3600_000))
      .order("event_start", { ascending: true })
      .limit(30)
    const rows = (upcoming ?? []) as Upcoming[]
    const { data: marks } = rows.length
      ? await supabase
          .from("lead_watch_notified")
          .select("key, notified_at")
          .in("key", rows.flatMap((o) => [`pc:ok:${o.id}`, `pc:sent:${o.id}`, `pc:sent24:${o.id}`]))
      : { data: [] as Array<{ key: string; notified_at: string }> }
    const mark = new Map((marks ?? []).map((r) => [r.key as string, new Date(r.notified_at).getTime()]))
    const setMark = async (key: string) => {
      if (dryRun) return
      await supabase.from("lead_watch_notified").upsert({ key, kind: "pc", notified_at: new Date().toISOString() }, { onConflict: "key" })
    }
    for (const o of rows) {
      const phone = toE164(o.customer_phone)
      const start = wallToInstant(o.event_start)
      if (!phone || isTestNumber(phone) || Number.isNaN(start) || mark.has(`pc:ok:${o.id}`)) continue
      const hoursLeft = (start - now) / 3600_000
      const base = { kind: "party_contact", orderId: o.id, orderNo: o.order_no, name: o.customer_name, phone, when: `${shortDate(o.event_start.slice(0, 10))} ${wallTime(o.event_start)}`, hoursLeft: Math.round(hoursLeft) }
      const meta = (o.source_metadata ?? {}) as Record<string, unknown>
      if (meta.event_time_tbd) {
        // No start time on file: the text cannot say when and the day cannot be
        // planned - a person settles it with the customer.
        partyCandidates.push({ key: `pc:tbd:${o.id}`, item: { ...base, stage: "time_tbd", minutesWaiting: 0, summary: "派对时间待定，派对前要和客人定下来" }, urgent: hoursLeft <= PARTY_CONTACT_URGENT_H })
        continue
      }
      const windowStart = start - PARTY_CONTACT_FIRST_TEXT_H * 3600_000
      const inbound = await listTwilio(`From=${encodeURIComponent(phone)}&To=${encodeURIComponent(ours)}&DateSent%3E=${new Date(windowStart).toISOString().slice(0, 10)}`)
      const reached = inbound.some((m) => when(m) >= windowStart)
      const sentFirstAt = mark.get(`pc:sent:${o.id}`)
      const step = partyContactStage({ hoursLeft, sentFirst: sentFirstAt !== undefined, sentSecond: mark.has(`pc:sent24:${o.id}`), reached })
      if (reached) {
        await setMark(`pc:ok:${o.id}`)
        partyContact.push({ ...base, stage: "reached" })
        continue
      }
      if (step === "wait" || step === "past") continue
      // A brand-new order just got the lock confirmation; let that land first.
      if (step === "first_text" && now - new Date(o.created_at).getTime() < PARTY_CONTACT_MIN_ORDER_AGE_MS) continue
      const minutesWaiting = sentFirstAt !== undefined ? Math.round((now - sentFirstAt) / 60_000) : 0
      const text =
        step === "first_text"
          ? partyContactFirstText({ customerName: o.customer_name, eventStart: o.event_start, address: o.event_address, now })
          : step === "urgent_24h" && !mark.has(`pc:sent24:${o.id}`)
            ? partyContactSecondText({ customerName: o.customer_name, eventStart: o.event_start, address: o.event_address, now })
            : null
      if (text) {
        const sms = dryRun ? ({ ok: true, sid: "dry", status: "dry" } as const) : await sendSms(phone, text)
        if (sms.ok) {
          await setMark(step === "first_text" ? `pc:sent:${o.id}` : `pc:sent24:${o.id}`)
          if (!dryRun) await logAutoSms(supabase, phone, sms.sid, text, "party_contact", { order_id: o.id, order_no: o.order_no, stage: step })
        }
        partyContact.push({ ...base, stage: step, sms: sms.ok ? (dryRun ? "dry" : "sent") : sms.error, text })
      }
      // The flag itself (pcf:*) is written by every caller, cron included, so
      // the inbox / desk can show it; pc:48 / pc:24 are the reported-once keys.
      if (step === "flag_48h") {
        await setMark(`pcf:48:${o.id}`)
        partyCandidates.push({ key: `pc:48:${o.id}`, item: { ...base, stage: "flag_48h", minutesWaiting, summary: "72 小时前的确认短信没回，再发一条或打个电话" }, urgent: false })
      } else if (step === "urgent_24h") {
        await setMark(`pcf:24:${o.id}`)
        partyCandidates.push({ key: `pc:24:${o.id}`, item: { ...base, stage: "urgent_24h", minutesWaiting, summary: "明天的派对还没联系上，打电话" }, urgent: true, renotifyMs: PARTY_CONTACT_RENOTIFY_24H_MS })
      }
    }
  }

  // ---- report each open item once (again after two hours; urgent ones every 10 min)
  const candidates: Candidate[] = [
    ...humanLeads.map((h) => ({ key: `lead:${h.leadId}`, item: h, urgent: false })),
    ...humanSms.map((h) => ({ key: `sms:${h.sid}`, item: h, urgent: Number(h.minutesWaiting) >= URGENT_AFTER_MIN })),
    ...partyCandidates,
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
      return now - last >= (c.renotifyMs ?? (c.urgent ? URGENT_RENOTIFY_MS : watch.renotify_minutes * 60_000))
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
    const longWait = (c: Candidate) => (c.key.startsWith("sms:") || c.key.startsWith("lead:")) && Number(c.item.minutesWaiting) >= ESCALATE_LONG_WAIT_MIN
    const due = candidates.filter((c) => (busy && Number(c.item.minutesWaiting) >= watch.escalate_after_minutes) || longWait(c))
    if (due.length > 0) {
      const keys = due.map((c) => `esc:${c.key}`)
      const { data: already } = await supabase.from("lead_watch_notified").select("key, notified_at").in("key", keys)
      const lastAt = new Map((already ?? []).map((r) => [r.key as string, new Date(r.notified_at).getTime()]))
      const fresh = due.filter((c) => {
        const last = lastAt.get(`esc:${c.key}`)
        return last === undefined || now - last >= (busy ? ESCALATE_RENOTIFY_MS : ESCALATE_LONG_RENOTIFY_MS)
      })
      if (fresh.length > 0) {
        const lines = fresh.slice(0, 3).map((c, i) => {
          const it = c.item as Record<string, unknown>
          const wait = `等 ${Number(it.minutesWaiting)} 分`
          if (c.key.startsWith("pc:")) return `${i + 1}. 派对前联系不上 ${String(it.name ?? "") || fmtPhone(String(it.phone ?? ""))}（${String(it.when ?? "")}，确认短信没回）`
          if (c.key.startsWith("sms:")) {
            const body = String(it.body ?? "").replace(/\s+/g, " ").slice(0, 60)
            return `${i + 1}. ${fmtPhone(String(it.from ?? ""))} 问“${body}”（${wait}）`
          }
          const who = [it.city, it.guests ? `${it.guests} 人` : null].filter(Boolean).join(" ")
          return `${i + 1}. 新线索 ${who || fmtPhone(String(it.phone ?? ""))}（${wait}）`
        })
        const more = fresh.length > 3 ? ` 还有 ${fresh.length - 3} 条。` : ""
        const text = `Real Hibachi 值班：${!busy ? "等了 3 小时以上没人回，" : watch.escalate_mode === "always" ? "" : "老板在场上，"}${fresh.length} 位客人等回复。${lines.join(" ")}${more} 工作台：https://www.realhibachi.com/admin/leads`
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

  return { ok: true, dryRun, stage, checkedAt: new Date(now).toISOString(), autoSent, missedCallTexts, partyContact, needsHuman, escalated, stillOpen: candidates.length }
}
