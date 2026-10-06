import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { readAttributionFromCookieHeader, upsertLeadFromContact } from "@/lib/leads"
import { sendSms, toE164 } from "@/lib/sms-thread"
import { sendCustomerEmail, sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { escapeHtml } from "@/lib/escape-html"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The party planner's "unlock" moment (决策日志 D-0916-01).
//
// The planner used to ask for a name and a phone number before showing
// anything, and in its whole life that door produced two leads. Now a cold
// visitor plans first and sees a price range; the exact price, the Party Size
// Discount code and a link back to their party are what they trade their
// contact details for. This route is the other half of that trade: it records
// the lead, texts and emails the three things we promised, and wakes ops.
//
// It is server-to-server only. The planner app computes the exact total from
// the full plan (proteins, add-ons, weekday rules) with the same pricing code
// the invoice uses, mints the private link, and calls here with the shared
// admin token - so the figure in the text is ours, never the browser's.
//
// No deposit link in these messages (D-0913-01): the deposit comes up in
// conversation, or inside the planner after the menu is confirmed.

const BASE_URL = "https://www.realhibachi.com"

type Body = {
  name?: string
  phone?: string
  email?: string
  eventDate?: string
  adults?: number
  kids?: number
  littles?: number
  babies?: number
  pickedCount?: number
  total?: number
  discountCode?: string | null
  discountAmount?: number
  weekday?: boolean
  plannerUrl?: string
  /** What the visitor was reaching for when the card came up: price | share | save | confirm */
  intent?: string
  attribution?: Record<string, unknown>
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
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

// lib/leads keeps its attribution type private; borrow it from the reader.
type AttributionFields = ReturnType<typeof readAttributionFromCookieHeader>

const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "wbraid", "gbraid", "oppref"] as const

function cleanAttribution(raw: Record<string, unknown> | undefined): AttributionFields {
  const out: Record<string, string> = {}
  if (!raw) return out as AttributionFields
  for (const key of ATTRIBUTION_KEYS) {
    const v = asStr(raw[key], 200)
    if (v) out[key] = v
  }
  return out as AttributionFields
}

export async function POST(request: NextRequest) {
  const expected = process.env.INVOICE_UPDATE_ADMIN_TOKEN?.trim()
  const provided = request.headers.get("x-admin-token")?.trim()
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const phoneE164 = toE164(asStr(body.phone, 32))
  if (!phoneE164) return NextResponse.json({ ok: false, error: "phone_invalid" }, { status: 400 })
  const email = asStr(body.email, 120).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, error: "email_invalid" }, { status: 400 })
  const name = asStr(body.name, 80)
  if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 })

  const plannerUrl = asStr(body.plannerUrl, 300)
  if (!/^https:\/\/party\.realhibachi\.com\/order\?key=ok_[a-z0-9]+$/i.test(plannerUrl)) {
    return NextResponse.json({ ok: false, error: "planner_url_invalid" }, { status: 400 })
  }
  const total = Number(body.total)
  if (!Number.isFinite(total) || total <= 0) return NextResponse.json({ ok: false, error: "total_invalid" }, { status: 400 })

  const adults = asInt(body.adults, 0, 200)
  const kids = asInt(body.kids, 0, 100)
  const littles = asInt(body.littles, 0, 100)
  const babies = asInt(body.babies, 0, 100)
  const pickedCount = asInt(body.pickedCount, 0, 400)
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(asStr(body.eventDate, 10)) ? asStr(body.eventDate, 10) : ""
  const discountCode = /^PARTY\d{2,3}$/.test(asStr(body.discountCode, 12)) ? asStr(body.discountCode, 12) : null
  const discountAmount = Math.max(0, Math.round(Number(body.discountAmount) || 0))
  const weekday = body.weekday === true
  const intent = asStr(body.intent, 20) || "price"
  const attribution = cleanAttribution(body.attribution)

  const eaters = adults + kids + littles
  const guestParts = [
    `${adults} adults`,
    kids ? `${kids} kids` : "",
    littles ? `${littles} under 5` : "",
    babies ? `${babies} babies` : "",
  ].filter(Boolean)
  const guestsLine = guestParts.join(" + ")
  const dateLine = eventDate ? describeDate(eventDate) : "date TBD"
  const discountLine = discountCode
    ? `Your code ${discountCode} (-$${discountAmount} party size discount) is already in that price and applies automatically when you book.`
    : null

  const supabase = createServerSupabaseClient()
  let leadId: string | null = null
  if (supabase) {
    try {
      // "Date: …" and "Estimated total: …" are the exact shapes the workbench
      // reply scripts parse, so the first-response draft fills itself in.
      const lead = await upsertLeadFromContact(supabase, {
        name,
        phone: phoneE164,
        email,
        reason: "Booking Request",
        message: [
          `Planner unlock (${intent}): ${guestsLine}`,
          eventDate ? `Date: ${eventDate}` : "date TBD",
          `Estimated total: ${money(total)}${weekday ? " (Weekday Special)" : ""}`,
          discountCode ? `code ${discountCode}` : "",
          `${pickedCount}/${eaters} guests have picked proteins`,
          `Plan: ${plannerUrl}`,
        ]
          .filter(Boolean)
          .join(" · "),
        leadSource: "order_planner",
        leadChannel: "planner_unlock",
        leadType: "booking_inquiry",
        guestCount: eaters,
        touchpointType: "planner_unlock",
        touchpointSource: "order_planner",
        sourcePage: "/order",
        attribution,
        rawPayload: { ...body, phone: phoneE164 },
      })
      leadId = lead.leadId
    } catch (error) {
      console.error("[LEAD_PERSISTENCE_FAILED] planner-unlock", {
        error: error instanceof Error ? error.message : String(error),
        phoneE164,
      })
    }
  }

  // The shared upsert only fills empty fields; a returning lead who has since
  // redesigned their party should show today's headcount, not last week's.
  if (supabase && leadId && eaters > 0) {
    const { error: partyError } = await supabase
      .from("leads")
      .update({ guest_count: eaters, updated_at: new Date().toISOString() })
      .eq("id", leadId)
    if (partyError) console.error("[planner-unlock] party refresh failed", { leadId, error: partyError.message })
  }

  const smsBody = [
    `Real Hibachi: your party is saved. ${guestsLine}${eventDate ? `, ${dateLine}` : ""} - exact price ${money(total)}${weekday ? " (Weekday Special)" : ""}.`,
    discountLine,
    `Keep planning, or send this to your guests so they pick their own seats and proteins: ${plannerUrl}`,
    "Reply here with any question - a real person answers. Reply STOP to opt out.",
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ")
  const sms = await sendSms(phoneE164, smsBody)
  if (!sms.ok) console.error("[planner-unlock] sms failed", { phoneE164, error: sms.error })

  const first = name.split(/\s+/)[0]
  const emailLines = [
    `Hi ${first},`,
    "",
    `Your party is saved: ${guestsLine}${eventDate ? ` · ${dateLine}` : ""}.`,
    `Exact price: ${money(total)}${weekday ? " (Weekday Special)" : ""}`,
    ...(discountLine ? [discountLine] : []),
    "",
    "Your private party link - open it on any device, keep designing, or send it to your guests so everyone grabs a seat and picks their own proteins:",
    plannerUrl,
    "",
    "Included: chef, mobile teppanyaki grill, 2 proteins per guest, fried rice, vegetables, salad, the live show, setup and cleanup.",
    "Questions? Reply to this email or text (213) 770-7788 - a real person answers.",
    "",
    "Real Hibachi",
  ]
  const emailResult = await sendCustomerEmail({
    to: email,
    subject: `Your hibachi party is saved - ${money(total)}`,
    text: emailLines.join("\n"),
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#3d2a1c">${emailLines
      .map((l) => (l ? `<p style="margin:0 0 8px">${escapeHtml(l).replace(escapeHtml(plannerUrl), `<a href="${plannerUrl}">${escapeHtml(plannerUrl)}</a>`)}</p>` : "<br>"))
      .join("")}</div>`,
  })

  const workbench = leadId ? `${BASE_URL}/admin/leads?lead=${leadId}` : `${BASE_URL}/admin/leads`
  await sendSupportNotificationEmail({
    subject: `🎪 Planner unlock · ${guestsLine} · ${money(total)} · ${phoneE164}`,
    text: [
      `${name} designed a party in the planner and unlocked the exact price (${intent}).`,
      `${guestsLine} · ${dateLine} · ${money(total)}${weekday ? " (Weekday Special)" : ""}${discountCode ? ` · ${discountCode}` : ""}`,
      `${pickedCount}/${eaters} guests have proteins picked.`,
      `Phone: ${phoneE164}${sms.ok ? "" : " (SMS FAILED: " + sms.error + ")"} · Email: ${email}`,
      `Their plan: ${plannerUrl}`,
      `Workbench: ${workbench}`,
      "They already have the price and their link. A short, warm hello while they are still playing with it lands best.",
    ].join("\n"),
    html: `<p><strong>${escapeHtml(name)}</strong> designed a party in the planner and unlocked the exact price (${escapeHtml(intent)}).</p>
<p>${escapeHtml(guestsLine)} · ${escapeHtml(dateLine)} · <strong>${money(total)}</strong>${weekday ? " (Weekday Special)" : ""}${discountCode ? ` · ${escapeHtml(discountCode)}` : ""}<br>${pickedCount}/${eaters} guests have proteins picked.</p>
<p>Phone: ${escapeHtml(phoneE164)}${sms.ok ? "" : ` <strong style="color:#b91c1c">(SMS FAILED: ${escapeHtml(sms.error)})</strong>`} · Email: ${escapeHtml(email)}</p>
<p><a href="${plannerUrl}">Open their plan</a> · <a href="${workbench}">Open in workbench</a></p>
<p>They already have the price and their link. A short, warm hello while they are still playing with it lands best.</p>`,
  })

  return NextResponse.json({
    ok: true,
    leadId,
    smsDelivered: sms.ok,
    emailed: emailResult.delivered === true,
  })
}
