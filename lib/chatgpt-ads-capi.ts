import { createHash } from "node:crypto"

// ChatGPT Ads Conversions API (server-to-server), the counterpart of the
// Google EC4L upload. Spec: https://developers.openai.com/ads/conversions-api
//   POST https://bzr.openai.com/v1/events?pid=<PIXEL-ID>
//   Authorization: Bearer <CAPI key>   (separate from the campaign API key)
// Dedup is pixel id + event type + id, so the Stripe payment intent is the id.
// Inert until CHATGPT_ADS_PIXEL_ID and CHATGPT_ADS_CAPI_KEY are set (Vercel
// env); both come from Ads Manager → Conversions once the account exists.

export type ChatgptConversionParams = {
  eventId: string
  amountCents: number
  currency?: string
  email?: string | null
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  postalCode?: string | null
  /** ChatGPT Ads click id captured on the landing page (like gclid). */
  oppref?: string | null
  sourceUrl?: string
  occurredAtMs?: number
  /** Dry run: OpenAI validates auth + payload but stores nothing. */
  validateOnly?: boolean
}

export type ChatgptConversionResult = { attempted: boolean; delivered: boolean; status?: number; error?: string; skippedReason?: string }

// Pixel "My first pixel", created 2026-09-11 in Ads Manager → Conversions. Public.
const DEFAULT_PIXEL_ID = "S5xiVpByZjY3XVfQsSFMoC"

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

function normEmail(v: string | null | undefined): string | null {
  const t = (v ?? "").trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) && !t.endsWith("@example.com") ? t : null
}

function normPhone(v: string | null | undefined): string | null {
  let d = (v ?? "").replace(/\D/g, "").replace(/^0+/, "")
  if (d.length === 10) d = `1${d}`
  return d.length >= 8 && d.length <= 15 ? d : null
}

function normName(v: string | null | undefined): string | null {
  const t = (v ?? "").toLowerCase().replace(/[\s!-/:-@[-`{-~]/g, "")
  return t.length ? t : null
}

export function isChatgptCapiConfigured(): boolean {
  return Boolean((process.env.CHATGPT_ADS_PIXEL_ID || DEFAULT_PIXEL_ID) && process.env.CHATGPT_ADS_CAPI_KEY)
}

/** Sends one order_created event. Never throws; the webhook must not fail on it. */
export async function sendChatgptDepositConversion(params: ChatgptConversionParams): Promise<ChatgptConversionResult> {
  const pixelId = process.env.CHATGPT_ADS_PIXEL_ID || DEFAULT_PIXEL_ID
  const apiKey = process.env.CHATGPT_ADS_CAPI_KEY
  if (!pixelId || !apiKey) return { attempted: false, delivered: false, skippedReason: "not_configured" }
  const email = normEmail(params.email)
  const phone = normPhone(params.phone)
  if (!email && !phone && !params.oppref) return { attempted: false, delivered: false, skippedReason: "no_identifiers" }

  const user: Record<string, unknown> = { countries: ["US"] }
  if (email) user.emails_sha256 = [sha256(email)]
  if (phone) user.phone_numbers_sha256 = [sha256(phone)]
  const fn = normName(params.firstName)
  const ln = normName(params.lastName)
  if (fn) user.first_names_sha256 = [sha256(fn)]
  if (ln) user.last_names_sha256 = [sha256(ln)]
  if (params.postalCode) user.postal_codes = [params.postalCode]

  const event: Record<string, unknown> = {
    id: params.eventId,
    type: "order_created",
    timestamp_ms: params.occurredAtMs ?? Date.now(),
    action_source: "web",
    source_url: params.sourceUrl ?? "https://www.realhibachi.com/deposit/pay",
    user,
    data: {
      type: "contents",
      amount: Math.max(0, Math.round(params.amountCents)),
      currency: (params.currency ?? "USD").toUpperCase(),
      contents: [{ id: "hibachi_party_deposit", name: "Hibachi party deposit", content_type: "product", quantity: 1 }],
    },
  }
  if (params.oppref) event.oppref = params.oppref

  try {
    const res = await fetch(`https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixelId)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ validate_only: Boolean(params.validateOnly), integration_source: "realhibachi_stripe_webhook", events: [event] }),
      cache: "no-store",
    })
    const text = (await res.text().catch(() => "")).slice(0, 300)
    if (!res.ok) return { attempted: true, delivered: false, status: res.status, error: text }
    return { attempted: true, delivered: true, status: res.status, error: text || undefined }
  } catch (error) {
    return { attempted: true, delivered: false, error: error instanceof Error ? error.message : String(error) }
  }
}
