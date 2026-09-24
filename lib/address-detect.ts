// Customers send the address in chat - as a street line, or as a map pin -
// and it used to live only in the SMS thread. A Friday party sat with
// "TBD" on the order two days out while the address had been sitting in a
// text since lunchtime (2026-09-23). Detect it, write it to the lead, and let
// the order drawer offer it with one tap.

const STREET_SUFFIX =
  "(?:st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|ln|lane|way|ct|court|cir|circle|pl|place|ter|terrace|trl|trail|pkwy|parkway|hwy|highway|loop|path|run|row|walk)"

/** "1610 Elmsford Ave La Habra Ca 90631", with or without the city/state/zip. */
const STREET_RE = new RegExp(
  String.raw`\b\d{1,6}\s+[A-Za-z0-9.''-]+(?:\s+[A-Za-z0-9.''-]+){0,4}\s+${STREET_SUFFIX}\b` +
    String.raw`(?:\s*(?:#|apt\.?|unit|ste\.?)\s*[A-Za-z0-9-]+)?` +
    String.raw`(?:\s*,?\s*[A-Za-z][A-Za-z .'-]{1,24})?` +
    String.raw`(?:\s*,?\s*(?:CA|California))?` +
    String.raw`(?:\s*,?\s*\d{5}(?:-\d{4})?)?`,
  "i",
)

const MAP_LINK_RE = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com)\/\S+/i

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim().replace(/[.,]$/, "")
}

/** A street address written in the message itself, or null. */
export function extractStreetAddress(text: string): string | null {
  const match = (text ?? "").match(STREET_RE)
  if (!match) return null
  const found = tidy(match[0])
  // "2 proteins per guest" style false positives are short and suffix-less.
  return found.length >= 10 ? found : null
}

/** A Google Maps link in the message, or null. */
export function extractMapLink(text: string): string | null {
  return (text ?? "").match(MAP_LINK_RE)?.[0] ?? null
}

/**
 * Follow a map link to the address Google shows. Short links redirect to a
 * maps.google.com URL carrying `q=<address>`. Best effort and quick - this
 * runs inside the inbound SMS webhook.
 */
export async function resolveMapLink(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; RealHibachi/1.0)" },
      signal: AbortSignal.timeout(4000),
    })
    const candidates = [response.url, await response.text().catch(() => "")]
    for (const candidate of candidates) {
      const q = candidate.match(/[?&]q=([^&"'<]+)/)
      if (q) {
        const decoded = tidy(decodeURIComponent(q[1].replace(/\+/g, " ")))
        if (/\d/.test(decoded) && decoded.length >= 8) return decoded
      }
    }
    return null
  } catch {
    return null
  }
}

/** What an inbound message tells us about where the party is. */
export async function addressFromMessage(text: string): Promise<{ address: string; via: "text" | "map_pin"; link?: string } | null> {
  const written = extractStreetAddress(text)
  if (written) return { address: written, via: "text" }
  const link = extractMapLink(text)
  if (!link) return null
  const resolved = await resolveMapLink(link)
  return resolved ? { address: resolved, via: "map_pin", link } : null
}

/** True when a stored value is a real street line rather than "Temecula" or "TBD". */
export function looksLikeStreetAddress(value: string | null | undefined): boolean {
  const v = (value ?? "").trim()
  if (!v || /^tbd$/i.test(v)) return false
  return /^\d/.test(v) && new RegExp(STREET_SUFFIX, "i").test(v)
}
