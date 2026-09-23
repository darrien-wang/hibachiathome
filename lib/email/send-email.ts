/**
 * Outbound email with a second provider behind the first.
 *
 * Resend carries every lead alert and customer confirmation this site sends.
 * If that one account is suspended, rate limited or down, leads go silent and
 * nobody notices until a customer complains - the failure mode that already
 * cost us bookings once. So every send tries Resend first and, on any failure
 * or timeout, sends the same message through Cloudflare Email Service.
 *
 * Cloudflare is only tried when CLOUDFLARE_EMAIL_ACCOUNT_ID and
 * CLOUDFLARE_EMAIL_API_TOKEN are set. Without them this is a plain Resend send.
 *
 * Keep in sync with v0-real-hibachi-invoice-generator/lib/email/send-email.ts.
 */

export type EmailProvider = "resend" | "cloudflare"

export type OutboundEmail = {
  /** "Real Hibachi <support@realhibachi.com>" or a bare address. */
  from: string
  to: string | string[]
  cc?: string[]
  replyTo?: string
  subject: string
  text?: string
  html?: string
}

export type EmailSendResult =
  | { ok: true; provider: EmailProvider; providerMessageId?: string; failoverReason?: string }
  | { ok: false; configured: boolean; error: string }

const SEND_TIMEOUT_MS = 10_000

function env(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.name === "TimeoutError" ? "timeout" : error.message
  return String(error)
}

function toList(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value]
}

// Cloudflare wants { address, name } rather than an RFC 5322 display string.
export function parseMailbox(value: string): { address: string; name?: string } {
  const match = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/)
  if (!match) return { address: value.trim() }
  const name = match[1].replace(/^"(.*)"$/, "$1").trim()
  return name ? { address: match[2].trim(), name } : { address: match[2].trim() }
}

async function sendViaResend(apiKey: string, email: OutboundEmail): Promise<string | undefined> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: email.from,
      to: toList(email.to),
      ...(email.cc?.length ? { cc: email.cc } : {}),
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      subject: email.subject,
      ...(email.text ? { text: email.text } : {}),
      ...(email.html ? { html: email.html } : {}),
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  })
  const body = (await response.json().catch(() => null)) as { id?: unknown; message?: unknown } | null
  if (!response.ok) {
    const detail = typeof body?.message === "string" ? `: ${body.message}` : ""
    throw new Error(`resend_http_${response.status}${detail}`)
  }
  return typeof body?.id === "string" ? body.id : undefined
}

type CloudflareSendResponse = {
  success?: boolean
  errors?: Array<{ code?: number; message?: string }>
  result?: {
    message_id?: string
    permanent_bounces?: string[]
    suppressed_recipients?: string[]
  } | null
}

async function sendViaCloudflare(accountId: string, token: string, email: OutboundEmail): Promise<string | undefined> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/email/sending/send`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: parseMailbox(email.from),
        to: toList(email.to),
        ...(email.cc?.length ? { cc: email.cc } : {}),
        ...(email.replyTo ? { reply_to: parseMailbox(email.replyTo) } : {}),
        subject: email.subject,
        ...(email.text ? { text: email.text } : {}),
        ...(email.html ? { html: email.html } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    },
  )
  const body = (await response.json().catch(() => null)) as CloudflareSendResponse | null
  if (!response.ok || !body?.success) {
    const detail = body?.errors?.map((e) => e.message).filter(Boolean).join(", ")
    throw new Error(`cloudflare_http_${response.status}${detail ? `: ${detail}` : ""}`)
  }
  // A 200 can still mean nobody gets it: every recipient bounced or is on the
  // suppression list. Report that as a failure instead of a delivery.
  const recipients = toList(email.to).length + (email.cc?.length ?? 0)
  const rejected = (body.result?.permanent_bounces?.length ?? 0) + (body.result?.suppressed_recipients?.length ?? 0)
  if (rejected >= recipients) throw new Error("cloudflare_all_recipients_rejected")
  return body.result?.message_id
}

/**
 * Never throws. Failures come back as { ok: false } so callers keep their
 * "report, don't lose the lead" handling.
 */
export async function sendEmail(email: OutboundEmail): Promise<EmailSendResult> {
  const resendKey = env("RESEND_API_KEY")
  const cfAccount = env("CLOUDFLARE_EMAIL_ACCOUNT_ID")
  const cfToken = env("CLOUDFLARE_EMAIL_API_TOKEN")
  const cloudflareReady = Boolean(cfAccount && cfToken)

  if (!resendKey && !cloudflareReady) {
    return { ok: false, configured: false, error: "email_not_configured" }
  }

  let resendError: string | undefined
  if (resendKey) {
    try {
      return { ok: true, provider: "resend", providerMessageId: await sendViaResend(resendKey, email) }
    } catch (error) {
      resendError = errorMessage(error)
    }
  }

  if (!cloudflareReady) {
    return { ok: false, configured: true, error: resendError ?? "email_send_failed" }
  }

  try {
    const providerMessageId = await sendViaCloudflare(cfAccount!, cfToken!, email)
    const failoverReason = resendError ?? "resend_not_configured"
    // Tagged so a Resend outage or suspension shows up in the Vercel logs even
    // though every message still went out.
    console.error("[email-failover] sent via Cloudflare:", failoverReason, { subject: email.subject })
    return { ok: true, provider: "cloudflare", providerMessageId, failoverReason }
  } catch (error) {
    const cloudflareError = errorMessage(error)
    return {
      ok: false,
      configured: true,
      error: resendError ? `${resendError}; ${cloudflareError}` : cloudflareError,
    }
  }
}
