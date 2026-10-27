// Yelp / Facebook / Instagram conversations, copied into the lead's timeline.
//
// Owner 2026-10-26: 「在渠道里的会话内容也需要复制到工作台里，工作台里需要知道每个
// 线索的沟通过程」. Those inboxes have no API we can read (Yelp Leads is
// partner-only; Messenger / Instagram DMs are answered in Business Suite), so
// the desk copies every message both ways as it answers them: one
// lead_touchpoints row each, channel_inbound (the customer) or channel_outbound
// (us), with the text as written. The workbench conversation shows them next
// to the texts, the desk card reads them as conversation lines, and the scan
// reads who spoke last from them.

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

export const CHANNEL_LABELS = { yelp: "Yelp", facebook: "Facebook", instagram: "Instagram" } as const
export type MessageChannel = keyof typeof CHANNEL_LABELS

export const CHANNEL_IN = "channel_inbound"
export const CHANNEL_OUT = "channel_outbound"

export function isMessageChannel(v: unknown): v is MessageChannel {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(CHANNEL_LABELS, v)
}

/** Same message copied twice (a patrol re-run) lands once: the key is what it says, who said it, and when. */
export function channelMessageKey(leadId: string, direction: "in" | "out", at: string, body: string): string {
  const minute = new Date(at).toISOString().slice(0, 16)
  const digest = createHash("sha1").update(`${leadId}|${direction}|${minute}|${body.replace(/\s+/g, " ").trim()}`).digest("hex").slice(0, 24)
  return `chmsg:${digest}`
}

/** A channel message in the SMS thread's shape, so one panel draws both. */
export type ChannelThreadMessage = {
  sid: string
  direction: "inbound" | "outbound"
  body: string
  at: string
  status: string
  media: number
  peer: string
  channel: string
}

/** The copied channel messages on these leads, oldest first. */
export async function loadChannelMessages(supabase: SupabaseClient, leadIds: string[], limit = 120): Promise<ChannelThreadMessage[]> {
  if (leadIds.length === 0) return []
  const { data } = await supabase
    .from("lead_touchpoints")
    .select("id, touchpoint_type, touchpoint_source, occurred_at, raw_payload_json")
    .in("lead_id", leadIds)
    .in("touchpoint_type", [CHANNEL_IN, CHANNEL_OUT])
    .order("occurred_at", { ascending: false })
    .limit(limit)
  const rows = (data ?? []) as Array<{ id: string; touchpoint_type: string; touchpoint_source: string | null; occurred_at: string; raw_payload_json: Record<string, unknown> | null }>
  return rows
    .map((r) => {
      const p = r.raw_payload_json ?? {}
      const ch = isMessageChannel(p.channel) ? p.channel : isMessageChannel(r.touchpoint_source) ? r.touchpoint_source : null
      return {
        sid: `ch:${r.id}`,
        direction: r.touchpoint_type === CHANNEL_IN ? ("inbound" as const) : ("outbound" as const),
        body: typeof p.body === "string" ? p.body : "",
        // ISO like the Twilio thread's, so the merged conversation sorts as text.
        at: new Date(r.occurred_at).toISOString(),
        status: "",
        media: 0,
        peer: "",
        channel: ch ? CHANNEL_LABELS[ch] : "渠道",
      }
    })
    .reverse()
}
