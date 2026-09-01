import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { upsertLeadFromContact } from "@/lib/leads"

export const dynamic = "force-dynamic"

// A tap on the quote page's SMS/WhatsApp button carries the full quote but no
// contact info yet. Logging it instantly gives the workbench (and its alert
// sound) a head start — pre-port, the actual text lands only on the owner's
// phone, and this was worth 15 minutes of response time on the first real lead.
export async function POST(request: NextRequest) {
  let body: {
    channel?: string
    summary?: string
    guests?: number
    eventDate?: string
    location?: string
    referralCode?: string
    hearAboutUs?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const channel = body.channel === "whatsapp" ? "whatsapp" : "sms"
  const summary = String(body.summary ?? "").slice(0, 1500)
  const guests = Number(body.guests) || 0
  const eventDate = String(body.eventDate ?? "").slice(0, 20)
  const location = String(body.location ?? "").slice(0, 80)
  const referralCode = String(body.referralCode ?? "").toUpperCase().replace(/\s+/g, "").slice(0, 32) || undefined
  const hearAboutUs = String(body.hearAboutUs ?? "").slice(0, 64) || undefined
  if (!summary && !guests) {
    return NextResponse.json({ error: "empty intent" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  try {
    const result = await upsertLeadFromContact(supabase, {
      name: `⚡ ${channel.toUpperCase()} intent — awaiting message`,
      message: [
        `Tapped ${channel} with this quote (no contact info yet — check the phone!):`,
        summary,
        referralCode ? `Referral code: ${referralCode}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      leadSource: `quote_${channel}_intent`,
      leadChannel: channel,
      cityOrZip: location || undefined,
      guestCount: guests || undefined,
      touchpointType: "contact_intent",
      touchpointSource: "quote_page",
      referralCode,
      hearAboutUs,
      rawPayload: { channel, guests, eventDate, location, referralCode, hearAboutUs },
    })
    return NextResponse.json({ ok: true, leadId: result.leadId })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
