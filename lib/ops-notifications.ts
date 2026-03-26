import { Resend } from "resend"

export type OpsEmailDeliveryResult = {
  attempted: boolean
  delivered: boolean
  skippedReason?: string
  error?: string
  providerMessageId?: string
  mode?: "logged" | "sent"
}

type SendSupportNotificationEmailParams = {
  subject: string
  text?: string
  html: string
  replyTo?: string
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

export function isOpsEmailEffectivelyHandled(result: OpsEmailDeliveryResult): boolean {
  return result.delivered || result.skippedReason === "development_mode_logged"
}

export async function sendSupportNotificationEmail(
  params: SendSupportNotificationEmailParams,
): Promise<OpsEmailDeliveryResult> {
  const from = asNonEmptyString(process.env.EMAIL_FROM) ?? DEFAULT_SUPPORT_FROM
  const to = asNonEmptyString(process.env.EMAIL_TO) ?? DEFAULT_SUPPORT_EMAIL
  const replyTo = asNonEmptyString(params.replyTo)

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

  const resendApiKey = asNonEmptyString(process.env.RESEND_API_KEY)
  if (!resendApiKey) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "resend_not_configured",
    }
  }

  try {
    const resend = new Resend(resendApiKey)
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject: params.subject,
      text: params.text,
      html: params.html,
      reply_to: replyTo,
    })

    if (error) {
      return {
        attempted: true,
        delivered: false,
        error: asNonEmptyString(error.message) ?? "ops_email_send_failed",
      }
    }

    return {
      attempted: true,
      delivered: true,
      providerMessageId: asNonEmptyString(data?.id),
      mode: "sent",
    }
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      error: error instanceof Error ? error.message : "ops_email_send_failed",
    }
  }
}
