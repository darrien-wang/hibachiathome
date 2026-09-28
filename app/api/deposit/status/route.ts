import { NextRequest, NextResponse } from "next/server"
import { findDepositLock } from "@/lib/deposit-lock"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { createServerSupabaseClient } from "@/lib/supabase"

// Asked by the deposit page as it opens: is this party already locked?
// Read-only. Answers with the order number and a planner link only when the
// caller holds the lead id from the texted link; an email + date match gets
// a bare yes/no. Never cached: a restored Safari tab must see the truth.
//
// With a lead id it also returns that lead's newest texted quote, so a
// customer holding two links (two headcounts, two prices) sees her latest
// details whichever one she opens (2026-09-27).
export const dynamic = "force-dynamic"

type LatestQuote = { adults: number; kids: number; location: string; date: string; total: number; at: string }

async function latestQuoteFor(leadId: string | null): Promise<LatestQuote | null> {
  if (!leadId || !/^[0-9a-f-]{36}$/i.test(leadId)) return null
  const supabase = createServerSupabaseClient()
  if (!supabase) return null
  const { data } = await supabase
    .from("lead_touchpoints")
    .select("raw_payload_json, created_at")
    .eq("lead_id", leadId)
    .eq("touchpoint_type", "landing_quote_text")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const p = (data?.raw_payload_json ?? null) as Record<string, unknown> | null
  const c = (p?.computed ?? null) as Record<string, unknown> | null
  if (!p || !c || typeof c.total !== "number") return null
  const date = typeof p.eventDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.eventDate) ? p.eventDate : ""
  return {
    adults: Number(p.adults) || 0,
    kids: Number(p.kids) || 0,
    location: typeof p.cityName === "string" ? p.cityName : "",
    date,
    total: c.total,
    at: String((data as { created_at?: string } | null)?.created_at ?? ""),
  }
}

export async function GET(request: NextRequest) {
  const limit = await rateLimit("deposit-status", request, 30, 60)
  if (!limit.ok) {
    const { status, body } = tooManyRequests()
    return NextResponse.json(body, { status })
  }

  const params = request.nextUrl.searchParams
  const leadId = params.get("lead_id")
  const [lock, latestQuote] = await Promise.all([
    findDepositLock({
      leadId,
      email: params.get("email"),
      eventDate: params.get("event_date"),
    }),
    latestQuoteFor(leadId).catch(() => null),
  ])

  const body = lock.locked
    ? {
        locked: true,
        order_no: lock.matchedBy === "lead" ? lock.orderNo : undefined,
        event_date: lock.eventDate ?? undefined,
        event_time: lock.eventTime ?? undefined,
        manage_url: lock.manageUrl ?? undefined,
      }
    : { locked: false, latest_quote: latestQuote ?? undefined }

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } })
}
