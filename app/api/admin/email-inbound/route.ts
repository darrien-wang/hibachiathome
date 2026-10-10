import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { upsertLeadFromContact } from "@/lib/leads"
import { platformOf } from "@/lib/heard-from"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Customer email into the workbench (owner 2026-10-07: "直接第三档").
//
// A Gmail Apps Script in the mailbox that receives support@ (scripts/gmail/
// support-inbound.gs) posts every message addressed to support@ here, once a
// minute. We file it on the lead that owns the sender's address (or open a new
// lead), as an `email_inbound` touchpoint keyed by the Gmail message id, so the
// desk (`desk next`), the inbox watcher and lead-watch see an unanswered email
// exactly like an unanswered text. Replies go out with `desk email`, which
// files `email_outbound`; an inbound newer than our last outbound is "waiting".
//
// Before this, email only reached a person when someone opened Gmail: Taegan's
// 10/2 corporate inquiry sat four days (support@ -> Gmail forwarding was also
// bouncing at the time); Jane Yusim's photo question was spotted by the owner.
//
// Auth: a workbench actor, or the single-purpose EMAIL_INBOUND_KEY (Vercel env +
// the script's properties) - accepted here and nowhere else.

const MAX_TEXT = 20_000
const SNIPPET = 200
// Our own mail and bounces never make a lead. Platform notifications (Zola,
// Thumbtack, ...) DO - that is how corporate inquiries arrive - so nothing else
// is filtered; a person triages.
const SYSTEM_SENDER = /(^|[<\s])(mailer-daemon|postmaster|no-?reply@stripe\.com|[^@\s<>]+@(?:[a-z0-9-]+\.)*realhibachi\.com)(?=[>\s]|$)/i
// Bulk mail and account notices are not customers either: the first run on
// 2026-10-07 filed a Walmart Business newsletter and a Google "new sign-in"
// alert as leads. Marketing senders by local part / domain, plus anything
// carrying a List-Unsubscribe header - except the lead platforms, whose
// notifications are real inquiries even when they are bulk-sent.
const BULK_LOCAL = /^(newsletter|news|newsletters|marketing|promo|promotions?|offers?|deals|digest|updates?|notifications?|hello|team|info|donotreply|do-not-reply|no-?reply|noreply)$/i
const SYSTEM_DOMAIN = /(^|\.)(accounts\.google\.com|google\.com|googlemail\.com|em\.business\.walmart\.com|walmart\.com|amazon\.com|costco\.com|intuit\.com|quickbooks\.com|vercel\.com|twilio\.com|cloudflare\.com|godaddy\.com|squarespace\.com|yelp\.com|facebookmail\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com)$/i
const LEAD_PLATFORM = /(zola|thumbtack|theknot|weddingwire|bark\.com|eventective|peerspace|giggster|gigsalad|thebash|partyslate|airbnb|vrbo)/i

function isBulkOrSystem(email: string, listUnsubscribe: boolean): string | null {
  const [local = "", domain = ""] = email.split("@")
  if (LEAD_PLATFORM.test(domain)) return null
  if (SYSTEM_DOMAIN.test(domain)) return "system_domain"
  if (listUnsubscribe) return "bulk_list_unsubscribe"
  if (BULK_LOCAL.test(local)) return "bulk_sender"
  return null
}

function callerOf(request: NextRequest): Promise<"actor" | "script" | null> {
  return resolveAdminActor(request).then((actor) => {
    if (actor) return "actor"
    const key = process.env.EMAIL_INBOUND_KEY?.trim()
    if (!key) return null
    const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
    const provided = request.headers.get("x-admin-key")?.trim() || bearer
    return provided === key ? "script" : null
  })
}

/** "Jane Yusim <jane@x.com>" -> { name: "Jane Yusim", email: "jane@x.com" } */
function parseFrom(raw: string): { name: string; email: string } | null {
  const s = raw.trim()
  const m = s.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/)
  const email = (m ? m[2] : s).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  const name = (m ? m[1] : "").trim().replace(/\s+/g, " ")
  return { name, email }
}

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "")

