import { NextResponse } from "next/server"
import { upsertLeadFromContact, readAttributionFromCookieHeader } from "@/lib/leads"
import { isOpsEmailEffectivelyHandled, sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { createServerSupabaseClient } from "@/lib/supabase"

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
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

function normalizeOptionalDetail(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === "not provided") return undefined
  return trimmed
}

function extractContactDetailsFromMessage(message: string | undefined) {
  if (!message) {
    return {
      cleanedMessage: message,
      eventDate: undefined,
      guestCount: undefined,
      cityOrZip: undefined,
    }
  }

  const lines = message.split(/\r?\n/)
  let eventDate: string | undefined
  let guestCount: string | undefined
  let cityOrZip: string | undefined
  const cleanedLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("Event Date:")) {
      eventDate = normalizeOptionalDetail(trimmed.slice("Event Date:".length))
      continue
    }

    if (trimmed.startsWith("Guest Count:")) {
      guestCount = normalizeOptionalDetail(trimmed.slice("Guest Count:".length))
      continue
    }

    if (trimmed.startsWith("City/ZIP:")) {
      cityOrZip = normalizeOptionalDetail(trimmed.slice("City/ZIP:".length))
      continue
    }

    cleanedLines.push(line)
  }

  const cleanedMessage = cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim()

  return {
    cleanedMessage,
    eventDate,
    guestCount,
    cityOrZip,
  }
}

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = (await request.json()) as Record<string, unknown>
    const name = asString(body.name)
    const email = asString(body.email)
    const phone = asString(body.phone)
    const reason = asString(body.reason)
    const rawMessage = asString(body.message)
    const extractedDetails = extractContactDetailsFromMessage(rawMessage)
    const message = asString(extractedDetails.cleanedMessage)
    const eventDate = asString(body.eventDate) ?? extractedDetails.eventDate
    const guestCount =
      (typeof body.guestCount === "number" || typeof body.guestCount === "string"
        ? String(body.guestCount)
        : undefined) ??
      (typeof body.guest_count === "number" || typeof body.guest_count === "string"
        ? String(body.guest_count)
        : undefined) ??
      extractedDetails.guestCount
    const cityOrZip = asString(body.cityOrZip) ?? asString(body.city_or_zip) ?? extractedDetails.cityOrZip

    console.log("Received form submission:", { name, email, reason })

    // Validate required fields
    if (!name || !email || !message) {
      console.log("Validation failed: Missing required fields")
      return NextResponse.json({ error: "Name, email, and message are required" }, { status: 400 })
    }

    // Prepare email content
    const emailHtml = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
      <p><strong>Reason:</strong> ${reason || "Not specified"}</p>
      ${eventDate ? `<p><strong>Event Date:</strong> ${eventDate}</p>` : ""}
      ${guestCount ? `<p><strong>Guest Count:</strong> ${guestCount}</p>` : ""}
      ${cityOrZip ? `<p><strong>City/ZIP:</strong> ${cityOrZip}</p>` : ""}
      <h3>Message:</h3>
      <p>${message.replace(/\n/g, "<br>")}</p>
    `
    const emailText = [
      "New Contact Form Submission",
      `Name: ${name}`,
      `Email: ${email}`,
      `Reason: ${reason || "Not specified"}`,
      phone ? `Phone: ${phone}` : null,
      eventDate ? `Event Date: ${eventDate}` : null,
      guestCount ? `Guest Count: ${guestCount}` : null,
      cityOrZip ? `City/ZIP: ${cityOrZip}` : null,
      "",
      "Message:",
      message,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n")

    const supportNotification = await sendSupportNotificationEmail({
      subject: `Contact Form: ${reason || "General Inquiry"}`,
      text: emailText,
      html: emailHtml,
      replyTo: email,
    })

    let leadResult: Awaited<ReturnType<typeof upsertLeadFromContact>> | null = null
    let leadPersistenceError: string | null = null

    const supabase = createServerSupabaseClient()
    if (supabase) {
      try {
        leadResult = await upsertLeadFromContact(supabase, {
          name,
          email,
          phone,
          reason,
          message,
          leadSource: asString(body.leadSource) ?? asString(body.lead_source),
          leadChannel: asString(body.leadChannel) ?? asString(body.lead_channel),
          leadType: asString(body.leadType) ?? asString(body.lead_type),
          cityOrZip,
          guestCount,
          touchpointType: asString(body.touchpointType) ?? asString(body.touchpoint_type),
          touchpointSource: asString(body.touchpointSource) ?? asString(body.touchpoint_source),
          externalCallId: asString(body.externalCallId) ?? asString(body.external_call_id),
          manualEntryId: asString(body.manualEntryId) ?? asString(body.manual_entry_id),
          externalTouchpointId: asString(body.externalTouchpointId) ?? asString(body.external_touchpoint_id),
          sourcePage: resolvePathFromReferer(request.headers.get("referer")),
          attribution: readAttributionFromCookieHeader(request.headers.get("cookie")),
          rawPayload: body,
        })
      } catch (leadError) {
        leadPersistenceError = leadError instanceof Error ? leadError.message : String(leadError)
        console.error("Lead upsert failed:", leadError)
      }
    } else {
      leadPersistenceError = "Lead persistence is unavailable"
      console.warn("[contact] Supabase is not configured; support notification path only.")
    }

    if (!isOpsEmailEffectivelyHandled(supportNotification)) {
      console.error("[contact] Support notification was not delivered.", {
        error: supportNotification.error,
        skippedReason: supportNotification.skippedReason,
      })
    }

    if (!isOpsEmailEffectivelyHandled(supportNotification) && !leadResult) {
      return NextResponse.json(
        {
          error: "Failed to notify support",
          notification: supportNotification,
          leadPersistenceError,
        },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        leadId: leadResult?.leadId ?? null,
        leadDeduped: leadResult?.deduped ?? false,
        notification: supportNotification,
        leadPersistence: {
          persisted: Boolean(leadResult),
          error: leadPersistenceError,
        },
        message:
          supportNotification.skippedReason === "development_mode_logged"
            ? "Your message has been received. In local development, support emails are logged unless ALLOW_DEV_EMAIL_SEND=true."
            : "Your message has been received and our team will follow up soon.",
      },
      { status: isOpsEmailEffectivelyHandled(supportNotification) ? 200 : 202 },
    )
  } catch (error) {
    console.error("Error processing contact form:", error)
    return NextResponse.json(
      {
        error: "Failed to process contact form",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
