import type { SupabaseClient } from "@supabase/supabase-js"

type LeadType = "booking_inquiry" | "customer_support" | "partner_application"

type AttributionFields = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  gclid?: string
  wbraid?: string
  gbraid?: string
}

export type ContactLeadUpsertInput = {
  name: string
  email?: string
  phone?: string
  reason?: string
  message?: string
  leadSource?: string
  leadChannel?: string
  leadType?: string
  cityOrZip?: string
  guestCount?: string | number
  sourcePage?: string
  touchpointType?: string
  touchpointSource?: string
  externalCallId?: string
  manualEntryId?: string
  externalTouchpointId?: string
  attribution?: AttributionFields
  rawPayload?: Record<string, unknown>
}

type NormalizedLeadInput = {
  fullName: string
  email?: string
  phone?: string
  normalizedPhone?: string
  reason?: string
  message?: string
  leadType: LeadType
  leadSource: string
  leadChannel: string
  cityOrZip?: string
  guestCount?: number
  sourcePage?: string
  touchpointType: string
  touchpointSource: string
  externalCallId?: string
  manualEntryId?: string
  externalTouchpointId?: string
  attribution: AttributionFields
  rawPayload: Record<string, unknown>
}

export type LeadUpsertResult = {
  leadId: string
  deduped: boolean
  dedupeReason: "external_call_id" | "manual_entry_id" | "phone_window" | "email_window" | "new"
}

const DEDUPE_WINDOW_HOURS = 24
const SUPPORT_REASON_PATTERN = /support|feedback|refund|cancel|cancellation|reschedule|post[- ]?event|complaint|issue|help/i
const PARTNER_REASON_PATTERN = /partner|partnership|service provider|vendor/i

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeEmail(value: unknown): string | undefined {
  const email = asNonEmptyString(value)
  return email ? email.toLowerCase() : undefined
}

function normalizePhone(value: unknown): string | undefined {
  const phone = asNonEmptyString(value)
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, "")
  if (!digits) return undefined
  return digits
}

function normalizedPhoneForDedup(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.length <= 10) return value
  return value.slice(-10)
}

function inferLeadType(reason: string | undefined, explicitLeadType: string | undefined): LeadType {
  const normalizedExplicit = asNonEmptyString(explicitLeadType)?.toLowerCase()
  if (normalizedExplicit === "partner_application") return "partner_application"
  if (normalizedExplicit === "customer_support") return "customer_support"
  if (normalizedExplicit === "booking_inquiry") return "booking_inquiry"

  const normalizedReason = asNonEmptyString(reason)?.toLowerCase() ?? ""
  if (PARTNER_REASON_PATTERN.test(normalizedReason)) return "partner_application"
  if (SUPPORT_REASON_PATTERN.test(normalizedReason)) return "customer_support"
  return "booking_inquiry"
}

function inferLeadSource(explicitSource: string | undefined, leadType: LeadType): string {
  const source = asNonEmptyString(explicitSource)
  if (source) return source
  if (leadType === "partner_application") return "partner_opportunities_page"
  return "contact_page"
}

function parseCityOrZipFromMessage(message: string | undefined): string | undefined {
  if (!message) return undefined
  const line = message
    .split(/\r?\n/)
    .find((item) => item.toLowerCase().startsWith("city/zip:"))
  if (!line) return undefined
  const value = line.split(":").slice(1).join(":")
  const normalized = asNonEmptyString(value)
  if (!normalized || normalized.toLowerCase() === "not provided") return undefined
  return normalized
}

function parseGuestCountFromMessage(message: string | undefined): number | undefined {
  if (!message) return undefined
  const line = message
    .split(/\r?\n/)
    .find((item) => item.toLowerCase().startsWith("guest count:"))
  if (!line) return undefined
  const value = line.split(":").slice(1).join(":")
  const normalized = asNonEmptyString(value)
  if (!normalized || normalized.toLowerCase() === "not provided") return undefined
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return Math.trunc(parsed)
}

function normalizeGuestCount(value: string | number | undefined, fallbackFromMessage: number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value)
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.trunc(parsed)
    }
  }

  return fallbackFromMessage
}

function normalizeAttribution(value: AttributionFields | undefined): AttributionFields {
  if (!value || typeof value !== "object") return {}
  return {
    utm_source: asNonEmptyString(value.utm_source),
    utm_medium: asNonEmptyString(value.utm_medium),
    utm_campaign: asNonEmptyString(value.utm_campaign),
    utm_term: asNonEmptyString(value.utm_term),
    utm_content: asNonEmptyString(value.utm_content),
    gclid: asNonEmptyString(value.gclid),
    wbraid: asNonEmptyString(value.wbraid),
    gbraid: asNonEmptyString(value.gbraid),
  }
}

