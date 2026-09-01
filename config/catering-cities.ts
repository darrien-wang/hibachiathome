// Metros with a /hibachi-catering/[city] page (the second keyword family).
// Shared by the catering route, sitemap, and cross-links so nothing links 404.
export const CATERING_CITIES = [
  "los-angeles",
  "san-diego",
  "long-beach",
  "pasadena",
  "riverside",
  "anaheim",
  "irvine",
  "huntington-beach",
] as const

export function hasCateringPage(slug: string): boolean {
  return (CATERING_CITIES as readonly string[]).includes(slug)
}