export async function POST(request: NextRequest) {
  const caller = await callerOf(request)
  if (!caller) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }

  const messageId = str(body.messageId, 200)
  const fromRaw = str(body.from, 500)
  if (!messageId || !fromRaw) return NextResponse.json({ ok: false, error: "messageId and from are required" }, { status: 400 })
  const from = parseFrom(fromRaw)
  if (!from) return NextResponse.json({ ok: true, skipped: "unparseable_sender" })
  if (SYSTEM_SENDER.test(fromRaw) || SYSTEM_SENDER.test(from.email)) return NextResponse.json({ ok: true, skipped: "system_sender" })
  const bulk = isBulkOrSystem(from.email, body.listUnsubscribe === true)
  if (bulk) return NextResponse.json({ ok: true, skipped: bulk })
  // Our own people writing from personal addresses. Since 10-09 the script also files The Knot /
  // Zola inquiries, which arrive in the owner's Gmail and are answered from it, so those threads
  // carry our replies - they are not a customer writing in.
  const { data: staff } = await supabase.from("staff_members").select("id").ilike("email", from.email.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1).maybeSingle()
  if (staff) return NextResponse.json({ ok: true, skipped: "staff_sender" })

  const subject = str(body.subject, 500) || "(no subject)"
  const text = str(body.text, MAX_TEXT)
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, SNIPPET)
  const threadId = str(body.threadId, 200) || null
  const gmailUrl = str(body.gmailUrl, 500) || null
  const receivedAt = (() => {
    const ms = Date.parse(str(body.receivedAt, 60))
    return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString()
  })()
  const externalId = `email:${messageId}`
  const latestMessage = `✉ ${subject}${snippet ? ` — ${snippet}` : ""}`.slice(0, 500)
  const payload = { from: from.email, fromName: from.name || null, to: str(body.to, 300) || null, subject, text, snippet, threadId, gmailUrl, receivedAt, via: "gmail_script", caller }

  // Already filed (the script re-posts recent threads on purpose; the server dedupes).
  const { data: dup } = await supabase.from("lead_touchpoints").select("lead_id").eq("external_touchpoint_id", externalId).limit(1).maybeSingle()
  if (dup) return NextResponse.json({ ok: true, duplicate: true, leadId: dup.lead_id })

  // The lead that owns this address, however old - a customer who booked in
  // June and writes in October is the same person. (upsertLeadFromContact's
  // email match only looks back a few weeks and would open a duplicate.)
  const { data: owner } = await supabase
    .from("leads")
    .select("id, full_name, status, touchpoint_count")
    .ilike("email", from.email)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nowIso = new Date().toISOString()
  let leadId: string
  let created = false
  if (owner) {
    leadId = String(owner.id)
    const { error } = await supabase.from("lead_touchpoints").insert({
      lead_id: leadId,
      touchpoint_type: "email_inbound",
      touchpoint_source: "gmail_script",
      external_touchpoint_id: externalId,
      raw_payload_json: payload,
      occurred_at: receivedAt,
    })
    if (error && (error as { code?: string }).code !== "23505") {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    await supabase
      .from("leads")
      .update({
        latest_message: latestMessage,
        last_seen_at: nowIso,
        updated_at: nowIso,
        touchpoint_count: (Number(owner.touchpoint_count) || 1) + 1,
        ...(!(owner.full_name ?? "").trim() && from.name ? { full_name: from.name } : {}),
      })
      .eq("id", leadId)
  } else {
    // The Knot / Zola / Thumbtack ... say where they came from in the sender's
    // domain: lead_channel "platform" resolves to marketplace_referral, so the
    // lead is attributed and never asked "how did you find us" (D-1010).
    const platform = platformOf(from.email)
    const result = await upsertLeadFromContact(supabase, {
      name: from.name || from.email.split("@")[0],
      email: from.email,
      message: latestMessage,
      leadSource: platform ?? "email_inbound",
      leadChannel: platform ? "platform" : "email",
      touchpointType: "email_inbound",
      touchpointSource: "gmail_script",
      externalTouchpointId: externalId,
      rawPayload: payload,
    })
    leadId = result.leadId
    created = !result.deduped
  }

  return NextResponse.json({ ok: true, leadId, created, snippet })
}
