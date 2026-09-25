import type { SupabaseClient } from "@supabase/supabase-js"
import type { SmsMessage } from "@/lib/sms-thread"

// ============================================================
// Twilio -> lead timeline reconciliation (2026-09-24)
// ============================================================
// The 213 line is written to from more places than the workbench: the Android
// app, scripts, and agent sessions that call Twilio directly. Only POST
// /api/admin/sms-thread writes a lead_touchpoints row, so every other path
// left the lead's timeline showing a customer question with no answer under
// it. On 9/24 that happened for real - a gluten-free question looked ignored
// for eight hours in the drawer while the reply had actually gone out three
// minutes later.
//
// The alerting side was never wrong (lead-watch and the mobile inbox read
// Twilio directly), so this is about the record, not the alarms: the drawer,
// leads.latest_message, and anything counted off lead_touchpoints.
//
// Twilio is the source of truth. We copy in whatever the timeline is missing,
// keyed by message SID so running it twice changes nothing.

export type ReconcileResult = { inserted: number; scanned: number }

type Row = {
  lead_id: string
  touchpoint_type: "sms_inbound" | "sms_outbound"
  touchpoint_source: string
  external_touchpoint_id: string
  occurred_at: string
  raw_payload_json: Record<string, unknown>
}

/**
 * Copy any Twilio message that the lead's timeline is missing into
 * lead_touchpoints, and refresh the lead's latest_message / last_seen_at when
 * the newest message is newer than what the lead row remembers.
 *
 * `messages` is whatever the caller already fetched (the thread panel and
 * lead-watch both have it in hand), so this costs no extra Twilio calls.
 */
export async function reconcileThread(
  supabase: SupabaseClient,
  leadId: string,
  messages: SmsMessage[],
): Promise<ReconcileResult> {
  const usable = messages.filter((m) => m.sid && m.at)
  if (usable.length === 0) return { inserted: 0, scanned: 0 }

  const sids = usable.map((m) => m.sid)
  const { data: known } = await supabase
    .from("lead_touchpoints")
    .select("external_touchpoint_id")
    .eq("lead_id", leadId)
    .in("external_touchpoint_id", sids)
  const have = new Set((known ?? []).map((r) => (r as { external_touchpoint_id: string }).external_touchpoint_id))

  const rows: Row[] = usable
    .filter((m) => !have.has(m.sid))
    .map((m) => ({
      lead_id: leadId,
      touchpoint_type: m.direction === "inbound" ? "sms_inbound" : "sms_outbound",
      touchpoint_source: "twilio_sync",
      external_touchpoint_id: m.sid,
      occurred_at: m.at,
      // Inbound rows written by the webhook carry Twilio's own field names and
      // the drawer reads Body from there - match that shape so a synced row
      // renders identically to a live one.
      raw_payload_json: {
        Body: m.body,
        body: m.body,
        sid: m.sid,
        direction: m.direction,
        status: m.status,
        media: m.media,
        peer: m.peer,
        synced_from_twilio: true,
      },
    }))

  if (rows.length > 0) {
    const { error } = await supabase.from("lead_touchpoints").insert(rows)
    // A race with the live writer trips the SID unique index; that is the
    // outcome we wanted anyway, so it is not worth failing the request.
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.error("[sms-reconcile] insert failed", error.message)
      return { inserted: 0, scanned: usable.length }
    }
  }

  const newest = usable.reduce((a, b) => (a.at >= b.at ? a : b))
  const { data: lead } = await supabase.from("leads").select("last_seen_at").eq("id", leadId).maybeSingle()
  const seen = (lead as { last_seen_at: string | null } | null)?.last_seen_at ?? null
  if (!seen || newest.at > seen) {
    await supabase
      .from("leads")
      .update({
        last_seen_at: newest.at,
        latest_message:
          newest.direction === "inbound"
            ? newest.body.slice(0, 500)
            : `我方 ${newest.at.slice(0, 10)} 短信已回（213 线）：${newest.body}`.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
  }

  return { inserted: rows.length, scanned: usable.length }
}
