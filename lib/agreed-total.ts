import { createHmac, timingSafeEqual } from "crypto"

// A specially negotiated party price ("agreed total") travels on the deposit
// link so the order opens on the number the customer was promised. The link is
// customer-visible, so the amount is signed: without a valid signature the
// deposit flow ignores it and prices the party from the catalog as usual -
// nobody can talk their own total down by editing a URL.

function secret(): string | null {
  return process.env.AGREED_TOTAL_SECRET || process.env.ADMIN_DASH_KEY || null
}

function toCents(amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null
  return Math.round(amount * 100)
}

function digest(key: string, leadId: string, cents: number): string {
  return createHmac("sha256", key).update(`agreed-total:v1|${leadId}|${cents}`).digest("hex").slice(0, 24)
}

/** Signature for a lead's agreed total, or null when it cannot be signed. */
export function signAgreedTotal(leadId: string | null | undefined, amount: number): string | null {
  const key = secret()
  const cents = toCents(amount)
  if (!key || cents === null) return null
  return digest(key, (leadId ?? "").trim(), cents)
}

/** True only when `sig` was minted by us for exactly this lead and amount. */
export function verifyAgreedTotal(leadId: string | null | undefined, amount: number, sig: string | null | undefined): boolean {
  const expected = signAgreedTotal(leadId, amount)
  const given = (sig ?? "").trim()
  if (!expected || given.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given))
}
