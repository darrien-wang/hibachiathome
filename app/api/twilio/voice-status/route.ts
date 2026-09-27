import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { sendSms, toE164 } from "@/lib/sms-thread"
import { isValidTwilioSignature } from "@/lib/twilio-signature"
import { MISSED_CALL_TEXT, missedCallTouchpointId } from "@/lib/missed-call"

export const dynamic = "force-dynamic"

// <Dial action> for the inbound line (app/api/twilio/voice). Twilio posts here
// when the dialled legs finish, with DialCallStatus telling us whether anyone
// picked up. A missed call is the hottest lead we have - 5 of the 18 bookings
// in the 09-13..09-27 audit started with a phone call - and 4 of the 8 missed
// calls in that window got nothing from us at all. So: nobody answered ->
// the caller gets a text within seconds, and the lead's timeline shows it.
//
// A caller who hangs up while we are still ringing does not always reach this
// handler (Twilio ends the call instead), so lead-watch runs the same check
// against Twilio's call log as a backstop. Both are keyed on the CallSid, so a
// caller is never texted twice for one call.

function twiml(body: string): NextResponse {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "content-type": "text/xml" },
  })
}

const ANSWERED_SECONDS = 20

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v

  const signature = request.headers.get("x-twilio-signature") ?? ""
  const publicUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"}/api/twilio/voice-status`
  if (!isValidTwilioSignature(publicUrl, params, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 })
  }

  const status = params.DialCallStatus ?? ""
  const duration = Number(params.DialCallDuration ?? 0) || 0
  const answered = status === "completed" && duration >= ANSWERED_SECONDS
  if (answered) return twiml("")

  const from = toE164(params.From)
  const callSid = params.CallSid ?? ""
  if (!from || !callSid || /^\+1\d{3}555\d{4}$/.test(from)) {
    return twiml("<Say>Sorry we missed you. Please text us at this number and a real person will answer right away.</Say>")
  }

  const supabase = createServerSupabaseClient()
  const digits = from.replace(/\D/g, "").slice(-10)
  let leadId: string | null = null
  if (supabase) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, sms_blocked_at")
      .eq("normalized_phone", digits)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    const row = lead as { id: string; sms_blocked_at: string | null } | null
    leadId = row?.id ?? null
    // Opted out or unreachable: the voice prompt still asks them to text us,
    // but we do not text a number that told us to stop.
    if (row?.sms_blocked_at) {
      return twiml("<Say>Sorry we missed you. Please text us at this number and a real person will answer right away.</Say>")
    }
    // Already handled this call (the lead-watch backstop may have won the race).
    if (leadId) {
      const { data: done } = await supabase
        .from("lead_touchpoints")
        .select("id")
        .eq("lead_id", leadId)
        .eq("external_touchpoint_id", missedCallTouchpointId(callSid))
        .limit(1)
      if (done && done.length > 0) return twiml("")
    }
  }

  const sms = await sendSms(from, MISSED_CALL_TEXT)
  if (!sms.ok) console.error("[voice-status] missed-call text failed", { from, error: sms.error })

  if (supabase && leadId) {
    const now = new Date().toISOString()
    await supabase.from("lead_touchpoints").insert({
      lead_id: leadId,
      touchpoint_type: "sms_outbound",
      touchpoint_source: "missed_call",
      external_touchpoint_id: missedCallTouchpointId(callSid),
      raw_payload_json: { to: from, body: MISSED_CALL_TEXT, status: sms.ok ? sms.status : `failed: ${sms.error}`, call_sid: callSid, dial_status: status, dial_seconds: duration, sid: sms.ok ? sms.sid : null, auto: true },
      occurred_at: now,
    })
    await supabase
      .from("leads")
      .update({ latest_message: `我方 ${now.slice(0, 10)} 未接来电已自动短信：${MISSED_CALL_TEXT}`.slice(0, 500), last_seen_at: now, updated_at: now })
      .eq("id", leadId)
  }

  return twiml(
    sms.ok
      ? "<Say>Sorry we missed you. We just sent you a text - reply there and a real person answers right away.</Say>"
      : "<Say>Sorry we missed you. Please text us at this number and a real person will answer right away.</Say>",
  )
}
