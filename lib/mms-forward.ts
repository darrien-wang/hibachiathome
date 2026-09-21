// ============================================================
// Forward what customers text us to the inbox
// ============================================================
// Twilio keeps MMS attachments behind basic auth, so the alert email could
// only say what the text said and the picture stayed on Twilio's servers.
// Carriers also transcode video to 3GPP/H.263, which no browser plays - the
// workbench can show photos inline but not those clips. A phone can play
// them, so every attachment is emailed to the ops inbox as a file: the owner
// opens it from Gmail on the phone and it just plays.
//
// Sent straight through Resend rather than lib/ops-notifications.ts because
// that path has no attachment support.

const MAX_FILES = 5
const MAX_BYTES = 10 * 1024 * 1024

type MediaItem = { uri: string; content_type: string }

function extensionFor(contentType: string): string {
  const [, sub = "bin"] = contentType.split("/")
  if (sub === "jpeg") return "jpg"
  if (sub === "quicktime") return "mov"
  if (sub === "3gpp") return "3gp"
  return sub.replace(/[^a-z0-9]/gi, "").slice(0, 6) || "bin"
}

export async function forwardMmsToInbox(params: {
  messageSid: string
  fromLabel: string
  text: string
  workbenchUrl: string
}): Promise<{ ok: boolean; files: number; detail?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!accountSid || !token || !apiKey) return { ok: false, files: 0, detail: "not configured" }

  const auth = `Basic ${Buffer.from(`${accountSid}:${token}`).toString("base64")}`
  const listRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${params.messageSid}/Media.json?PageSize=${MAX_FILES}`,
    { headers: { Authorization: auth }, cache: "no-store" },
  )
  if (!listRes.ok) return { ok: false, files: 0, detail: `twilio_${listRes.status}` }
  const list = (await listRes.json().catch(() => null)) as { media_list?: MediaItem[] } | null
  const items = (list?.media_list ?? []).slice(0, MAX_FILES)
  if (items.length === 0) return { ok: false, files: 0, detail: "no media" }

  const attachments: Array<{ filename: string; content: string }> = []
  for (const [i, item] of items.entries()) {
    const fileRes = await fetch(`https://api.twilio.com${item.uri.replace(/\.json$/, "")}`, {
      headers: { Authorization: auth },
      redirect: "follow",
      cache: "no-store",
    })
    if (!fileRes.ok) continue
    const bytes = Buffer.from(await fileRes.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_BYTES) continue
    attachments.push({
      filename: `${params.messageSid}-${i + 1}.${extensionFor(item.content_type)}`,
      content: bytes.toString("base64"),
    })
  }
  if (attachments.length === 0) return { ok: false, files: 0, detail: "nothing downloaded" }

  const from = process.env.INVOICE_ARCHIVE_FROM?.trim() || "Real Hibachi Records <notify@realhibachi.com>"
  const to = process.env.INVOICE_ARCHIVE_TO?.trim() || "support@realhibachi.com"
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Attachment · ${params.fromLabel}`,
      text: [
        `${params.fromLabel} sent ${attachments.length} file${attachments.length === 1 ? "" : "s"}.`,
        "",
        params.text.trim() || "(no text with it)",
        "",
        "Carriers shrink video to 3GPP, which phones play and browsers do not - open the attachment on your phone.",
        "",
        `Reply from the 213 line: ${params.workbenchUrl}`,
      ].join("\n"),
      attachments,
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    return { ok: false, files: attachments.length, detail: `resend_${response.status}${detail ? `:${detail.slice(0, 160)}` : ""}` }
  }
  return { ok: true, files: attachments.length }
}
