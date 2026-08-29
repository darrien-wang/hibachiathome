import crypto from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { upsertLeadFromContact } from "@/lib/leads"

export const dynamic = "force-dynamic"

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

  // Empty TwiML: record only, no auto-reply (yet).
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { "content-type": "text/xml" },
  })
}
