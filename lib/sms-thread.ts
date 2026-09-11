import { phone } from "@/config/site"

/**
 * The SMS conversation with one customer, read straight from Twilio.
 *
 * Twilio is the only complete record: inbound texts land in lead_touchpoints,
 * but replies go out from several places (the workbench, the deposit
 * webhook, staff scripts) and none of them wrote anything down. Reading the
 * thread back from the carrier side means the workbench and the alert email
 * show the same conversation no matter who typed the last line.
 */
export type SmsMessage = {
  sid: string
  direction: "inbound" | "outbound"
  body: string
  /** ISO timestamp (sent, or created when not yet sent). */
  at: string
  status: string
  media: number
}

/** "9512070523", "(951) 207-0523", "+19512070523" -> "+19512070523". */
export function toE164(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim()
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return null
}

/** "+19512070523" -> "(951) 207-0523" for humans; other formats pass through. */
export function prettyPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

export function ourSmsNumber(): string {
  return process.env.TWILIO_CALLER_ID ?? phone.sms.e164
}

type TwilioMessage = {
  sid: string
  direction: string
  body: string
  from: string
  to: string
  status: string
  date_sent: string | null
  date_created: string
  num_media?: string
}

async function listMessages(auth: string, accountSid: string, query: string, limit: number): Promise<TwilioMessage[]> {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?${query}&PageSize=${limit}`,
    { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" },
  )
  if (!res.ok) return []
  const data = (await res.json()) as { messages?: TwilioMessage[] }
  return data.messages ?? []
}

export async function fetchSmsThread(peer: string, limit = 60): Promise<SmsMessage[]> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const e164 = toE164(peer)
  if (!accountSid || !token || !e164) return []
  const auth = Buffer.from(`${accountSid}:${token}`).toString("base64")
  const [inbound, outbound] = await Promise.all([
    listMessages(auth, accountSid, `From=${encodeURIComponent(e164)}`, limit),
    listMessages(auth, accountSid, `To=${encodeURIComponent(e164)}`, limit),
  ])
  const seen = new Set<string>()
  const merged: SmsMessage[] = []
  for (const m of [...inbound, ...outbound]) {
    if (seen.has(m.sid)) continue
    seen.add(m.sid)
    const when = new Date(m.date_sent ?? m.date_created)
    merged.push({
      sid: m.sid,
      direction: m.direction === "inbound" ? "inbound" : "outbound",
      body: m.body ?? "",
      at: (Number.isNaN(when.getTime()) ? new Date() : when).toISOString(),
      status: m.status,
      media: Number(m.num_media ?? 0) || 0,
    })
  }
  merged.sort((a, b) => a.at.localeCompare(b.at))
  return merged.slice(-limit)
}

export type SendSmsResult = { ok: true; sid: string; status: string } | { ok: false; error: string }

/** Send from the business line (Messaging Service when configured). */
export async function sendSms(peer: string, body: string): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const e164 = toE164(peer)
  if (!accountSid || !token) return { ok: false, error: "twilio_not_configured" }
  if (!e164) return { ok: false, error: "invalid_phone" }
  const text = body.trim()
  if (!text) return { ok: false, error: "empty_body" }
  const form = new URLSearchParams({ To: e164, Body: text })
  const serviceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  if (serviceSid) form.set("MessagingServiceSid", serviceSid)
  else form.set("From", ourSmsNumber())
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  })
  const data = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string }
  if (!res.ok || !data.sid) return { ok: false, error: data.message ?? `twilio_${res.status}` }
  return { ok: true, sid: data.sid, status: data.status ?? "queued" }
}

const PT = "America/Los_Angeles"

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: PT, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/**
 * The thread as it should read in an alert email: the new message in front,
 * the last few exchanges under it so "Yes please" makes sense without opening
 * anything. Plain text and HTML, both chronological.
 */
export function renderThreadForEmail(
  messages: SmsMessage[],
  opts: { highlightSid?: string; peerLabel: string; context?: number },
): { text: string; html: string } {
  const context = opts.context ?? 8
  const recent = messages.slice(-context)
  const label = (m: SmsMessage) => (m.direction === "inbound" ? opts.peerLabel : "You (213)")
  const text = recent
    .map((m) => `${m.sid === opts.highlightSid ? "▶ " : "  "}${stamp(m.at)}  ${label(m)}: ${m.body || (m.media ? `[${m.media} image(s)]` : "")}`)
    .join("\n")
  const html = recent
    .map((m) => {
      const mine = m.direction === "outbound"
      const hot = m.sid === opts.highlightSid
      return (
        `<div style="display:flex;justify-content:${mine ? "flex-end" : "flex-start"};margin:4px 0">` +
        `<div style="max-width:80%;padding:8px 12px;border-radius:14px;font-size:15px;line-height:1.45;white-space:pre-wrap;` +
        `background:${mine ? "#fdeee2" : hot ? "#fff7ed" : "#f3f4f6"};border:1px solid ${hot ? "#f59e0b" : mine ? "#fbd7bd" : "#e5e7eb"};color:#1f2937">` +
        `${escapeHtml(m.body || (m.media ? `[${m.media} image(s)]` : ""))}` +
        `<div style="font-size:11px;color:#9ca3af;margin-top:4px;text-align:${mine ? "right" : "left"}">${escapeHtml(label(m))} · ${escapeHtml(stamp(m.at))}</div>` +
        `</div></div>`
      )
    })
    .join("")
  return { text, html }
}
