import { NextResponse } from "next/server"
import { Resend } from "resend"

import { upsertLeadFromContact, readAttributionFromCookieHeader } from "@/lib/leads"
import { sendSupportNotificationEmail, isOpsEmailEffectivelyHandled } from "@/lib/ops-notifications"
import { createServerSupabaseClient } from "@/lib/supabase"

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function readNonEmptyEnv(name: string): string | undefined {
  const raw = process.env[name]
  if (typeof raw !== "string") {
    return undefined
  }

  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeLowercase(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

function readBooleanFlag(name: string): boolean {
  const normalized = normalizeLowercase(readNonEmptyEnv(name))
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function shouldSuppressExternalNotificationsForCustomer(): boolean {
  return (
    readBooleanFlag("SUPPRESS_EXTERNAL_NOTIFICATIONS")
    || normalizeLowercase(readNonEmptyEnv("VERCEL_ENV")) === "preview"
    || normalizeLowercase(readNonEmptyEnv("VERCEL_GIT_COMMIT_REF")) === "pre"
  )
}

function resolvePathFromReferer(value: string | null): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return `${url.pathname}${url.search || ""}`
  } catch {
    return undefined
  }
}

async function persistBookingRequestFallback(params: {
  customerName: string
  customerEmail: string
  customerPhone: string
  eventDate: string
  eventTime: string
  location: string
  adults: number
  kids: number
  estimateHigh: number
  supportText: string
}) {
  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return {
      persisted: false,
      error: "Booking fallback persistence is unavailable",
    }
  }

  const specialRequests = [
    "Website booking request without deposit",
    "source=quote_book_online",
    params.supportText,
  ].join(" | ")

  const bookingPayload = {
    full_name: params.customerName,
    email: params.customerEmail,
    phone: params.customerPhone,
    address: params.location,
    zip_code: "00000",
    event_date: params.eventDate,
    event_time: params.eventTime,
    guest_adults: params.adults,
    guest_kids: params.kids,
    price_adult: 0,
    price_kid: 0,
    travel_fee: 0,
    premium_proteins: [],
    add_ons: [],
    special_requests: specialRequests,
    total_cost: Math.round(Math.max(0, params.estimateHigh)),
    status: "pending",
    deposit: 0,
    deposit_amount: 0,
    deposit_status: "pending" as const,
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert(bookingPayload)
    .select("id")
    .single()

  if (error || !data) {
    return {
      persisted: false,
      error: error?.message || "Failed to persist booking request fallback.",
    }
  }

  return {
    persisted: true,
    bookingId: String(data.id),
  }
}

async function sendCustomerBookingConfirmationEmail(params: {
  customerEmail: string
  customerName: string
  eventDate: string
  eventTime: string
  location: string
  adults: number
  kids: number
  estimateLow: number
  estimateHigh: number
  pricingTierLabel: string
}) {
  const from = process.env.EMAIL_FROM?.trim() || "support@realhibachi.com"
  const resendApiKey = process.env.RESEND_API_KEY?.trim()

  if (!resendApiKey) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "resend_not_configured",
    }
  }

  if (shouldSuppressExternalNotificationsForCustomer()) {
    console.log("[booking-request] Preview mode: customer confirmation email suppressed.", {
      to: params.customerEmail,
      eventDate: params.eventDate,
      location: params.location,
    })
    return {
      attempted: false,
      delivered: false,
      skippedReason: "preview_mode_logged",
      mode: "logged" as const,
    }
  }

  const subject = "Real Hibachi booking request received"
  const text = [
    `Hi ${params.customerName},`,
    "",
    "Your booking request has been received.",
    "We will contact you as soon as possible to confirm menu details, chef availability, and the remaining booking steps.",
    "",
    `Event Date: ${params.eventDate}`,
    `Event Time: ${params.eventTime}`,
    `Location: ${params.location}`,
    `Guests: ${params.adults} adults, ${params.kids} kids`,
    `Pricing Tier: ${params.pricingTierLabel}`,
    `Estimated Range: $${params.estimateLow.toFixed(0)} - $${params.estimateHigh.toFixed(0)}`,
    "",
    "If you need anything in the meantime, reply to this email or contact support@realhibachi.com.",
    "",
    "Real Hibachi",
  ].join("\n")

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>Hi ${params.customerName},</p>
      <p>Your booking request has been received.</p>
      <p>We will contact you as soon as possible to confirm menu details, chef availability, and the remaining booking steps.</p>
      <div style="margin: 20px 0; padding: 16px; border: 1px solid #d1d5db; border-radius: 16px; background: #f8fafc;">
        <p><strong>Event Date:</strong> ${params.eventDate}</p>
        <p><strong>Event Time:</strong> ${params.eventTime}</p>
        <p><strong>Location:</strong> ${params.location}</p>
        <p><strong>Guests:</strong> ${params.adults} adults, ${params.kids} kids</p>
        <p><strong>Pricing Tier:</strong> ${params.pricingTierLabel}</p>
        <p><strong>Estimated Range:</strong> $${params.estimateLow.toFixed(0)} - $${params.estimateHigh.toFixed(0)}</p>
      </div>
      <p>If you need anything in the meantime, reply to this email or contact <a href="mailto:support@realhibachi.com">support@realhibachi.com</a>.</p>
      <p>Real Hibachi</p>
    </div>
  `

  try {
    const resend = new Resend(resendApiKey)
    const { data, error } = await resend.emails.send({
      from,
      to: [params.customerEmail],
      subject,
      text,
      html,
      reply_to: "support@realhibachi.com",
    })

    if (error) {
      return {
        attempted: true,
        delivered: false,
        error: error.message || "customer_confirmation_send_failed",
      }
    }

    return {
      attempted: true,
      delivered: true,
      providerMessageId: data?.id,
      mode: "sent" as const,
    }
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      error: error instanceof Error ? error.message : "customer_confirmation_send_failed",
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>

    const customerName = asString(body.customerName)
    const customerEmail = asString(body.customerEmail)
    const customerPhone = asString(body.customerPhone)
    const eventDate = asString(body.eventDate)
    const eventTime = asString(body.eventTime)
    const location = asString(body.location)
    const pricingTierLabel = asString(body.pricingTierLabel)
    const estimateLow = asNumber(body.estimateLow)
    const estimateHigh = asNumber(body.estimateHigh)
    const adults = asNumber(body.adults)
    const kids = asNumber(body.kids)
    const quoteSummary = asString(body.quoteSummary)
    const leadSource = asString(body.leadSource) || "quote_builder"
    const premiumUpgrades = Array.isArray(body.premiumUpgrades)
      ? body.premiumUpgrades.map((value) => String(value)).filter(Boolean)
      : []
    const tablewareRental = asBoolean(body.tablewareRental)
    const tent10x10 = asBoolean(body.tent10x10)

    if (
      !customerName ||
      !customerEmail ||
      !customerPhone ||
      !eventDate ||
      !eventTime ||
      !location ||
      !pricingTierLabel ||
      estimateLow === undefined ||
      estimateHigh === undefined ||
      adults === undefined ||
      kids === undefined
    ) {
      return NextResponse.json({ success: false, error: "Missing required booking request fields." }, { status: 400 })
    }

    const supportText = [
      "New website booking request submitted.",
      "",
      `Customer: ${customerName}`,
      `Email: ${customerEmail}`,
      `Phone: ${customerPhone}`,
      `Event Date: ${eventDate}`,
      `Event Time: ${eventTime}`,
      `Location: ${location}`,
      `Guests: ${adults} adults, ${kids} kids`,
      `Pricing Tier: ${pricingTierLabel}`,
      `Estimated Range: $${estimateLow.toFixed(0)} - $${estimateHigh.toFixed(0)}`,
      `Tableware Rental: ${tablewareRental ? "Yes" : "No"}`,
      `10'x10' Tent: ${tent10x10 ? "Yes" : "No"}`,
      `Premium Upgrades: ${premiumUpgrades.length > 0 ? premiumUpgrades.join(", ") : "None"}`,
      "",
      `Quote Summary: ${quoteSummary || "N/A"}`,
      "",
      "No deposit was collected. Please contact this customer to finalize the booking.",
    ].join("\n")

    const supportHtml = `
      <h2>New Website Booking Request</h2>
      <p><strong>Customer:</strong> ${customerName}</p>
      <p><strong>Email:</strong> ${customerEmail}</p>
      <p><strong>Phone:</strong> ${customerPhone}</p>
      <p><strong>Event Date:</strong> ${eventDate}</p>
      <p><strong>Event Time:</strong> ${eventTime}</p>
      <p><strong>Location:</strong> ${location}</p>
      <p><strong>Guests:</strong> ${adults} adults, ${kids} kids</p>
      <p><strong>Pricing Tier:</strong> ${pricingTierLabel}</p>
      <p><strong>Estimated Range:</strong> $${estimateLow.toFixed(0)} - $${estimateHigh.toFixed(0)}</p>
      <p><strong>Tableware Rental:</strong> ${tablewareRental ? "Yes" : "No"}</p>
      <p><strong>10'x10' Tent:</strong> ${tent10x10 ? "Yes" : "No"}</p>
      <p><strong>Premium Upgrades:</strong> ${premiumUpgrades.length > 0 ? premiumUpgrades.join(", ") : "None"}</p>
      <p><strong>Quote Summary:</strong> ${quoteSummary || "N/A"}</p>
      <p><strong>Next Step:</strong> No deposit was collected. Please contact this customer to finalize the booking.</p>
    `

    const supportNotification = await sendSupportNotificationEmail({
      subject: "Website Booking Request",
      text: supportText,
      html: supportHtml,
      replyTo: customerEmail,
    })

    const customerConfirmation = await sendCustomerBookingConfirmationEmail({
      customerEmail,
      customerName,
      eventDate,
      eventTime,
      location,
      adults,
      kids,
      estimateLow,
      estimateHigh,
      pricingTierLabel,
    })

    let leadResult: Awaited<ReturnType<typeof upsertLeadFromContact>> | null = null
    let leadPersistenceError: string | null = null
    let bookingFallback:
      | {
          persisted: boolean
          bookingId?: string
          error?: string
        }
      | null = null
    const supabase = createServerSupabaseClient()

    if (supabase) {
      try {
        leadResult = await upsertLeadFromContact(supabase, {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          reason: "Booking Request",
          message: supportText,
          leadSource,
          leadChannel: "website_booking_request",
          leadType: "booking_inquiry",
          cityOrZip: location,
          guestCount: adults + kids,
          touchpointType: "quote_book_online",
          touchpointSource: leadSource,
          sourcePage: resolvePathFromReferer(request.headers.get("referer")),
          attribution: readAttributionFromCookieHeader(request.headers.get("cookie")),
          rawPayload: body,
        })
      } catch (error) {
        leadPersistenceError = error instanceof Error ? error.message : String(error)
      }
    } else {
      leadPersistenceError = "Lead persistence is unavailable"
    }

    if (!leadResult) {
      bookingFallback = await persistBookingRequestFallback({
        customerName,
        customerEmail,
        customerPhone,
        eventDate,
        eventTime,
        location,
        adults,
        kids,
        estimateHigh,
        supportText,
      })
    }

    if (!isOpsEmailEffectivelyHandled(supportNotification) && !leadResult && !bookingFallback?.persisted) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to notify support.",
          supportNotification,
          customerConfirmation,
          leadPersistenceError,
          bookingFallback,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      supportNotification,
      customerConfirmation,
      leadId: leadResult?.leadId ?? null,
      leadDeduped: leadResult?.deduped ?? false,
      leadPersistence: {
        persisted: Boolean(leadResult),
        error: leadPersistenceError,
      },
      bookingFallback,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process booking request.",
      },
      { status: 500 },
    )
  }
}
