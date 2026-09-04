import crypto from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { upsertLeadFromContact } from "@/lib/leads"
import { isOpsEmailEffectivelyHandled, sendSupportNotificationEmail } from "@/lib/ops-notifications"

export const dynamic = "force-dynamic"

const ALERT_SUBJECT_SNIPPET = 80

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// Validates X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + concat(sorted params))).
function isValidTwilioSignature(url: string, params: Record<string, string>, signature: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return false
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("")
  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64")
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") params[k] = v
  }

  const signature = request.headers.get("x-twilio-signature") ?? ""
  const publicUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"}/api/twilio/sms`
  if (!isValidTwilioSignature(publicUrl, params, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 })
  }

  const from = params.From ?? ""
  const body = params.Body ?? ""
  const messageSid = params.MessageSid ?? ""
  if (!from || !messageSid) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  try {
    await upsertLeadFromContact(supabase, {
      name: from,
      phone: from,
      message: body,
      leadSource: "sms_inbound",
      leadChannel: "sms",
      touchpointType: "sms_inbound",
      touchpointSource: "twilio",
      externalTouchpointId: messageSid,
      rawPayload: params,
    })
  } catch (error) {
    console.error("[twilio-sms] lead upsert failed", error)
    // Still 200 so Twilio does not retry-storm; message is in Twilio logs.
  }

  // An inbound text has no landing page behind it, so nothing surfaces it
  // unless someone happens to have the workbench open. Mail it to the ops
  // inbox, which does reach a phone.
  try {
    const snippet = body.trim().slice(0, ALERT_SUBJECT_SNIPPET) || "(no text)"
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"
    const safeFrom = escapeHtml(from)
    const safeBody = escapeHtml(body.trim() || "(no text)")
    const alert = await sendSupportNotificationEmail({
      subject: `SMS from ${from}: ${snippet}`,
      text: [`From: ${from}`, "", body.trim() || "(no text)", "", `Call back: ${from}`, `Workbench: ${baseUrl}/admin/leads`].join("\n"),
      html: [
        `<p style="margin:0 0 8px;font-size:14px;color:#555">New text message from</p>`,
        `<p style="margin:0 0 16px;font-size:22px;font-weight:700"><a href="tel:${safeFrom}" style="color:#c2410c;text-decoration:none">${safeFrom}</a></p>`,
        `<div style="white-space:pre-wrap;border-left:3px solid #f59e0b;padding:8px 12px;margin:0 0 20px;font-size:16px">${safeBody}</div>`,
        `<p style="margin:0 0 8px"><a href="tel:${safeFrom}" style="display:inline-block;background:#c2410c;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">Call back</a></p>`,
        `<p style="margin:16px 0 0;font-size:13px"><a href="${baseUrl}/admin/leads" style="color:#1d4ed8">Open the lead workbench</a></p>`,
      ].join(""),
    })
    if (!isOpsEmailEffectivelyHandled(alert)) {
      console.error("[twilio-sms] alert email not delivered", {
        error: alert.error,
        skippedReason: alert.skippedReason,
      })
    }
  } catch (error) {
    console.error("[twilio-sms] alert email failed", error)
  }

  // Empty TwiML: record only, no auto-reply (yet).
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { "content-type": "text/xml" },
  })
}
