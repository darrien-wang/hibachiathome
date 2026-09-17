import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { isValidTwilioSignature } from "@/lib/twilio-signature"
import { isOpsEmailEffectivelyHandled, sendSupportNotificationEmail } from "@/lib/ops-notifications"

export const dynamic = "force-dynamic"

// Twilio's create-message call returns "queued" — it only means Twilio took the
// request. Carrier rejections (30005 T-Mobile blocking, 30003 unreachable
// handset, 21704 empty Messaging Service) land minutes later and, until this
// route existed, nowhere at all: the workbench showed the auto-quote as sent,
// an agent marked the lead contacted in good faith, and the customer had
// actually heard nothing. One 2026-09-26 party sat like that for a day.
const FAILED_STATUSES = new Set(["failed", "undelivered"])

function describe(errorCode: string): string {
  switch (errorCode) {
    case "30003": return "handset unreachable (off, no signal, or cannot receive SMS)"
    case "30005": return "carrier rejected the message (often an A2P brand-tier block)"
    case "30006": return "landline or unreachable carrier"
    case "30007": return "carrier flagged the message as spam"
    case "21610": return "this number replied STOP — they are opted out"
    case "21704": return "the Messaging Service has no sending number attached"
    default: return "carrier did not deliver it"
  }
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v

  const signature = request.headers.get("x-twilio-signature") ?? ""
  const publicUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"}/api/twilio/sms-status`
  if (!isValidTwilioSignature(publicUrl, params, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 })
  }

  const status = (params.MessageStatus ?? "").toLowerCase()
  const to = params.To ?? ""
  const errorCode = params.ErrorCode ?? ""
  const messageSid = params.MessageSid ?? params.SmsSid ?? ""

  // Delivered/sent/queued are the happy path and would drown the timeline.
  if (!FAILED_STATUSES.has(status) || !to) return new NextResponse(null, { status: 204 })
  // The 555 exchange is never assigned to real subscribers; our own test flows
  // text numbers like 213-555-0231. Those sends can never deliver, so a failure
  // there is expected: no timeline entry, no alert email.
  if (/^\+1\d{3}555\d{4}$/.test(to)) return new NextResponse(null, { status: 204 })

  const supabase = createServerSupabaseClient()
  try {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, full_name, email")
      .eq("phone", to)
      .order("created_at", { ascending: false })
      .limit(1)
    const lead = leads?.[0]

    if (lead) {
      await supabase.from("lead_touchpoints").insert({
        lead_id: lead.id,
        touchpoint_type: "sms_failed",
        touchpoint_source: "twilio",
        raw_payload_json: { to, status, errorCode, messageSid, reason: describe(errorCode) },
      })
    }

    const alert = await sendSupportNotificationEmail({
      subject: `SMS to ${to} was not delivered (${errorCode || status})`,
      text: [
        `Our text to ${to} came back "${status}".`,
        `Reason: ${describe(errorCode)}${errorCode ? ` (Twilio ${errorCode})` : ""}.`,
        "",
        lead
          ? `They are in the workbench${lead.email ? ` and we have their email: ${lead.email}` : " with no email on file, so voice is the only way through"}.`
          : "No matching lead — this may be a manual send.",
        "",
        "They have NOT heard from us. Do not mark this lead contacted until another channel goes out.",
      ].join("\n"),
      html: [
        `<p style="margin:0 0 8px;font-size:15px">Our text to <strong>${to}</strong> came back "<strong>${status}</strong>".</p>`,
        `<p style="margin:0 0 16px;color:#b45309">${describe(errorCode)}${errorCode ? ` (Twilio ${errorCode})` : ""}</p>`,
        lead
          ? `<p style="margin:0 0 8px">${lead.email ? `We have their email: <strong>${lead.email}</strong> — use that.` : "No email on file — a phone call is the only way through."}</p>`
          : `<p style="margin:0 0 8px">No matching lead in the workbench.</p>`,
        `<p style="margin:16px 0 0;font-size:13px;color:#6b7280">They have not heard from us. Don't mark the lead contacted until another channel goes out.</p>`,
      ].join(""),
    })
    if (!isOpsEmailEffectivelyHandled(alert)) {
      console.error("[twilio-sms-status] alert email not delivered", { error: alert.error, skippedReason: alert.skippedReason })
    }
  } catch (error) {
    console.error("[twilio-sms-status] handling failed", error)
  }

  return new NextResponse(null, { status: 204 })
}
