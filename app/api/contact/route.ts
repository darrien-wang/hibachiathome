import { NextResponse } from "next/server"
import { Resend } from "resend"
import { upsertLeadFromContact, readAttributionFromCookieHeader } from "@/lib/leads"
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

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = (await request.json()) as Record<string, unknown>
    const name = asString(body.name)
    const email = asString(body.email)
    const phone = asString(body.phone)
    const reason = asString(body.reason)
    const message = asString(body.message)

    console.log("Received form submission:", { name, email, reason })

    // Validate required fields
    if (!name || !email || !message) {
      console.log("Validation failed: Missing required fields")
      return NextResponse.json({ error: "Name, email, and message are required" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    if (!supabase && process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Lead persistence is unavailable" }, { status: 500 })
    }

    let leadResult: Awaited<ReturnType<typeof upsertLeadFromContact>> | null = null
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
          cityOrZip: asString(body.cityOrZip) ?? asString(body.city_or_zip),
          guestCount:
            (typeof body.guestCount === "number" || typeof body.guestCount === "string"
              ? (body.guestCount as number | string)
              : undefined) ??
            (typeof body.guest_count === "number" || typeof body.guest_count === "string"
              ? (body.guest_count as number | string)
              : undefined),
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
        console.error("Lead upsert failed:", leadError)
        return NextResponse.json(
          {
            error: "Failed to persist lead record",
            details: leadError instanceof Error ? leadError.message : String(leadError),
          },
          { status: 500 },
        )
      }
    }

    // Prepare email content
    const emailHtml = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
      <p><strong>Reason:</strong> ${reason || "Not specified"}</p>
      <h3>Message:</h3>
      <p>${message.replace(/\n/g, "<br>")}</p>
    `

    // In development/preview, just log the email data
    if (process.env.NODE_ENV === "development" || !process.env.RESEND_API_KEY) {
      console.log("Email would be sent with the following data:", {
        from: process.env.EMAIL_FROM || "Hibachi at Home <support@realhibachi.com>",
        to: process.env.EMAIL_TO || "support@realhibachi.com",
        subject: `Contact Form: ${reason || "General Inquiry"}`,
        html: emailHtml,
      })

      return NextResponse.json({
        success: true,
        leadId: leadResult?.leadId ?? null,
        leadDeduped: leadResult?.deduped ?? false,
        message: "Your message has been received. In the preview environment, emails are logged but not sent.",
      })
    }

    console.log("Attempting to send email with Resend...")
    console.log("Using API key:", process.env.RESEND_API_KEY ? "API key exists" : "API key missing")
    console.log("From:", process.env.EMAIL_FROM || "Hibachi at Home <support@realhibachi.com>")
    console.log("To:", process.env.EMAIL_TO || "support@realhibachi.com")

    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      // Send the email
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || "Hibachi at Home <support@realhibachi.com>",
        to: [process.env.EMAIL_TO || "support@realhibachi.com"],
        reply_to: email,
        subject: `Contact Form: ${reason || "General Inquiry"}`,
        html: emailHtml,
      })

      if (error) {
        console.error("Error sending email with Resend:", error)
        return NextResponse.json({ error: "Failed to send email", details: error }, { status: 500 })
      }

      console.log("Email sent successfully:", data)
      // Return success response
      return NextResponse.json({
        success: true,
        data,
        leadId: leadResult?.leadId ?? null,
        leadDeduped: leadResult?.deduped ?? false,
      })
    } catch (resendError) {
      console.error("Resend API error:", resendError)
      return NextResponse.json(
        {
          error: "Failed to send email",
          details: resendError instanceof Error ? resendError.message : String(resendError),
        },
        { status: 500 },
      )
    }
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
