import type { SupabaseClient } from "@supabase/supabase-js"

// The party date a lead has told us, as the workbench derives it: leads has no
// date column, so the date lives on the touchpoints - the form payload
// (eventDate / event_date / partyDate / date), the automated quote's payload,
// or a "[data] ..." / "[callback] ..." note an agent wrote after the customer
// said it in a text. Same derivation as the leads list (event_hint), kept
// here so the SMS context lint, the list and the lead scan can never disagree.

export const HINT_TYPES = [
  "sms_inbound",
  "call_inbound",
  "landing_contact",
  "contact_form",
  "contact_intent",
  "quote_book_online",
  "manual_entry",
  "planner_unlock",
  "landing_quote_text",
  "agent_note",
]

const ISO_DATE = /\b(20\d{2}-\d{2}-\d{2})\b/
const WRITTEN_DATE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?\b|\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/i

export type LeadEventHint = { date: string; source: string }
export type HintRow = { touchpoint_type: string; raw_payload_json: Record<string, unknown> | null }

/**
 * The newest date in a lead's timeline rows (newest first), or null. `date`
 * is YYYY-MM-DD when the payload had one, otherwise the customer's own words.
 */
export function hintFromRows(rows: HintRow[]): LeadEventHint | null {
  for (const ev of rows) {
    const p = ev.raw_payload_json ?? {}
    if (ev.touchpoint_type === "agent_note") {
      const note = typeof p.note === "string" ? p.note : ""
      if (!/^\s*\[(data|callback|occasion)\]/i.test(note)) continue
      const iso = ISO_DATE.exec(note)
      if (iso) return { date: iso[1], source: "note" }
      const written = WRITTEN_DATE.exec(note)
      if (written) return { date: written[0], source: "note" }
      continue
    }
    const d = p.eventDate ?? p.event_date ?? p.partyDate ?? p.date
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return { date: d.slice(0, 10), source: ev.touchpoint_type }
  }
  return null
}

/** Newest date on the lead's timeline, read from the database. */
export async function loadLeadEventHint(supabase: SupabaseClient, leadId: string): Promise<LeadEventHint | null> {
  const { data } = await supabase
    .from("lead_touchpoints")
    .select("touchpoint_type, raw_payload_json, occurred_at")
    .eq("lead_id", leadId)
    .in("touchpoint_type", HINT_TYPES)
    .order("occurred_at", { ascending: false })
    .limit(80)
  return hintFromRows((data ?? []) as HintRow[])
}
