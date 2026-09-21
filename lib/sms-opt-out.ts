// Carrier opt-out / opt-in keywords (CTIA list, same as Twilio's defaults).
// Twilio already enforces them on the Messaging Service - a send to an
// opted-out number fails with 21610 - so the block we keep on the lead is only
// there to stop our own tools (workbench, follow-up batches) from trying.
const OPT_OUT_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"])
const OPT_IN_KEYWORDS = new Set(["START", "UNSTOP", "YES"])

// Prefix of sms_blocked_reason for numbers that opted out. Unlike a dead-number
// block (30003/30006), this one only lifts when they opt back in.
export const OPT_OUT_REASON_PREFIX = "opt-out"

export type SmsKeywordKind = "opt_out" | "opt_in"

/**
 * Whether an inbound text is an opt-out or opt-in. Twilio sends OptOutType
 * (STOP / START / HELP) when Advanced Opt-Out is on; otherwise the whole body
 * has to be one keyword, the way carriers match it ("cancel" opts out,
 * "please cancel my party" does not).
 */
export function classifySmsKeyword(body: string, optOutType?: string): { kind: SmsKeywordKind; keyword: string } | null {
  const type = (optOutType ?? "").trim().toUpperCase()
  const keyword = body.trim().replace(/[\s.!]+$/, "").toUpperCase()
  if (type === "STOP") return { kind: "opt_out", keyword: OPT_OUT_KEYWORDS.has(keyword) ? keyword : type }
  if (type === "START") return { kind: "opt_in", keyword: OPT_IN_KEYWORDS.has(keyword) ? keyword : type }
  if (OPT_OUT_KEYWORDS.has(keyword)) return { kind: "opt_out", keyword }
  if (OPT_IN_KEYWORDS.has(keyword)) return { kind: "opt_in", keyword }
  return null
}

/** True when a lead's block means "they opted out", not "the phone is dead". */
export function isOptOutBlock(reason: string | null | undefined): boolean {
  if (!reason) return false
  return reason.startsWith(OPT_OUT_REASON_PREFIX) || reason.startsWith("21610")
}
