// Meta lead-form ads (Instant Forms) -> the same quote flow as the landing card.
//
// 2026-10-21 (owner): a Facebook/Instagram visitor should be able to ask for the
// price without leaving the app or calling. The ad opens an Instant Form that
// prefills name, phone and email and asks three things we need for a quote:
// guests, party date, city or ZIP. Meta keeps the answers; every couple of
// minutes a cron asks for the new ones (/api/admin/meta-leads) and hands each
// one to /api/landing-quote, so the customer gets the same text with the exact
// price and the lock link, the lead lands in the workbench with channel
// meta_ads, and template B follows two minutes later as usual.
//
// Reading leads needs a token with leads_retrieval + pages_manage_ads on the
// Page (META_LEADS_TOKEN; META_ACCESS_TOKEN as a fallback if the owner regenerates
// that one with the extra scopes). Without it every call says so.

const GRAPH = "https://graph.facebook.com/v21.0"
/** Real Hibachi Page (not a secret - it is on every Business Suite URL). */
export const META_PAGE_ID = process.env.META_PAGE_ID?.trim() || "1278206205381427"

export function metaLeadsToken(): string {
  return process.env.META_LEADS_TOKEN?.trim() || process.env.META_ACCESS_TOKEN?.trim() || ""
}

export type MetaLeadForm = { id: string; name: string; status?: string }
export type MetaLeadField = { name: string; values: string[] }
export type MetaLead = {
  id: string
  created_time: string
  field_data: MetaLeadField[]
  ad_id?: string
  ad_name?: string
  adset_name?: string
  campaign_name?: string
  form_id?: string
}

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number; type?: string } }
type Paged<T> = { data?: T[]; paging?: { next?: string; cursors?: { after?: string } } }

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = metaLeadsToken()
  if (!token) throw new Error("META_LEADS_TOKEN not set")
  const qs = new URLSearchParams({ ...params, access_token: token })
  const res = await fetch(`${GRAPH}/${path}?${qs.toString()}`, { cache: "no-store" })
  const json = (await res.json().catch(() => ({}))) as T & GraphError
  if (!res.ok || json.error) {
    const e = json.error ?? {}
    const code = e.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""})` : ""
    throw new Error(`Graph ${path}: ${e.message ?? `HTTP ${res.status}`}${code}`)
  }
  return json
}

async function graphPages<T>(path: string, params: Record<string, string>, maxPages = 10): Promise<T[]> {
  const out: T[] = []
  let p = { ...params }
  for (let page = 0; page < maxPages; page++) {
    const json = await graphGet<Paged<T>>(path, p)
    out.push(...(json.data ?? []))
    const after = json.paging?.next ? json.paging.cursors?.after : undefined
    if (!after) break
    p = { ...p, after }
  }
  return out
}

/** The Page's lead forms (every status - an archived form can still hold leads). */
export async function fetchLeadForms(pageId = META_PAGE_ID): Promise<MetaLeadForm[]> {
  return graphPages<MetaLeadForm>(`${pageId}/leadgen_forms`, { fields: "id,name,status", limit: "50" })
}

/** Leads submitted to one form after `sinceUnix` (seconds), oldest first. */
export async function fetchFormLeads(formId: string, sinceUnix: number): Promise<MetaLead[]> {
  const rows = await graphPages<MetaLead>(`${formId}/leads`, {
    fields: "id,created_time,field_data,ad_id,ad_name,adset_name,campaign_name,form_id",
    filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: Math.floor(sinceUnix) }]),
    limit: "100",
  })
  return rows.sort((a, b) => a.created_time.localeCompare(b.created_time))
}

export type ParsedLead = {
  name: string
  phone: string
  email: string
  /** Raw answers, as typed. */
  guestsText: string
  dateText: string
  cityText: string
  adults: number
  /** ISO date or "" when the answer is not a date (date TBD). */
  eventDate: string
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

function firstValue(fields: MetaLeadField[], ...needles: string[]): string {
  for (const n of needles) {
    const f = fields.find((x) => (x.name ?? "").toLowerCase() === n)
    if (f?.values?.[0]) return String(f.values[0]).trim()
  }
  for (const n of needles) {
    const f = fields.find((x) => (x.name ?? "").toLowerCase().includes(n))
    if (f?.values?.[0]) return String(f.values[0]).trim()
  }
  return ""
}

/** "20", "about 20", "20-25 people", "20 adults + 4 kids" -> 20. 0 when no number. */
export function parseGuests(text: string): number {
  const m = /(\d{1,3})/.exec(text ?? "")
  return m ? Math.min(300, Math.max(0, Number(m[1]))) : 0
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function iso(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return ""
  return `${y}-${pad(m)}-${pad(d)}`
}

/**
 * A party date as people type it into a short-answer box: "11/15", "11/15/26",
 * "Nov 15", "November 15th", "15 Nov", "Sat Nov 15", "2026-11-15". "not sure",
 * "tbd" and the like are no date. Month/day without a year means the next such
 * date on or after `today` (ISO, Pacific). Returns "" when unsure - the quote
 * then says "date TBD", which is what the landing card does.
 */
export function parsePartyDate(text: string, today: string): string {
  const t = (text ?? "").trim().toLowerCase()
  if (!t || /\b(not sure|tbd|tba|unsure|don'?t know|no date|flexible|undecided)\b/.test(t)) return ""
  const [ty] = today.split("-").map(Number)
  const nextOnOrAfter = (m: number, d: number): string => {
    const thisYear = iso(ty, m, d)
    if (thisYear && thisYear >= today) return thisYear
    return iso(ty + 1, m, d)
  }
  let m: RegExpExecArray | null
  if ((m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) return iso(Number(m[1]), Number(m[2]), Number(m[3]))
  if ((m = /(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/.exec(t))) {
    const mo = Number(m[1])
    const da = Number(m[2])
    if (m[3]) return iso(Number(m[3].length === 2 ? `20${m[3]}` : m[3]), mo, da)
    return nextOnOrAfter(mo, da)
  }
  const monthWord = new RegExp(`\\b(${MONTHS.join("|")})[a-z]*\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?`)
  if ((m = monthWord.exec(t))) {
    const mo = MONTHS.indexOf(m[1]) + 1
    const da = Number(m[2])
    return m[3] ? iso(Number(m[3]), mo, da) : nextOnOrAfter(mo, da)
  }
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join("|")})[a-z]*\\.?(?:,?\\s*(\\d{4}))?`)
  if ((m = dayFirst.exec(t))) {
    const da = Number(m[1])
    const mo = MONTHS.indexOf(m[2]) + 1
    return m[3] ? iso(Number(m[3]), mo, da) : nextOnOrAfter(mo, da)
  }
  return ""
}

/** The form's answers in the shape /api/landing-quote wants. */
export function parseLead(lead: MetaLead, today: string): ParsedLead {
  const f = lead.field_data ?? []
  const first = firstValue(f, "first_name")
  const last = firstValue(f, "last_name")
  const name = firstValue(f, "full_name") || [first, last].filter(Boolean).join(" ")
  const phone = firstValue(f, "phone_number", "phone")
  const email = firstValue(f, "email")
  const guestsText = firstValue(f, "guests", "how_many_guests", "guest", "headcount", "people")
  const dateText = firstValue(f, "party_date", "event_date", "date")
  const cityText = firstValue(f, "city_zip", "city_or_zip", "zip", "city")
  return {
    name,
    phone,
    email,
    guestsText,
    dateText,
    cityText,
    adults: parseGuests(guestsText),
    eventDate: parsePartyDate(dateText, today),
  }
}
