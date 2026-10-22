import type { SupabaseClient } from "@supabase/supabase-js"

// What kind of line a lead's phone number is, before the first text goes out
// (2026-10-21, owner: "开始做吧"). A landline or a fixed VoIP line never
// receives SMS: until now the price text left, the carrier bounced it minutes
// later (30006), sms-status flagged the lead, and the inbox raised "短信打不通，
// 改发邮件" - after the customer had already waited. Twilio Lookup answers the
// same question up front for $0.008 a number, so the quote goes by email at
// once and nothing automatic is texted to a line that cannot read it.
//
// Twilio is the carrier we already pay; Lookup rides on the same credentials
// as sendSms. Results are cached in phone_line_types (a number does not change
// type), and every failure is fail-open: "unknown" means "text as before".

export type LineType =
  | "mobile"
  | "landline"
  | "fixedVoip"
  | "nonFixedVoip"
  | "personal"
  | "tollFree"
  | "premium"
  | "sharedCost"
  | "uan"
  | "voicemail"
  | "pager"
  | "unknown"

export type LineTypeResult = { type: LineType; carrier: string | null; source: "cache" | "twilio" | "none" }

/** sms_blocked_reason prefix for a number Lookup ruled out, so the inbox and desk can say "座机" instead of quoting a carrier error. */
export const LOOKUP_BLOCK_PREFIX = "lookup:"

const LINE_TYPES: ReadonlySet<string> = new Set<LineType>([
  "mobile",
  "landline",
  "fixedVoip",
  "nonFixedVoip",
  "personal",
  "tollFree",
  "premium",
  "sharedCost",
  "uan",
  "voicemail",
  "pager",
  "unknown",
])

/**
 * Can this line receive our texts? true = yes, false = no, null = we don't
 * know (treat as yes). Non-fixed VoIP (Google Voice, TextNow) does receive SMS
 * and is common among customers, so only lines that physically cannot take a
 * text are ruled out.
 */
export function smsCapable(type: LineType | string | null | undefined): boolean | null {
  switch (type) {
    case "mobile":
    case "nonFixedVoip":
    case "personal":
      return true
    case "landline":
    case "fixedVoip":
    case "tollFree":
    case "premium":
    case "sharedCost":
    case "uan":
    case "voicemail":
    case "pager":
      return false
    default:
      return null
  }
}

const LABELS: Record<string, string> = {
  landline: "landline",
  fixedVoip: "fixed VoIP line",
  tollFree: "toll-free number",
  premium: "premium-rate number",
  sharedCost: "shared-cost number",
  uan: "company switchboard number",
  voicemail: "voicemail-only number",
  pager: "pager",
}

/** The sms_blocked_reason to store when Lookup rules a number out; null when it can be texted. */
export function blockReason(result: Pick<LineTypeResult, "type" | "carrier">): string | null {
  if (smsCapable(result.type) !== false) return null
  const label = LABELS[result.type] ?? result.type
  return `${LOOKUP_BLOCK_PREFIX} ${label}${result.carrier ? ` (${result.carrier})` : ""}`
}

export function isLookupBlock(reason: string | null | undefined): boolean {
  return typeof reason === "string" && reason.startsWith(LOOKUP_BLOCK_PREFIX)
}

/** Twilio Lookup v2 body -> the two fields we keep. Anything odd is "unknown". */
export function parseLookup(json: unknown): { type: LineType; carrier: string | null } {
  const lti = (json as { line_type_intelligence?: { type?: unknown; carrier_name?: unknown } | null } | null)?.line_type_intelligence
  const raw = typeof lti?.type === "string" ? lti.type : ""
  const type = (LINE_TYPES.has(raw) ? raw : "unknown") as LineType
  const carrier = typeof lti?.carrier_name === "string" && lti.carrier_name.trim() ? lti.carrier_name.trim() : null
  return { type, carrier }
}

type Deps = {
  supabase?: SupabaseClient | null
  fetchImpl?: typeof fetch
  accountSid?: string
  authToken?: string
  timeoutMs?: number
}

/**
 * Line type for an E.164 number: the cache first, then Twilio Lookup, with
 * the answer written back. Never throws; "unknown"/"none" means carry on as
 * if nothing was asked.
 */
export async function lookupLineType(e164: string, deps: Deps = {}): Promise<LineTypeResult> {
  const supabase = deps.supabase ?? null
  if (supabase) {
    const { data } = await supabase.from("phone_line_types").select("line_type, carrier").eq("phone_e164", e164).maybeSingle()
    const cached = data as { line_type: string; carrier: string | null } | null
    if (cached && LINE_TYPES.has(cached.line_type)) return { type: cached.line_type as LineType, carrier: cached.carrier, source: "cache" }
  }

  const accountSid = deps.accountSid ?? process.env.TWILIO_ACCOUNT_SID
  const token = deps.authToken ?? process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !token) return { type: "unknown", carrier: null, source: "none" }
  const fetchImpl = deps.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 4000)
  try {
    const res = await fetchImpl(`https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence`, {
      headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${token}`).toString("base64")}` },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) {
      console.warn("[phone-line-type] lookup failed", { e164, status: res.status })
      return { type: "unknown", carrier: null, source: "none" }
    }
    const json = (await res.json().catch(() => null)) as unknown
    const parsed = parseLookup(json)
    if (supabase && parsed.type !== "unknown") {
      await supabase
        .from("phone_line_types")
        .upsert({ phone_e164: e164, line_type: parsed.type, carrier: parsed.carrier, raw: json ?? null, looked_up_at: new Date().toISOString() }, { onConflict: "phone_e164" })
    }
    return { ...parsed, source: "twilio" }
  } catch (error) {
    console.warn("[phone-line-type] lookup error", { e164, error: error instanceof Error ? error.message : String(error) })
    return { type: "unknown", carrier: null, source: "none" }
  } finally {
    clearTimeout(timer)
  }
}