function normalizeInput(input: ContactLeadUpsertInput): NormalizedLeadInput {
  const message = asNonEmptyString(input.message)
  const reason = asNonEmptyString(input.reason)
  const leadType = inferLeadType(reason, input.leadType)
  const normalizedPhone = normalizePhone(input.phone)

  const fallbackCityOrZip = parseCityOrZipFromMessage(message)
  const fallbackGuestCount = parseGuestCountFromMessage(message)

  return {
    fullName: asNonEmptyString(input.name) ?? "Unknown Contact",
    email: normalizeEmail(input.email),
    phone: asNonEmptyString(input.phone),
    normalizedPhone: normalizedPhoneForDedup(normalizedPhone),
    reason,
    message,
    leadType,
    leadSource: inferLeadSource(input.leadSource, leadType),
    leadChannel: asNonEmptyString(input.leadChannel) ?? "contact_form",
    cityOrZip: asNonEmptyString(input.cityOrZip) ?? fallbackCityOrZip,
    guestCount: normalizeGuestCount(input.guestCount, fallbackGuestCount),
    sourcePage: asNonEmptyString(input.sourcePage),
    touchpointType: asNonEmptyString(input.touchpointType) ?? "contact_form",
    touchpointSource: asNonEmptyString(input.touchpointSource) ?? "website_api",
    externalCallId: asNonEmptyString(input.externalCallId),
    manualEntryId: asNonEmptyString(input.manualEntryId),
    externalTouchpointId: asNonEmptyString(input.externalTouchpointId),
    attribution: normalizeAttribution(input.attribution),
    rawPayload: input.rawPayload ?? {},
  }
}

function withFallback<T>(current: T | null | undefined, fallback: T | undefined): T | undefined {
  if (current === undefined || current === null) return fallback
  if (typeof current === "string" && current.trim().length === 0) return fallback
  return current
}

function withFallbackForUnknown(current: string | null | undefined, fallback: string | undefined): string | undefined {
  const normalized = asNonEmptyString(current)
  if (!normalized) return fallback
  const lowered = normalized.toLowerCase()
  if (lowered === "unknown" || lowered === "unspecified" || lowered === "n/a") {
    return fallback ?? normalized
  }
  return normalized
}

async function findExistingLead(
  supabase: SupabaseClient,
  input: NormalizedLeadInput,
): Promise<{ row: Record<string, any>; reason: LeadUpsertResult["dedupeReason"] } | null> {
  if (input.externalCallId) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("external_call_id", input.externalCallId)
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`Failed to query leads by external_call_id: ${error.message}`)
    if (data) return { row: data as Record<string, any>, reason: "external_call_id" }
  }

  if (input.manualEntryId) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("manual_entry_id", input.manualEntryId)
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`Failed to query leads by manual_entry_id: ${error.message}`)
    if (data) return { row: data as Record<string, any>, reason: "manual_entry_id" }
  }

  const windowStart = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  if (input.normalizedPhone) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("normalized_phone", input.normalizedPhone)
      .eq("lead_type", input.leadType)
      .gte("last_seen_at", windowStart)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`Failed to query leads by normalized_phone: ${error.message}`)
    if (data) return { row: data as Record<string, any>, reason: "phone_window" }
  }

  if (input.email) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("email", input.email)
      .eq("lead_type", input.leadType)
      .gte("last_seen_at", windowStart)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`Failed to query leads by email: ${error.message}`)
    if (data) return { row: data as Record<string, any>, reason: "email_window" }
  }

  return null
}

