/**
 * Cities where the beach is the reason people are throwing the party.
 *
 * These pages lead with a table set on the sand at sunset instead of the fire
 * show: someone searching for hibachi in Newport or La Jolla is picturing the
 * view, and the hero should show them the evening they already have in mind.
 * Inland pages keep the fire show, which is the stronger image when there is
 * no view to sell.
 *
 * The Destination Rentals campaign lands on several of these directly
 * (OC Coast → newport-beach, San Diego Coast → la-jolla).
 */
export const COASTAL_CITIES = [
  "malibu",
  "santa-monica",
  "long-beach",
  "huntington-beach",
  "newport-beach",
  "la-jolla",
] as const

export const BEACH_HERO = "/images/hero/beach-sunset-hero.jpg"

export function isCoastalCity(slug: string): boolean {
  return (COASTAL_CITIES as readonly string[]).includes(slug)
}

/** Hero override for a city page, or undefined to keep the default fire show. */
export function coastalHero(slug: string, city: string): { heroImage: string; heroAlt: string } | undefined {
  if (!isCoastalCity(slug)) return undefined
  return {
    heroImage: BEACH_HERO,
    heroAlt: `Long dinner table set on the sand at sunset for a hibachi party in ${city}`,
  }
}
