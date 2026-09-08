import { NextResponse } from "next/server"
import geoCa from "@/config/geo-ca.json"

// Resolves a Google Ads geo target id (the &loc={loc_physical_ms} the account
// suffix appends to every click) to a display name for the landing page h1.
// Cities, neighborhoods and counties resolve from the static table; postal
// codes (what Google actually sends for most phone clicks) go through a
// ZIP -> place lookup so "91745" becomes "Hacienda Heights". Unknown ids
// return null and the page keeps its own city. Server-only: the 100KB table
// never ships to the client.

type Entry = [kind: "zip" | "city" | "hood" | "county", name: string]
const TABLE = geoCa as Record<string, Entry>

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ZIP_CACHE = new Map<string, string | null>()

async function zipToPlace(zip: string): Promise<string | null> {
  if (ZIP_CACHE.has(zip)) return ZIP_CACHE.get(zip) ?? null
  let place: string | null = null
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const data = (await res.json()) as { places?: Array<{ "place name"?: string; "state abbreviation"?: string }> }
      const first = data.places?.[0]
      if (first && first["state abbreviation"] === "CA" && first["place name"]) place = first["place name"]
    }
  } catch {
    place = null
  }
  ZIP_CACHE.set(zip, place)
  return place
}

export async function GET(request: Request) {
  const loc = new URL(request.url).searchParams.get("loc")?.trim() ?? ""
  if (!/^\d{1,12}$/.test(loc)) return NextResponse.json({ name: null }, { headers: { "Cache-Control": "public, max-age=86400" } })
  const entry = TABLE[loc]
  if (!entry) return NextResponse.json({ name: null }, { headers: { "Cache-Control": "public, max-age=86400" } })
  const [kind, name] = entry
  let resolved: string | null = name
  if (kind === "zip") resolved = await zipToPlace(name)
  if (kind === "county") resolved = `${name} County`
  return NextResponse.json({ name: resolved, kind }, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000" } })
}
