import { type NextRequest, NextResponse } from "next/server"
import { isValidTwilioSignature } from "@/lib/twilio-signature"
import { escapeXml } from "@/lib/twilio-identity"
import { RECORDING_NOTICE, recordingAttributes } from "@/lib/twilio-recording"

export const dynamic = "force-dynamic"

// Voice URL for the TwiML App referenced by TWILIO_TWIML_APP_SID. Twilio hits
// this when a signed-in softphone calls device.connect({ params: { To } }),
// and we bridge that browser leg out to the PSTN number the agent dialed.
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
  const publicUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"}/api/twilio/voice-outbound`
  if (!isValidTwilioSignature(publicUrl, params, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 })
  }

  const to = (params.To ?? "").trim()
  // Only ever dial a plain E.164 number — never echo an arbitrary string into TwiML.
  if (!/^\+[1-9]\d{7,14}$/.test(to)) {
    return twiml("<Say>Sorry, that number is not valid.</Say>")
  }

  const callerId = process.env.TWILIO_CALLER_ID
  if (!callerId) {
    return twiml("<Say>Outbound calling is not configured.</Say>")
  }

  // On an outbound leg the person who must be told is the one we called, so the
  // notice rides on <Number url=...> — Twilio plays it to them the moment they
  // pick up, before the two legs are bridged. See lib/twilio-recording.ts.
  const recording = recordingAttributes()
  const whisper = recording
    ? ` url="${escapeXml((process.env.NEXT_PUBLIC_BASE_URL ?? "") + "/api/twilio/voice-notice")}"`
    : ""

  return twiml(
    `<Dial callerId="${escapeXml(callerId)}" answerOnBridge="true" timeout="30"${recording}>` +
      `<Number${whisper}>${escapeXml(to)}</Number>` +
      "</Dial>"
  )
}
