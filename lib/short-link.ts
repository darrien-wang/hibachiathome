import { randomInt } from "crypto"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

// Short links for texted URLs. A prefilled /deposit/pay link runs ~300
// characters, which turns one SMS into three segments and looks like spam on a
// phone. /d/<code> carries the same destination in under 40.
//
// Links live for 30 days by default. After that (or for a code that never
// existed) /d/<code> lands on the homepage rather than an error page, so an old
// text never dead-ends.

export const SHORT_LINK_TTL_DAYS = 30
export const SHORT_LINK_FALLBACK_URL = "https://www.realhibachi.com"
const SHORT_LINK_BASE = "https://www.realhibachi.com/d"

// No 0/O/1/l/I: codes get read off a screen and typed.
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
const CODE_LENGTH = 6

// Open-redirect guard: a short link may only point back at our own hosts (or
// the Stripe Checkout sessions our pay-link endpoint mints).
const ALLOWED_HOSTS = new Set([
  "www.realhibachi.com",
  "realhibachi.com",
  "party.realhibachi.com",
  "invoice.realhibachi.com",
  "checkout.stripe.com",
])

export function isAllowedShortLinkTarget(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

function newCode(): string {
  let code = ""
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}

export type ShortLink = { code: string; shortUrl: string; expiresAt: string }

export async function createShortLink(
  targetUrl: string,
  opts: { leadId?: string | null; createdBy?: string; ttlDays?: number } = {}
): Promise<ShortLink | null> {
  if (!isAllowedShortLinkTarget(targetUrl)) return null
  const supabase = getSupabaseAdmin()
  if (!supabase) return null
  const ttlDays = Math.min(365, Math.max(1, Math.round(opts.ttlDays ?? SHORT_LINK_TTL_DAYS)))
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString()
  // 56^6 is ~30 billion codes; a collision is a retry, not a design problem.
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newCode()
    const { error } = await supabase.from("short_links").insert({
      code,
      target_url: targetUrl,
      lead_id: opts.leadId || null,
      created_by: opts.createdBy ?? null,
      expires_at: expiresAt,
    })
    if (!error) return { code, shortUrl: `${SHORT_LINK_BASE}/${code}`, expiresAt }
    if (error.code !== "23505") {
      console.error("[short-link] insert failed", error)
      return null
    }
  }
  return null
}

/** The live destination for a code, or null when it is unknown or expired. */
export async function resolveShortLink(code: string): Promise<string | null> {
  if (!/^[0-9A-Za-z]{4,12}$/.test(code)) return null
  const supabase = getSupabaseAdmin()
  if (!supabase) return null
  const { data, error } = await supabase
    .from("short_links")
    .select("target_url, expires_at, click_count")
    .eq("code", code)
    .maybeSingle()
  if (error || !data) return null
  if (new Date(data.expires_at).getTime() <= Date.now()) return null
  // Best effort: a missed click count must never cost the customer the redirect.
  void supabase
    .from("short_links")
    .update({ click_count: (data.click_count ?? 0) + 1, last_clicked_at: new Date().toISOString() })
    .eq("code", code)
    .then(() => undefined, () => undefined)
  return data.target_url
}
