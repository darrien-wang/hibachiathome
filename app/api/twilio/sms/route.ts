import crypto from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { upsertLeadFromContact } from "@/lib/leads"
import { isOpsEmailEffectivelyHandled, sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { fetchSmsThread, prettyPhone, renderThreadForEmail } from "@/lib/sms-thread"
import { forwardMmsToInbox } from "@/lib/mms-forward"
import { classifySmsKeyword, OPT_OUT_REASON_PREFIX } from "@/lib/sms-opt-out"
import { addressFromMessage, looksLikeStreetAddress } from "@/lib/address-detect"

export const dynamic = "force-dynamic"

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
  // Pictures and video the customer attached (Twilio sends NumMedia on MMS).
  const mediaCount = Number(params.NumMedia ?? "0") || 0
  if (!from || !messageSid) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  let leadId: string | null = null
  let leadName = ""
  // STOP / CANCEL / ... blocks every lead on this number; START / UNSTOP / YES
  // lifts it. Any other text proves the phone works, which lifts a dead-number
  // block (30003/30006) but not an opt-out - Twilio keeps refusing those sends
  // until they opt back in.
  const keyword = classifySmsKeyword(body, params.OptOutType)
  const digits = from.replace(/\D/g, "").slice(-10)
  try {
    if (keyword?.kind === "opt_in") {
      await supabase.from("leads").update({ sms_blocked_at: null, sms_blocked_reason: null }).eq("normalized_phone", digits).not("sms_blocked_at", "is", null)
    } else if (!keyword) {
      await supabase
        .from("leads")
        .update({ sms_blocked_at: null, sms_blocked_reason: null })
        .eq("normalized_phone", digits)
        .not("sms_blocked_at", "is", null)
        .not("sms_blocked_reason", "like", `${OPT_OUT_REASON_PREFIX}%`)
        .not("sms_blocked_reason", "like", "21610%")
    }
  } catch {}
  try {
    const upserted = await upsertLeadFromContact(supabase, {
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
    leadId = upserted?.leadId ?? null
    if (leadId && supabase) {
      const { data: lead } = await supabase.from("leads").select("full_name").eq("id", leadId).maybeSingle()
      const name = (lead?.full_name ?? "").trim()
      // A lead created from a bare text is named after its number; that is
      // not a name.
      if (name && name.replace(/\D/g, "") !== from.replace(/\D/g, "")) leadName = name
    }
  } catch (error) {
    console.error("[twilio-sms] lead upsert failed", error)
    // Still 200 so Twilio does not retry-storm; message is in Twilio logs.
  }

  // The address usually arrives in chat - typed out or as a map pin - and it
  // used to live only in the thread while the order still said TBD. Park it on
  // the lead and the timeline; the order drawer offers it with one tap.
  if (leadId && mediaCount === 0) {
    try {
      const found = await addressFromMessage(body)
      if (found) {
        await supabase.from("lead_touchpoints").insert({
          lead_id: leadId,
          touchpoint_type: "address_detected",
          touchpoint_source: "twilio",
          raw_payload_json: { address: found.address, via: found.via, link: found.link ?? null, message_sid: messageSid },
        })
        const { data: current } = await supabase.from("leads").select("city_or_zip").eq("id", leadId).maybeSingle()
        // A city name or a zip is worth replacing with the street line; an
        // address already on file is not touched.
        if (!looksLikeStreetAddress(current?.city_or_zip)) {
          await supabase.from("leads").update({ city_or_zip: found.address }).eq("id", leadId)
        }
      }
    } catch (error) {
      console.error("[twilio-sms] address detection failed", error)
    }
  }

  // After the upsert, so a number whose first text is STOP is blocked too.
  if (keyword?.kind === "opt_out") {
    try {
      await supabase
        .from("leads")
        .update({ sms_blocked_at: new Date().toISOString(), sms_blocked_reason: `${OPT_OUT_REASON_PREFIX}: texted ${keyword.keyword}` })
        .eq("normalized_phone", digits)
    } catch (error) {
      console.error("[twilio-sms] opt-out block failed", error)
    }
  }

  // An inbound text has no landing page behind it, so nothing surfaces it
  // unless someone happens to have the workbench open. Mail it to the ops
  // inbox, which does reach a phone.
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"
    const pretty = prettyPhone(from)
    const safeFrom = escapeHtml(from)
    const safeBody = escapeHtml(body.trim() || "(no text)")
    // One subject per number, on purpose: Gmail groups identical subjects
    // into a single conversation, so the inbox reads as a chat instead of
    // eight unrelated rows that all start "SMS from +1951…" (owner, 2026-09-11).
    const who = leadName ? `${leadName} · ${pretty}` : pretty
    const subject = `SMS · ${who}`
    // The thread from Twilio, so the alert carries what came before it. Best
    // effort: if Twilio is slow or down the alert still goes out.
    const thread = await fetchSmsThread(from, 12).catch(() => [])
    const earlier = thread.filter((m) => m.sid !== messageSid)
    const rendered = earlier.length
      ? renderThreadForEmail(earlier, { peerLabel: leadName || pretty, context: 8 })
      : null
    const workbenchUrl = leadId ? `${baseUrl}/admin/leads?lead=${leadId}` : `${baseUrl}/admin/leads`
    const alert = await sendSupportNotificationEmail({
      subject,
      text: [
        `${who} wrote:`,
        "",
        body.trim() || "(no text)",
        "",
        ...(rendered ? ["Earlier in this conversation:", rendered.text, ""] : []),
        `Reply from the 213 line: ${workbenchUrl}`,
        `Call back: ${from}`,
      ].join("\n"),
      html: [
        `<p style="margin:0 0 6px;font-size:13px;color:#6b7280">${escapeHtml(who)} wrote</p>`,
        `<div style="white-space:pre-wrap;border-left:3px solid #f59e0b;background:#fff7ed;padding:10px 12px;margin:0 0 18px;font-size:17px;border-radius:0 8px 8px 0">${safeBody}</div>`,
        `<p style="margin:0 0 18px"><a href="${workbenchUrl}" style="display:inline-block;background:#c2410c;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Reply from the 213 line</a>` +
          ` <a href="tel:${safeFrom}" style="display:inline-block;margin-left:8px;color:#c2410c;text-decoration:none;font-weight:600">Call back</a></p>`,
        ...(rendered
          ? [
              `<p style="margin:0 0 6px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em">Earlier in this conversation</p>`,
              rendered.html,
            ]
          : []),
      ].join(""),
    })
    if (!isOpsEmailEffectivelyHandled(alert)) {
      console.error("[twilio-sms] alert email not delivered", {
        error: alert.error,
        skippedReason: alert.skippedReason,
      })
    }
    // Pictures and video: the alert above can only describe them, and a
    // carrier-transcoded clip will not play in a browser at all. Mail the
    // files so they open on the phone. Best effort.
    if (mediaCount > 0) {
      const forwarded = await forwardMmsToInbox({
        messageSid,
        fromLabel: who,
        text: body,
        workbenchUrl,
      }).catch((error) => ({ ok: false, files: 0, detail: String(error) }))
      if (!forwarded.ok) console.error("[twilio-sms] attachments not forwarded", forwarded.detail)
    }
  } catch (error) {
    console.error("[twilio-sms] alert email failed", error)
  }

  // Empty TwiML: record only, no auto-reply (yet).
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { "content-type": "text/xml" },
  })
}
