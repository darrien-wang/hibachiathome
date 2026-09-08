// GENERATED 2026-09-08 by scratchpad/travel_fees.py — driving miles from our base
// (OSRM public router, Nominatim geocoding of the city centre) and the travel fee
// under the published policy: first 50 miles free, then $1 per mile. Re-run the
// script if the base moves. The site never states where the base is.

export type CityTravel = { miles: number; fee: number }

export const cityTravel: Record<string, CityTravel> = {
  "los-angeles": { miles: 20.3, fee: 0 }, // Los Angeles
  "downtown-los-angeles": { miles: 18.9, fee: 0 }, // Downtown LA
  "hollywood": { miles: 26.3, fee: 0 }, // Hollywood
  "west-hollywood": { miles: 28.3, fee: 0 }, // West Hollywood
  "beverly-hills": { miles: 29.8, fee: 0 }, // Beverly Hills
  "culver-city": { miles: 28.7, fee: 0 }, // Culver City
  "burbank": { miles: 30.1, fee: 0 }, // Burbank
  "thousand-oaks": { miles: 61.3, fee: 11 }, // Thousand Oaks
  "west-covina": { miles: 3.9, fee: 0 }, // West Covina
  "whittier": { miles: 8.2, fee: 0 }, // Whittier
  "arcadia": { miles: 12.1, fee: 0 }, // Arcadia
  "san-gabriel": { miles: 13.5, fee: 0 }, // San Gabriel
  "rowland-heights": { miles: 8.2, fee: 0 }, // Rowland Heights
  "diamond-bar": { miles: 12.2, fee: 0 }, // Diamond Bar
  "inglewood": { miles: 32.3, fee: 0 }, // Inglewood
  "malibu": { miles: 46.5, fee: 0 }, // Malibu
  "woodland-hills": { miles: 46.6, fee: 0 }, // Woodland Hills
  "san-diego": { miles: 112.7, fee: 63 }, // San Diego
  "irvine": { miles: 32.2, fee: 0 }, // Irvine
  "anaheim": { miles: 18.1, fee: 0 }, // Anaheim
  "long-beach": { miles: 32.1, fee: 0 }, // Long Beach
  "pasadena": { miles: 22.0, fee: 0 }, // Pasadena
  "santa-monica": { miles: 34.0, fee: 0 }, // Santa Monica
  "huntington-beach": { miles: 36.4, fee: 0 }, // Huntington Beach
  "riverside": { miles: 38.9, fee: 0 }, // Riverside
  "temecula": { miles: 69.9, fee: 20 }, // Temecula
  "santa-clarita": { miles: 54.3, fee: 4 }, // Santa Clarita
  "torrance": { miles: 34.6, fee: 0 }, // Torrance
  "newport-beach": { miles: 36.7, fee: 0 }, // Newport Beach
  "glendale": { miles: 28.1, fee: 0 }, // Glendale
  "corona": { miles: 32.0, fee: 0 }, // Corona
  "oceanside": { miles: 75.6, fee: 26 }, // Oceanside
  "palm-springs": { miles: 92.3, fee: 42 }, // Palm Springs
  "joshua-tree": { miles: 112.7, fee: 63 }, // Joshua Tree
  "big-bear-lake": { miles: 83.0, fee: 33 }, // Big Bear Lake
  "la-quinta": { miles: 112.2, fee: 62 }, // La Quinta
  "la-jolla": { miles: 104.1, fee: 54 }, // La Jolla
}

export function getCityTravel(slug: string): CityTravel | undefined {
  return cityTravel[slug]
}
