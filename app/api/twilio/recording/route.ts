import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { isValidTwilioSignature } from "@/lib/twilio-signature"

export const dynamic = "force-dynamic"

// Twilio posts here when a recording finishes. We attach it to the lead so the
// audio is one click from the customer it belongs to, instead of only existing
// in the Twilio console.
export async function POST(request: NextRequest) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") params[k] = v
  }

  const signature = request.headers.get("x-twilio-signature") ?? ""
  const publicUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"}/api/twilio/recording`
  if (!isValidTwilioSignature(publicUrl, params, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 })
  }

  const recordingUrl = params.RecordingUrl ?? ""
  const callSid = params.CallSid ?? ""
  if (!recordingUrl || !callSid) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  try {
    // The recording callback never says who the caller was, so the CallSid is
    // the only link back to a lead. The inbound voice route stores it inside the
    // touchpoint payload (there is no dedicated column), with leads.external_call_id
    // as a second chance when the touchpoint write lost its race.
    const { data: touchpoint } = await supabase
      .from("lead_touchpoints")
      .select("lead_id")
      .eq("raw_payload_json->>CallSid", callSid)
      .limit(1)
      .maybeSingle()

    let leadId = touchpoint?.lead_id as string | undefined
    if (!leadId) {
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .eq("external_call_id", callSid)
        .limit(1)
        .maybeSingle()
      leadId = lead?.id ? String(lead.id) : undefined
    }

    if (leadId) {
      await supabase.from("lead_touchpoints").insert({
        lead_id: leadId,
        touchpoint_type: "call_recording",
        touchpoint_source: "twilio",
        external_touchpoint_id: params.RecordingSid ?? null,
        raw_payload_json: {
          recording_url: recordingUrl,
          duration_seconds: params.RecordingDuration ?? null,
          recording_sid: params.RecordingSid ?? null,
          call_sid: callSid,
        },
      })
    } else {
      console.warn("[twilio-recording] no lead matched CallSid", { callSid })
    }
  } catch (error) {
    console.error("[twilio-recording] failed to attach recording", error)
  }

  // Always 200: a retry storm helps nobody, and the recording is safe in Twilio.
  return NextResponse.json({ ok: true })
}
