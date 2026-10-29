import crypto from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { upsertLeadFromContact } from "@/lib/leads"
import { isStaffNumber, loadStaffDigits } from "@/lib/staff-phones"
import { isBlockedNumber, loadBlockedDigits, noteBlockedCall } from "@/lib/blocked-callers"
import { callerCardFor, clientLeg } from "@/lib/caller-card"
import { APP_RING_SECONDS, escapeXml, ringIdentities } from "@/lib/twilio-identity"
import { RECORDING_NOTICE, recordingAttributes } from "@/lib/twilio-recording"

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

  const supabase = createServerSupabaseClient()

  // A sales pitch we have already identified (lib/blocked-callers.ts, owner
  // 2026-10-28) never rings the booking line: <Reject> as the first verb is
  // not answered and not billed. No lead, no missed-call text.
  if (supabase && from && from !== "Anonymous" && isBlockedNumber(await loadBlockedDigits(supabase), from)) {
    await noteBlockedCall(supabase, from)
    return twiml(`<Reject reason="rejected"/>`)
  }

  // Who is calling, for the ring screen (lib/caller-card.ts): looked up while
  // the lead is written below, so it adds no wait of its own.
  const cardLookup = supabase && from !== "Anonymous" ? callerCardFor(supabase, from) : Promise.resolve(null)

  // Log the inbound call as a lead touchpoint so it shows up on the workbench.
  // A staff member calling (a chef, the owner testing) is not a lead
  // (lib/staff-phones.ts, owner 2026-10-13).
  if (supabase && from && callSid && from !== "Anonymous" && !isStaffNumber(await loadStaffDigits(supabase), from)) {
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
  const clients = await ringIdentities()

  if (!forwardTo && clients.length === 0) {
    return twiml(
      "<Say>Thank you for calling Real Hibachi. Please text us at this number and we will get right back to you.</Say>"
    )
  }

  // Two stages, not one ring (owner 2026-09-27). Stage one rings every
  // softphone for APP_RING_SECONDS; if nobody picks up,
  // /api/twilio/voice-status?stage=app dials the backup phone. The caller
  // keeps their own number as caller ID throughout.
  //
  // With no softphone identity registered there is nothing to ring first, so
  // the backup number IS stage one - a <Dial> with no nouns is invalid TwiML.
  //
  // Each App leg carries the caller card - name, headcount, date, price,
  // locked or not - which the App and the web softphone show on the ring
  // and in-call screens. The backup phone is a plain number and gets none.
  const card = await cardLookup
  const appStage = clients.length > 0
  const legs = appStage
    ? clients.map((id) => clientLeg(id, card)).join("")
    : `<Number>${escapeXml(forwardTo ?? "")}</Number>`

  // California is a two-party consent state (Penal Code 632): every party must
  // be told before the call is recorded. The notice plays to the caller BEFORE
  // the bridge, and recording starts only once someone answers, so the notice
  // always precedes the recorded audio. Do not make recording conditional
  // without making this notice conditional in exactly the same way.
  const recording = recordingAttributes()
  const notice = recording ? `<Say>${escapeXml(RECORDING_NOTICE)}</Say>` : ""

  // When the legs finish, /api/twilio/voice-status decides what the caller
  // hears: nothing if someone answered, and if nobody did it texts them right
  // away and says so (2026-09-27 audit: 4 of 8 missed calls got no text).
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"
  const action = `${base}/api/twilio/voice-status${appStage ? "?stage=app" : ""}`
  return twiml(
    notice +
      `<Dial timeout="${appStage ? APP_RING_SECONDS : 25}" answerOnBridge="true" action="${escapeXml(action)}" method="POST"${recording}>${legs}</Dial>`
  )
}