async function insertTouchpoint(
  supabase: SupabaseClient,
  leadId: string,
  input: NormalizedLeadInput,
): Promise<void> {
  const payload = {
    lead_id: leadId,
    touchpoint_type: input.touchpointType,
    touchpoint_source: input.touchpointSource,
    external_touchpoint_id: input.externalTouchpointId,
    raw_payload_json: input.rawPayload,
    occurred_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("lead_touchpoints").insert(payload)
  if (!error) return

  // Ignore unique conflict for repeated same external touchpoint.
  if ((error as { code?: string }).code === "23505") return

  throw new Error(`Failed to insert lead touchpoint: ${error.message}`)
}

export async function upsertLeadFromContact(
  supabase: SupabaseClient,
  rawInput: ContactLeadUpsertInput,
): Promise<LeadUpsertResult> {
  const input = normalizeInput(rawInput)
  const existing = await findExistingLead(supabase, input)
  const nowIso = new Date().toISOString()

  if (existing) {
    const current = existing.row
    const updatePayload = {
      full_name: withFallback(input.fullName, current.full_name),
      email: withFallback(current.email, input.email),
      phone: withFallback(current.phone, input.phone),
      normalized_phone: withFallback(current.normalized_phone, input.normalizedPhone),
      lead_source: withFallbackForUnknown(current.lead_source, input.leadSource) ?? input.leadSource,
      lead_channel: withFallbackForUnknown(current.lead_channel, input.leadChannel) ?? input.leadChannel,
      lead_type: current.lead_type ?? input.leadType,
      inquiry_reason: withFallback(current.inquiry_reason, input.reason),
      source_page: withFallback(current.source_page, input.sourcePage),
      city_or_zip: withFallback(current.city_or_zip, input.cityOrZip),
      guest_count: withFallback(current.guest_count, input.guestCount),
      latest_message: withFallback(input.message, current.latest_message),
      first_message: withFallback(current.first_message, input.message),
      utm_source: withFallback(current.utm_source, input.attribution.utm_source),
      utm_medium: withFallback(current.utm_medium, input.attribution.utm_medium),
      utm_campaign: withFallback(current.utm_campaign, input.attribution.utm_campaign),
      utm_term: withFallback(current.utm_term, input.attribution.utm_term),
      utm_content: withFallback(current.utm_content, input.attribution.utm_content),
      gclid: withFallback(current.gclid, input.attribution.gclid),
      wbraid: withFallback(current.wbraid, input.attribution.wbraid),
      gbraid: withFallback(current.gbraid, input.attribution.gbraid),
      external_call_id: withFallback(current.external_call_id, input.externalCallId),
      manual_entry_id: withFallback(current.manual_entry_id, input.manualEntryId),
      touchpoint_count: (Number(current.touchpoint_count) || 1) + 1,
      last_seen_at: nowIso,
      updated_at: nowIso,
    }

    const { data, error } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("id", current.id)
      .select("id")
      .single()
    if (error || !data) {
      throw new Error(`Failed to update deduped lead: ${error?.message ?? "unknown_error"}`)
    }

    await insertTouchpoint(supabase, String(data.id), input)

    return {
      leadId: String(data.id),
      deduped: true,
      dedupeReason: existing.reason,
    }
  }

  const insertPayload = {
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    normalized_phone: input.normalizedPhone,
    lead_source: input.leadSource,
    lead_channel: input.leadChannel,
    lead_type: input.leadType,
    inquiry_reason: input.reason,
    source_page: input.sourcePage,
    city_or_zip: input.cityOrZip,
    guest_count: input.guestCount,
    first_message: input.message,
    latest_message: input.message,
    utm_source: input.attribution.utm_source,
    utm_medium: input.attribution.utm_medium,
    utm_campaign: input.attribution.utm_campaign,
    utm_term: input.attribution.utm_term,
    utm_content: input.attribution.utm_content,
    gclid: input.attribution.gclid,
    wbraid: input.attribution.wbraid,
    gbraid: input.attribution.gbraid,
    external_call_id: input.externalCallId,
    manual_entry_id: input.manualEntryId,
    first_seen_at: nowIso,
    last_seen_at: nowIso,
    touchpoint_count: 1,
    updated_at: nowIso,
  }

  const { data, error } = await supabase.from("leads").insert(insertPayload).select("id").single()
  if (error || !data) {
    throw new Error(`Failed to insert lead: ${error?.message ?? "unknown_error"}`)
  }

  await insertTouchpoint(supabase, String(data.id), input)

  return {
    leadId: String(data.id),
    deduped: false,
    dedupeReason: "new",
  }
}

export function readAttributionFromCookieHeader(cookieHeader: string | null): AttributionFields {
  if (!cookieHeader) return {}

  const cookieEntries = cookieHeader.split(";").map((part) => part.trim())
  const rawEntry = cookieEntries.find((entry) => entry.startsWith("realhibachi_attribution="))
  if (!rawEntry) return {}

  const rawValue = rawEntry.slice("realhibachi_attribution=".length)
  if (!rawValue) return {}

  try {
    const decoded = decodeURIComponent(rawValue)
    const parsed = JSON.parse(decoded) as Record<string, unknown>
    return normalizeAttribution({
      utm_source: asNonEmptyString(parsed.utm_source),
      utm_medium: asNonEmptyString(parsed.utm_medium),
      utm_campaign: asNonEmptyString(parsed.utm_campaign),
      utm_term: asNonEmptyString(parsed.utm_term),
      utm_content: asNonEmptyString(parsed.utm_content),
      gclid: asNonEmptyString(parsed.gclid),
      wbraid: asNonEmptyString(parsed.wbraid),
      gbraid: asNonEmptyString(parsed.gbraid),
    })
  } catch {
    return {}
  }
}
