import { NextRequest, NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { getDrivingMiles } from "@/lib/travel-distance"
import { toE164 } from "@/lib/sms-thread"
import { calcTravelFee } from "@/config/pricing-rules"
import { POST as landingQuote } from "@/app/api/landing-quote/route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Quote request submitted by an AI agent on a customer's behalf (决策日志
// D-0917-06; owner approved agent submissions 2026-09-17).
//
// It is the landing-page "text me this quote" flow with a stable, documented
// contract in front: the lead is saved with lead_channel=ai_agent, the
// customer gets the exact price and a deposit link by text and email, and ops
// is woken to follow up. Payment always stays with the customer.
//
// Because this texts whatever number it is given, it demands the agent's
// explicit statement that the customer asked for it, and throttles per phone
// number as well as per IP.

const ORIGIN_ZIP = process.env.TRAVEL_ORIGIN_ADDRESS ?? "91744"

type Body = {
  name?: unknown
  phone?: unknown
  email?: unknown
  adults?: unknown
  kids?: unknown
  under5?: unknown
  date?: unknown
  zip?: unknown
  city?: unknown
  notes?: unknown
  agent?: unknown
  customerConsent?: unknown
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const int = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v ?? 0))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
}
const bad = (error: string, message: string) => NextResponse.json({ ok: false, error, message }, { status: 400 })

function todayLA(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date())
}

/** The limiter buckets by client IP; this lets it bucket by phone number instead. */
function keyedRequest(key: string): Request {
  return new Request("https://internal.invalid/", { headers: { "x-forwarded-for": key } })
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit("agent-quote", request, 30, 3600)
  if (!limited.ok) {
    const { status, body } = tooManyRequests()
    return NextResponse.json(body, { status })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return bad("invalid_json", "Send a JSON body.")
  }

  if (body.customerConsent !== true) {
    return bad(
      "consent_required",
      "Set customerConsent to true only if the customer asked you to request this quote and agreed to be texted and emailed by Real Hibachi.",
    )
  }
  const name = str(body.name, 80)
  if (!name) return bad("name_required", "The customer's name is required.")
  const phoneE164 = toE164(str(body.phone, 32))
  if (!phoneE164) return bad("phone_invalid", "A valid US mobile number is required; the quote is texted to it.")
  const email = str(body.email, 120).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("email_invalid", "A valid email is required; the quote is emailed too.")
  const adults = int(body.adults, 0, 200)
  const kids = int(body.kids, 0, 100)
  const under5 = int(body.under5, 0, 100)
  if (adults + kids < 1) return bad("adults_required", "Pass adults (13+), and kids (5-12) / under5 if any.")
  const date = str(body.date, 10)
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("date_invalid", "Use YYYY-MM-DD.")
  if (date && date < todayLA()) return bad("date_past", "That date has already passed.")
  const zip = str(body.zip, 5)
  if (zip && !/^\d{5}$/.test(zip)) return bad("zip_invalid", "Use a 5-digit US ZIP code.")
  const agent = str(body.agent, 40).replace(/[^\w .-]/g, "") || "unknown"
  const notes = str(body.notes, 600)

  const perPhone = await rateLimit("agent-quote-phone", keyedRequest(phoneE164), 2, 3600)
  if (!perPhone.ok) {
    return NextResponse.json(
      { ok: false, error: "already_sent", message: "A quote was already sent to this number in the last hour. The customer can reply to that text, or call (213) 770-7788." },
      { status: 429 },
    )
  }

  let travelFee = 0
  let city = str(body.city, 60)
  if (zip) {
    try {
      const r = await getDrivingMiles(ORIGIN_ZIP, zip)
      travelFee = Math.round(calcTravelFee(r.drivingMiles))
      // label reads "92618, Orange County Great Park, Irvine, Orange County, ..."
      if (!city) city = r.destination.label.split(",").map((s) => s.trim()).find((s) => s && !/^\d/.test(s) && !/park|county/i.test(s)) ?? ""
    } catch {
      // unmeasurable: quote without travel and let the team confirm it
    }
  }

  const noteLines = [
    `Submitted by AI agent: ${agent}.`,
    under5 ? `Also ${under5} kid(s) under 5 (eat free).` : "",
    zip ? `ZIP ${zip}.` : "",
    notes ? `Notes: ${notes}` : "",
  ].filter(Boolean)

  // Hand off to the landing-quote flow: same price rules, same text + email,
  // same lead record and ops alert.
  // Its IP limit is keyed to the customer's number, not the caller: agent
  // platforms send many different people's requests from a few data-center
  // IPs, so counting by IP would turn away real customers.
  const headers = new Headers({ "content-type": "application/json", "x-forwarded-for": `agent-${phoneE164}` })
  const ua = request.headers.get("user-agent")
  if (ua) headers.set("user-agent", ua)
  const forwarded = new NextRequest(new URL("/api/landing-quote", request.url), {
    method: "POST",
    headers,
    body: JSON.stringify({
      channel: "ai_agent",
      stage: "quote",
      source: `ai_agent_${agent.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`.slice(0, 60),
      cityName: city || "Southern California",
      citySlug: "socal",
      pagePath: "/api/agent/quote-request",
      name,
      phone: phoneE164,
      email,
      adults,
      kids,
      eventDate: date,
      travelFee,
      notes: noteLines.join(" "),
    }),
  })
  const res = await landingQuote(forwarded)
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok || data.ok !== true) {
    return NextResponse.json(
      { ok: false, error: String(data.error ?? "failed"), message: "Could not submit the request. The customer can call or text (213) 770-7788." },
      { status: res.status >= 400 ? res.status : 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    total: data.total,
    weekdaySpecial: data.weekday,
    partySizeDiscount: data.discount,
    textedToCustomer: data.smsDelivered,
    emailedToCustomer: data.emailed,
    depositUrl: data.depositUrl,
    message: `Sent. The customer now has the exact price and a secure deposit link by ${
      data.smsDelivered ? "text and email" : "email (the text to that number did not go through, so check it with them)"
    }, and a real person will follow up. Share depositUrl only with the customer; they pay it themselves.`,
  })
}
