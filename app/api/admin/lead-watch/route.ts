import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"

import { calcSimpleEstimate } from "@/config/pricing-rules"
import { escapeHtml } from "@/lib/escape-html"
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

async function isAuthorized(request: NextRequest): Promise<boolean> {
  return (await resolveAdminActor(request)) !== null
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
    `For ${guests}${where} it's ${money(weekend)} total Fri-Sun or ${money(weekday)} Mon-Thu${travelSms} ` +
    `(2 proteins each + fried rice, veggies, salad and the chef show). What date are you thinking?`
  const emailText = [
    "Hi there,",
    "",
    "Bling here from Real Hibachi. You left your number and email on our site a few minutes ago and our system should have texted you a price right away - it didn't, sorry about that. Here it is:",
    "",
    `- ${guests}, Fri-Sun: ${money(weekend)} total`,
    `- Same party Mon-Thu: ${money(weekday)} (+ a free appetizer platter)`,
    travel > 0 ? `- Travel${city ? ` to ${city}` : ""}: about $${travel}` : `- ${city || "Your area"}: no travel fee`,
    "- Includes 2 proteins per guest, fried rice, veggies, salad and the chef show. Kids 5-12 are $29.90, under 5 eat free.",
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

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const dryRun = request.nextUrl.searchParams.get("dry") === "1"
  const now = Date.now()
  const watch = (await getWorkbenchSettings()).lead_watch
  if (!watch.enabled) {
    return NextResponse.json({ ok: true, dryRun, disabled: true, checkedAt: new Date(now).toISOString(), autoSent: [], needsHuman: [], stillOpen: 0 })
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
      autoSent.push({ leadId: lead.id, phone, email: lead.email, city: lead.city_or_zip, minutesWaiting: ageMin, sms: sms.ok ? "sent" : sms.error, email: email?.delivered ? "sent" : "no", reached })
      continue
    }

    // Any other uncontacted lead needs a person.
    humanLeads.push({ kind: "lead", leadId: lead.id, name: lead.full_name, phone, email: lead.email, city: lead.city_or_zip, source: lead.lead_source, guests: lead.guest_count, minutesWaiting: ageMin, summary: lead.latest_message })
  }

  // ---- customer texts nobody answered ------------------------------------
  const ours = ourSmsNumber()
  const cutoff = now - SMS_LOOKBACK_HOURS * 3600_000
  const [inbound, outbound] = await Promise.all([listTwilio(`To=${encodeURIComponent(ours)}`), listTwilio(`From=${encodeURIComponent(ours)}`)])
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
    // Tapbacks ("Liked "...", "Loved "...") and opt-outs are not questions.
    if (/^(liked|loved|laughed at|emphasized|disliked|questioned)\s/i.test(body) || /^(stop|unsubscribe)$/i.test(body)) continue
    humanSms.push({ kind: "sms", sid: m.sid, from: m.from, minutesWaiting: Math.round((now - at) / 60_000), body: body.slice(0, 400) })
  }

  // ---- report each open item once (again after two hours) ---------------
  const candidates = [...humanLeads.map((h) => ({ key: `lead:${h.leadId}`, item: h })), ...humanSms.map((h) => ({ key: `sms:${h.sid}`, item: h }))]
  let needsHuman = candidates.map((c) => c.item)
  if (candidates.length > 0) {
    const { data: already } = await supabase
      .from("lead_watch_notified")
      .select("key, notified_at")
      .in("key", candidates.map((c) => c.key))
    const recent = new Set(
      (already ?? []).filter((r) => now - new Date(r.notified_at).getTime() < watch.renotify_minutes * 60_000).map((r) => r.key),
    )
    const fresh = candidates.filter((c) => !recent.has(c.key))
    needsHuman = fresh.map((c) => c.item)
    if (!dryRun && fresh.length > 0) {
      await supabase
        .from("lead_watch_notified")
        .upsert(fresh.map((c) => ({ key: c.key, kind: c.key.split(":")[0], notified_at: new Date().toISOString() })), { onConflict: "key" })
    }
  }

  return NextResponse.json({ ok: true, dryRun, checkedAt: new Date(now).toISOString(), autoSent, needsHuman, stillOpen: candidates.length })
}
