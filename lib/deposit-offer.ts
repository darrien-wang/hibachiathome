import type { NextRequest } from "next/server"
import { findDepositOffer, type DepositOffer } from "@/config/deposit-offers"
import { createServerSupabaseClient } from "@/lib/supabase"

// Server-side truth for channel deposit offers. Two things can qualify a
// deposit: the visit's own attribution (the realhibachi_attribution cookie
// set on landing, or utm params on the request) and the lead the deposit link
// names - a texted link is often opened on another device with no cookie,
// but the lead already carries the utm set from the page that produced it.
// The ?offer= code in a link is never enough on its own.

type OfferAttribution = { utm_source?: string; utm_medium?: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ATTRIBUTION_COOKIE_NAME = "realhibachi_attribution"

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export function readOfferAttribution(request: NextRequest): OfferAttribution {
  const fromQuery: OfferAttribution = {
    utm_source: cleanString(request.nextUrl.searchParams.get("utm_source")),
    utm_medium: cleanString(request.nextUrl.searchParams.get("utm_medium")),
  }
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return fromQuery
  const rawEntry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((entry) => entry.startsWith(`${ATTRIBUTION_COOKIE_NAME}=`))
  if (!rawEntry) return fromQuery
  try {
    const parsed = JSON.parse(decodeURIComponent(rawEntry.slice(ATTRIBUTION_COOKIE_NAME.length + 1))) as Record<string, unknown>
    // The cookie is the landing that started this visit; it wins over query
    // params the same way /api/deposit/start merges them.
    return {
      utm_source: cleanString(parsed.utm_source) ?? fromQuery.utm_source,
      utm_medium: cleanString(parsed.utm_medium) ?? fromQuery.utm_medium,
    }
  } catch {
    return fromQuery
  }
}

async function loadLeadAttribution(leadId: string): Promise<OfferAttribution | undefined> {
  if (!UUID_PATTERN.test(leadId)) return undefined
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) return undefined
    const { data } = await supabase.from("leads").select("utm_source, utm_medium").eq("id", leadId).maybeSingle()
    if (!data) return undefined
    return { utm_source: cleanString(data.utm_source), utm_medium: cleanString(data.utm_medium) }
  } catch (error) {
    console.warn("[deposit-offer] lead attribution lookup failed", error instanceof Error ? error.message : error)
    return undefined
  }
}

export async function resolveDepositOffer(params: {
  attribution: OfferAttribution
  leadId?: string
  now?: Date
}): Promise<DepositOffer | undefined> {
  const fromVisit = findDepositOffer({ ...params.attribution, now: params.now })
  if (fromVisit) return fromVisit
  if (!params.leadId) return undefined
  const lead = await loadLeadAttribution(params.leadId)
  return lead ? findDepositOffer({ ...lead, now: params.now }) : undefined
}
