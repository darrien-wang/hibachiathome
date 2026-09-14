import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { readAttributionFromCookieHeader, upsertLeadFromContact } from "@/lib/leads"
import { sendSms, toE164 } from "@/lib/sms-thread"
import { sendCustomerEmail, sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { escapeHtml } from "@/lib/escape-html"
import { DEPOSIT_AMOUNT, TRAVEL_FREE_RADIUS_MILES, calcSimpleEstimate, checkWeekdayEligibility, partySizeDiscountCode } from "@/config/pricing-rules"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// "Text me this quote" on the ad landing pages (决策日志 D-0911-05).
//
// The estimator card used to send visitors to /quote to re-enter everything;
// 8% of paid sessions survived that hop. Now the card itself is the form: one
// phone number, and this route (1) records the lead with its click ids,
// (2) texts the visitor their estimate plus a deposit link from the business
// line, (3) mirrors it by email when they gave one, (4) wakes ops. The price
// is recomputed here from config so the text never disagrees with the site.

const BASE_URL = "https://www.realhibachi.com"
const LIMIT = 6
const WINDOW_SECONDS = 600

type Body = {
  citySlug?: string
  cityName?: string
  source?: string
  adults?: number
  kids?: number
  eventDate?: string
  plan?: "weekday" | "standard"
  travelFee?: number
  phone?: string
  email?: string
  name?: string
  /** Which surface asked: the city landing card (default) or the /quote unlock step. */
  channel?: "website_landing_quote" | "website_quote_unlock"
  /**
   * Landing card, 2026-09-13 (D-0913-08): "contact" is step 1 — save the lead
   * as soon as mobile + email are given, send nothing yet. "quote" (default)
   * is step 2 — text + email the exact price and wake ops.
   */
  stage?: "contact" | "quote"
  pagePath?: string
}

const asStr = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const asInt = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
}
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function describeDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ""
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit("landing-quote", request, LIMIT, WINDOW_SECONDS)
  if (!limited.ok) return tooManyRequests()

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const phoneE164 = toE164(asStr(body.phone, 32))
  if (!phoneE164) return NextResponse.json({ ok: false, error: "phone_invalid" }, { status: 400 })
  // Email is required since 2026-09-13: the exact price and discount code go
  // out on both channels, and T-Mobile is currently rejecting our texts.
  const email = asStr(body.email, 120).toLowerCase()
  if (!email) return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, error: "email_invalid" }, { status: 400 })
  const name = asStr(body.name, 80)
  const leadChannel = body.channel === "website_quote_unlock" ? "website_quote_unlock" : "website_landing_quote"
  const contactOnly = body.stage === "contact"

  const cityName = asStr(body.cityName, 60) || "Southern California"
  const citySlug = asStr(body.citySlug, 60).replace(/[^a-z0-9-]/gi, "") || "socal"
  const source = asStr(body.source, 60) || `landing_${citySlug.replace(/-/g, "_")}`
  const adults = asInt(body.adults, 1, 200)
  const kids = asInt(body.kids, 0, 100)
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(asStr(body.eventDate, 10)) ? asStr(body.eventDate, 10) : ""
  const travelFee = Math.max(0, Math.round(Number(body.travelFee) || 0))

  // Price from config, never from the client. With a date the weekday rate is
  // decided by the real rule (Mon–Thu, blackouts); without one the visitor's
  // pick stands and the text says it is a Mon–Thu price.
  const eligibility = eventDate ? checkWeekdayEligibility(eventDate, { adult: adults, child: kids, toddler: 0 }) : null
  const weekday = eligibility ? eligibility.isEligible : body.plan === "weekday"
  // Same shared calculation as the on-page estimator: tier rate, Party Size
  // Discount, then the $599 floor on every date (the old weekday branch
  // skipped the floor and under-quoted small Mon–Thu parties).
  const est = calcSimpleEstimate({ adults, kids, weekdaySpecial: weekday, travelFee })
  const subtotal = est.subtotal
  const total = est.total
  const planLabel = weekday ? "Weekday Special (Mon–Thu)" : "Standard (any day)"
  const discountCode = est.partySizeDiscountApplied > 0 ? partySizeDiscountCode(adults + kids) : null
  const discountLine = discountCode
    ? `Your code ${discountCode} (-$${est.partySizeDiscountApplied} party size discount) is already in that price and applies automatically when you book.`
    : null

  const attribution = readAttributionFromCookieHeader(request.headers.get("cookie"))
  const pagePath = asStr(body.pagePath, 200) || `/hibachi-at-home/${citySlug}`
  const guestsLine = kids > 0 ? `${adults} adults + ${kids} kids` : `${adults} adults`
  const dateLine = eventDate ? describeDate(eventDate) : "date TBD"

  const supabase = createServerSupabaseClient()
  let leadId: string | null = null
  if (supabase) {
    try {
      const lead = await upsertLeadFromContact(supabase, {
        name,
        phone: phoneE164,
        email,
        reason: "Booking Request",
        message: contactOnly
          ? `Landing contact (${cityName}): gave mobile + email, quote step pending · card default ${guestsLine} · ${planLabel}`
          : `${leadChannel === "website_quote_unlock" ? "Quote unlock" : "Landing quote"} (${cityName}): ${guestsLine} · ${planLabel} · ${dateLine} · est. ${money(total)}${travelFee ? ` incl. ~$${travelFee} travel` : ""}${discountCode ? ` · code ${discountCode}` : ""}`,
        leadSource: source,
        leadChannel,
        leadType: "booking_inquiry",
        cityOrZip: cityName,
        guestCount: adults + kids,
        touchpointType: contactOnly ? "landing_contact" : "landing_quote_text",
        touchpointSource: source,
        sourcePage: pagePath,
        attribution,
        rawPayload: { ...body, phone: phoneE164, computed: { weekday, subtotal, total, travelFee, discountCode, discount: est.partySizeDiscountApplied } },
      })
      leadId = lead.leadId
    } catch (error) {
      console.error("[LEAD_PERSISTENCE_FAILED] landing-quote", { error: error instanceof Error ? error.message : String(error), phoneE164, source })
    }
  }

  // The quote step carries the real party. The contact step saved the card's
  // default (15 adults), and the shared upsert only fills empty fields, so the
  // workbench kept showing 15 guests for an 8-person quote (2026-09-13).
  if (!contactOnly && supabase && leadId) {
    const { error: partyError } = await supabase
      .from("leads")
      .update({ guest_count: adults + kids, city_or_zip: cityName, updated_at: new Date().toISOString() })
      .eq("id", leadId)
    if (partyError) console.error("[landing-quote] party refresh failed", { leadId, error: partyError.message })
  }

  // Step 1 stops here: the lead exists, nothing has been sent. If the visitor
  // never reaches step 2 the daily unanswered-leads report still lists them.
  if (contactOnly) return NextResponse.json({ ok: true, stage: "contact", leadId })

  // Deposit link: the same prefilled /deposit/pay the quote page uses, with
  // the lead id so the paid order links back to this text.
  const dp = new URLSearchParams({
    source: "quote",
    location: cityName,
    adults: String(adults),
    kids: String(kids),
    estimate_low: String(Math.round(total)),
    estimate_high: String(Math.round(total)),
  })
  if (eventDate) dp.set("event_date", eventDate)
  if (email) dp.set("customer_email", email)
  if (leadId) dp.set("lead_id", leadId)
  // Click ids ride along so a deposit paid from the text still attributes;
  // the utm_* set already lives on the lead.
  for (const k of ["gclid", "wbraid", "gbraid", "oppref"] as const) if (attribution[k]) dp.set(k, attribution[k] as string)
  const depositUrl = `${BASE_URL}/deposit/pay?${dp.toString()}`

  const smsBody = [
    `Real Hibachi: your ${cityName} hibachi price is ${money(total)} for ${guestsLine} (${planLabel}${eventDate ? `, ${dateLine}` : ""}).`,
    discountLine,
    travelFee ? `Includes ~$${travelFee} travel (first ${TRAVEL_FREE_RADIUS_MILES} mi free).` : "No travel fee for your area.",
    `Lock your date with a ${money(DEPOSIT_AMOUNT)} refundable deposit: ${depositUrl}`,
    "Reply here with questions - a real person answers. Reply STOP to opt out.",
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ")
  const sms = await sendSms(phoneE164, smsBody)
  if (!sms.ok) console.error("[landing-quote] sms failed", { phoneE164, error: sms.error })

  {
    const lines = [
      `Your ${cityName} hibachi price: ${money(total)}`,
      `${guestsLine} · ${planLabel}${eventDate ? ` · ${dateLine}` : ""}`,
      ...(discountLine ? [discountLine] : []),
      travelFee ? `Includes about $${travelFee} travel.` : "No travel fee for your area.",
      "",
      `Lock your date with a ${money(DEPOSIT_AMOUNT)} refundable deposit: ${depositUrl}`,
      "",
      "Included: chef, mobile teppanyaki grill, 2 proteins per guest, fried rice, vegetables, salad, the live show, setup and cleanup.",
      "Questions? Reply to this email or text (213) 770-7788.",
    ]
    await sendCustomerEmail({
      to: email,
      subject: `Your ${cityName} hibachi quote: ${money(total)}`,
      text: lines.join("\n"),
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#3d2a1c">${lines
        .map((l) => (l ? `<p style="margin:0 0 8px">${escapeHtml(l).replace(depositUrl, `<a href="${depositUrl}">${depositUrl}</a>`)}</p>` : "<br>"))
        .join("")}</div>`,
    })
  }

  const workbench = leadId ? `${BASE_URL}/admin/leads?lead=${leadId}` : `${BASE_URL}/admin/leads`
  await sendSupportNotificationEmail({
    subject: `🔥 Landing quote · ${cityName} · ${guestsLine} · ${money(total)} · ${phoneE164}`,
    text: [
      `Texted the price to ${phoneE164}${sms.ok ? "" : " (SMS FAILED: " + sms.error + ")"}${name ? ` · ${name}` : ""}${discountCode ? ` · ${discountCode}` : ""}.`,
      `${guestsLine} · ${planLabel} · ${dateLine} · ${money(total)}${travelFee ? ` incl ~$${travelFee} travel` : ""}`,
      email ? `Email: ${email}` : "No email given.",
      `Source: ${source} · page ${pagePath}${attribution.gclid ? " · gclid" : ""}${attribution.oppref ? " · ChatGPT click" : ""}`,
      `Workbench: ${workbench}`,
      "Reply within 15 minutes (text or email) - the page promised it.",
    ].join("\n"),
    html: `<p>Texted the estimate to <strong>${escapeHtml(phoneE164)}</strong>${sms.ok ? "" : ` <strong style="color:#b91c1c">(SMS FAILED: ${escapeHtml(sms.error)})</strong>`}.</p>
<p>${escapeHtml(guestsLine)} · ${escapeHtml(planLabel)} · ${escapeHtml(dateLine)} · <strong>${money(total)}</strong>${travelFee ? ` incl ~$${travelFee} travel` : ""}</p>
<p>${email ? `Email: ${escapeHtml(email)}` : "No email given."}<br>Source: ${escapeHtml(source)} · page ${escapeHtml(pagePath)}${attribution.gclid ? " · gclid" : ""}${attribution.oppref ? " · ChatGPT click" : ""}</p>
<p><a href="${workbench}">Open in workbench</a> · <strong>Reply within 15 minutes</strong> (text or email) - the page promised it.</p>`,
  })

  return NextResponse.json({
    ok: true,
    leadId,
    smsDelivered: sms.ok,
    emailed: Boolean(email),
    total,
    weekday,
    depositUrl,
    discountCode,
    discount: est.partySizeDiscountApplied,
  })
}
