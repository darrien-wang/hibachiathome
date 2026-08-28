import { NextResponse } from "next/server"
import { Resend } from "resend"

import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { escapeHtml } from "@/lib/escape-html"

import { trackBookingSubmitServer } from "@/lib/ga4-measurement-protocol"
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

function resolveUrlFromReferer(value: string | null): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.toString()
  } catch {
    return undefined
  }
}

function readCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined
  const prefix = `${name}=`
  const entry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  if (!entry) return undefined

  try {
    return decodeURIComponent(entry.slice(prefix.length))
  } catch {
    return entry.slice(prefix.length)
  }
}

function readGaClientId(cookieHeader: string | null): string | undefined {
  const raw = readCookieValue(cookieHeader, "_ga")
  if (!raw) return undefined

  const parts = raw.split(".")
  if (parts.length >= 4 && /^\d+$/.test(parts[2]) && /^\d+$/.test(parts[3])) {
    return `${parts[2]}.${parts[3]}`
  }

  if (/^\d+\.\d+$/.test(raw)) {
    return raw
  }

  return undefined
}

function readGaSessionId(cookieHeader: string | null): string | undefined {
  const measurementId =
    readNonEmptyEnv("GA4_MEASUREMENT_ID") ?? readNonEmptyEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID") ?? "G-9852R0HD0R"
  const cookieName = `_ga_${measurementId.replace(/^G-/, "")}`
  const raw = readCookieValue(cookieHeader, cookieName)
  if (!raw) return undefined

  const gs2SessionMatch = raw.match(/(?:^|[.$])s(\d+)(?:[$.]|$)/)
  if (gs2SessionMatch?.[1]) {
    return gs2SessionMatch[1]
  }

  const parts = raw.split(".")
  if (parts.length >= 3 && /^\d+$/.test(parts[2])) {
    return parts[2]
  }

  return undefined
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
      <p>Hi ${escapeHtml(params.customerName)},</p>
      <p>Your booking request has been received.</p>
      <p>We will contact you as soon as possible to confirm menu details, chef availability, and the remaining booking steps.</p>
      <div style="margin: 20px 0; padding: 16px; border: 1px solid #d1d5db; border-radius: 16px; background: #f8fafc;">
        <p><strong>Event Date:</strong> ${escapeHtml(params.eventDate)}</p>
        <p><strong>Event Time:</strong> ${escapeHtml(params.eventTime)}</p>
        <p><strong>Location:</strong> ${escapeHtml(params.location)}</p>
        <p><strong>Guests:</strong> ${params.adults} adults, ${params.kids} kids</p>
        <p><strong>Pricing Tier:</strong> ${escapeHtml(params.pricingTierLabel)}</p>
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
  const limit = await rateLimit("booking-request", request, 5, 60)
  if (!limit.ok) {
    const { status, body } = tooManyRequests()
    return NextResponse.json(body, { status })
  }

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
    const eventId = asString(body.eventId)
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
    const cookieHeader = request.headers.get("cookie")
    const refererHeader = request.headers.get("referer")
    const sourcePage = resolvePathFromReferer(refererHeader)
    const pageLocation = resolveUrlFromReferer(refererHeader)
    const gaClientId = readGaClientId(cookieHeader)
    const gaSessionId = readGaSessionId(cookieHeader)
    const attribution = readAttributionFromCookieHeader(cookieHeader)

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
          sourcePage,
          attribution,
          rawPayload: body,
        })
      } catch (error) {
        leadPersistenceError = error instanceof Error ? error.message : String(error)
        // Loud on purpose: a booking request that reaches email but never reaches
        // the database loses its UTM and gclid, which is how ad spend stops being
        // attributable. Alert on the LEAD_PERSISTENCE_FAILED string.
        console.error("[LEAD_PERSISTENCE_FAILED] booking-request", {
          error: leadPersistenceError,
          customerEmail,
          customerPhone,
          leadSource,
          sourcePage,
        })
      }
    } else {
      leadPersistenceError = "Lead persistence is unavailable"
      console.error("[LEAD_PERSISTENCE_FAILED] booking-request: Supabase client unavailable", {
        customerEmail,
        leadSource,
      })
    }

    // A lead that reaches this inbox but never reached the database is only
    // recoverable if whoever opens the email knows to copy it out. Say so at the
    // top, where it cannot be missed, instead of only in a log nobody opens.
    const leadWarningHtml = leadPersistenceError
      ? `<div style="border:2px solid #b91c1c;background:#fef2f2;border-radius:8px;padding:12px;margin-bottom:16px">
          <p style="margin:0;color:#7f1d1d;font-weight:bold">NOT SAVED TO THE DATABASE &mdash; copy these details out of this email.</p>
          <p style="margin:6px 0 0;color:#7f1d1d">Reason: ${escapeHtml(leadPersistenceError)}</p>
        </div>`
      : ""
    const leadWarningText = leadPersistenceError
      ? `!! NOT SAVED TO THE DATABASE - copy these details out of this email.\n!! Reason: ${leadPersistenceError}\n\n`
      : ""

    const supportHtml = `
      ${leadWarningHtml}
      <h2>New Website Booking Request</h2>
      <p><strong>Customer:</strong> ${escapeHtml(customerName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(customerEmail)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(customerPhone)}</p>
      <p><strong>Event Date:</strong> ${escapeHtml(eventDate)}</p>
      <p><strong>Event Time:</strong> ${escapeHtml(eventTime)}</p>
      <p><strong>Location:</strong> ${escapeHtml(location)}</p>
      <p><strong>Guests:</strong> ${adults} adults, ${kids} kids</p>
      <p><strong>Pricing Tier:</strong> ${escapeHtml(pricingTierLabel)}</p>
      <p><strong>Estimated Range:</strong> $${estimateLow.toFixed(0)} - $${estimateHigh.toFixed(0)}</p>
      <p><strong>Tableware Rental:</strong> ${tablewareRental ? "Yes" : "No"}</p>
      <p><strong>10'x10' Tent:</strong> ${tent10x10 ? "Yes" : "No"}</p>
      <p><strong>Premium Upgrades:</strong> ${escapeHtml(premiumUpgrades.length > 0 ? premiumUpgrades.join(", ") : "None")}</p>
      <p><strong>Quote Summary:</strong> ${escapeHtml(quoteSummary || "N/A")}</p>
      <p><strong>Next Step:</strong> No deposit was collected. Please contact this customer to finalize the booking.</p>
    `

    const supportNotification = await sendSupportNotificationEmail({
      subject: leadPersistenceError ? "Website Booking Request [NOT SAVED TO DB]" : "Website Booking Request",
      text: leadWarningText + supportText,
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

    const bookingSubmitTracking = await trackBookingSubmitServer({
      eventId,
      leadId: leadResult?.leadId,
      bookingId: bookingFallback?.bookingId,
      gaClientId,
      gaSessionId,
      leadSource,
      sourcePage,
      pageLocation,
      pageReferrer: asString(body.pageReferrer),
      utmSource: attribution.utm_source,
      utmMedium: attribution.utm_medium,
      utmCampaign: attribution.utm_campaign,
      utmTerm: attribution.utm_term,
      utmContent: attribution.utm_content,
      gclid: attribution.gclid,
      wbraid: attribution.wbraid,
      gbraid: attribution.gbraid,
      cityOrZip: location,
      guestCount: adults + kids,
      adults,
      kids,
      eventDate,
      eventTime,
      pricingTier: pricingTierLabel,
      estimateLow,
      estimateHigh,
      value: estimateLow,
      currency: "USD",
      tablewareRental,
      tent10x10,
      premiumUpgradeCount: premiumUpgrades.length,
    })

    if (!isOpsEmailEffectivelyHandled(supportNotification) && !leadResult && !bookingFallback?.persisted) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to notify support.",
          supportNotification,
          customerConfirmation,
          leadPersistenceError,
          bookingFallback,
          serverTracking: {
            bookingSubmit: bookingSubmitTracking,
          },
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
      serverTracking: {
        bookingSubmit: bookingSubmitTracking,
      },
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
