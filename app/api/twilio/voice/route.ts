import crypto from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { upsertLeadFromContact } from "@/lib/leads"
import { agentIdentities, escapeXml } from "@/lib/twilio-identity"

export const dynamic = "force-dynamic"

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

function twiml(body: string): NextResponse {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "content-type": "text/xml" },
  })
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") params[k] = v
  }

  const signature = request.headers.get("x-twilio-signature") ?? ""
  const publicUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"}/api/twilio/voice`
  if (!isValidTwilioSignature(publicUrl, params, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 })
  }

  const from = params.From ?? ""
  const callSid = params.CallSid ?? ""

  // Log the inbound call as a lead touchpoint so it shows up on the workbench.
  if (from && callSid && from !== "Anonymous") {
    const supabase = createServerSupabaseClient()
    try {
      await upsertLeadFromContact(supabase, {
        name: from,
        phone: from,
        message: "Inbound phone call",
        leadSource: "phone_inbound",
        leadChannel: "phone",
        touchpointType: "call_inbound",
        touchpointSource: "twilio",
        externalCallId: callSid,
        rawPayload: params,
      })
    } catch (error) {
      console.error("[twilio-voice] lead upsert failed", error)
    }
  }

  const forwardTo = process.env.TWILIO_FORWARD_TO
  const clients = agentIdentities()

  if (!forwardTo && clients.length === 0) {
    return twiml(
      "<Say>Thank you for calling Real Hibachi. Please text us at this number and we will get right back to you.</Say>"
    )
  }

  // Ring every browser softphone and the backup phone at the same time; whoever
  // picks up first gets the call, so nothing is missed when nobody is at a desk.
  // Caller keeps the caller's own number as caller ID; 25s ring then voicemail prompt.
  const legs =
    clients.map((id) => `<Client>${escapeXml(id)}</Client>`).join("") +
    (forwardTo ? `<Number>${escapeXml(forwardTo)}</Number>` : "")

  return twiml(
    `<Dial timeout="25" answerOnBridge="true">${legs}</Dial>` +
      "<Say>Sorry we missed you. Please text us at this number with your event date and city, and we will reply within minutes.</Say>"
  )
}
