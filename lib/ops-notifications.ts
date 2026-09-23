import { sendEmail, type EmailProvider } from "@/lib/email/send-email"
import { shouldSuppressExternalNotifications } from "@/lib/runtime-env"

export type OpsEmailDeliveryResult = {
  attempted: boolean
  delivered: boolean
  skippedReason?: string
  error?: string
  providerMessageId?: string
  provider?: EmailProvider
  mode?: "logged" | "sent"
}

type SendSupportNotificationEmailParams = {
  subject: string
  text?: string
  /**
   * 可选：内部告警多数只需要几行纯文本。不传就由 text 生成——把 html 设成
   * 必填会让"收款没归属"那两条告警发不出去，而那正是钱落地找不到订单时唯一
   * 会通知到人的东西（2026-09-23 上线前发现）。
   */
  html?: string
  replyTo?: string
}

/** 纯文本告警的兜底 HTML：转义后按行分段，保持可读。 */
function htmlFromText(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return esc
    .split(/\r?\n/)
    .map((line) => `<p style="margin:0 0 6px">${line || "&nbsp;"}</p>`)
    .join("")
}

type SendCustomerEmailParams = {
  to: string
  subject: string
  text: string
  html: string
}

const DEFAULT_SUPPORT_EMAIL = "support@realhibachi.com"
const DEFAULT_SUPPORT_FROM = `Real Hibachi <${DEFAULT_SUPPORT_EMAIL}>`

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function shouldLogOnlyInDevelopment(): boolean {
  return process.env.NODE_ENV === "development" && process.env.ALLOW_DEV_EMAIL_SEND !== "true"
}

function shouldLogOnlyInPreview(): boolean {
  return shouldSuppressExternalNotifications()
}

// The mailbox a customer sees and replies into. EMAIL_FROM is the ops
// notification identity (notify@ in production) and nobody reads it, so mail
// addressed to a customer must never carry it: "reply to this email" then
// points at an empty room and the lead goes quiet with no trace.
export function customerMailbox(): string {
  return asNonEmptyString(process.env.EMAIL_TO) ?? DEFAULT_SUPPORT_EMAIL
}

export function customerMailFrom(): string {
  return `Real Hibachi <${customerMailbox()}>`
}

export function isOpsEmailEffectivelyHandled(result: OpsEmailDeliveryResult): boolean {
  return (
    result.delivered ||
    result.skippedReason === "development_mode_logged" ||
    result.skippedReason === "preview_mode_logged"
  )
}

/**
 * Mail addressed to a customer, sent from the mailbox they can reply into.
 *
 * Every surface that captures a lead owes the person an acknowledgement: the
 * /contact form sent one to ops and nothing to the customer, so a real booking
 * inquiry (2026-09-05, 30 guests) sat four days in silence and only survived
 * because the customer gave up on email and texted instead. Failures here are
 * reported, never thrown - a bounced acknowledgement must not lose the lead.
 */
export async function sendCustomerEmail(params: SendCustomerEmailParams): Promise<OpsEmailDeliveryResult> {
  const to = asNonEmptyString(params.to)
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { attempted: false, delivered: false, skippedReason: "invalid_customer_email" }
  }

  if (shouldLogOnlyInDevelopment()) {
    console.info("[customer-email] development mode, logged instead of sent:", { to, subject: params.subject })
    return { attempted: false, delivered: false, skippedReason: "development_mode_logged", mode: "logged" }
  }

  if (shouldLogOnlyInPreview()) {
    console.info("[customer-email] preview mode, logged instead of sent:", { to, subject: params.subject })
    return { attempted: false, delivered: false, skippedReason: "preview_mode_logged", mode: "logged" }
  }

  const result = await sendEmail({
    from: customerMailFrom(),
    to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    replyTo: customerMailbox(),
  })

  if (!result.ok) {
    return result.configured
      ? { attempted: true, delivered: false, error: result.error }
      : { attempted: false, delivered: false, skippedReason: "email_not_configured" }
  }

  return {
    attempted: true,
    delivered: true,
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    mode: "sent",
  }
}

export async function sendSupportNotificationEmail(
  params: SendSupportNotificationEmailParams,
): Promise<OpsEmailDeliveryResult> {
  const from = asNonEmptyString(process.env.EMAIL_FROM) ?? DEFAULT_SUPPORT_FROM
  const to = asNonEmptyString(process.env.EMAIL_TO) ?? DEFAULT_SUPPORT_EMAIL
  const replyTo = asNonEmptyString(params.replyTo)
  const html = params.html ?? htmlFromText(params.text ?? params.subject)

  if (shouldLogOnlyInDevelopment()) {
    console.log("[ops-email] Development mode: support notification would be sent.", {
      from,
      to,
      subject: params.subject,
      replyTo,
    })

    return {
      attempted: false,
      delivered: false,
      skippedReason: "development_mode_logged",
      mode: "logged",
    }
  }

  if (shouldLogOnlyInPreview()) {
    console.log("[ops-email] Preview mode: support notification suppressed.", {
      from,
      to,
      subject: params.subject,
      replyTo,
    })

    return {
      attempted: false,
      delivered: false,
      skippedReason: "preview_mode_logged",
      mode: "logged",
    }
  }

  const result = await sendEmail({
    from,
    to,
    subject: params.subject,
    text: params.text,
    html,
    replyTo,
  })

  if (!result.ok) {
    return result.configured
      ? { attempted: true, delivered: false, error: result.error }
      : { attempted: false, delivered: false, skippedReason: "email_not_configured" }
  }

  return {
    attempted: true,
    delivered: true,
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    mode: "sent",
  }
}
