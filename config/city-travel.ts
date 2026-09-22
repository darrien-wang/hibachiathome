// GENERATED 2026-09-22 by research/scripts/generate-city-travel.py — driving miles
// from the home base in config/home-base.ts (ZIP 91744), measured by the
// same /api/quote/travel-fee service the quote page and the invoice tool use,
// and the travel fee under the published policy: first 50 miles free, then
// $1 per mile. Re-run the script if the base moves or a city page is added.
// The site never states where the base is.

export type CityTravel = { miles: number; fee: number }

export const cityTravel: Record<string, CityTravel> = {
  "los-angeles": { miles: 20.2, fee: 0 }, // Los Angeles
  "downtown-los-angeles": { miles: 21.7, fee: 0 }, // Downtown LA
  "hollywood": { miles: 26.2, fee: 0 }, // Hollywood
  "west-hollywood": { miles: 28.2, fee: 0 }, // West Hollywood
  "beverly-hills": { miles: 30.5, fee: 0 }, // Beverly Hills
  "culver-city": { miles: 29.5, fee: 0 }, // Culver City
  "burbank": { miles: 29.1, fee: 0 }, // Burbank
  "thousand-oaks": { miles: 60.3, fee: 10 }, // Thousand Oaks
  "west-covina": { miles: 4.0, fee: 0 }, // West Covina
  "whittier": { miles: 9.0, fee: 0 }, // Whittier
  "arcadia": { miles: 13.1, fee: 0 }, // Arcadia
  "san-gabriel": { miles: 13.3, fee: 0 }, // San Gabriel
  "rowland-heights": { miles: 8.3, fee: 0 }, // Rowland Heights
  "diamond-bar": { miles: 12.2, fee: 0 }, // Diamond Bar
  "inglewood": { miles: 33.0, fee: 0 }, // Inglewood
  "malibu": { miles: 47.2, fee: 0 }, // Malibu
  "woodland-hills": { miles: 45.7, fee: 0 }, // Woodland Hills
  "san-diego": { miles: 113.4, fee: 63 }, // San Diego
  "irvine": { miles: 32.7, fee: 0 }, // Irvine
  "anaheim": { miles: 18.1, fee: 0 }, // Anaheim
  "long-beach": { miles: 32.8, fee: 0 }, // Long Beach
  "pasadena": { miles: 22.2, fee: 0 }, // Pasadena
  "santa-monica": { miles: 34.8, fee: 0 }, // Santa Monica
  "huntington-beach": { miles: 37.2, fee: 0 }, // Huntington Beach
  "riverside": { miles: 38.9, fee: 0 }, // Riverside
  "temecula": { miles: 69.6, fee: 20 }, // Temecula
  "santa-clarita": { miles: 53.4, fee: 3 }, // Santa Clarita
  "torrance": { miles: 35.4, fee: 0 }, // Torrance
  "newport-beach": { miles: 37.2, fee: 0 }, // Newport Beach
  "glendale": { miles: 27.5, fee: 0 }, // Glendale
  "corona": { miles: 31.8, fee: 0 }, // Corona
  "oceanside": { miles: 76.2, fee: 26 }, // Oceanside
  "palm-springs": { miles: 92.1, fee: 42 }, // Palm Springs
  "joshua-tree": { miles: 112.5, fee: 62 }, // Joshua Tree
  "big-bear-lake": { miles: 82.8, fee: 33 }, // Big Bear Lake
  "la-quinta": { miles: 112.0, fee: 62 }, // La Quinta
  "la-jolla": { miles: 104.7, fee: 55 }, // La Jolla
  "santa-barbara": { miles: 116.2, fee: 66 }, // Santa Barbara
  "idyllwild": { miles: 94.0, fee: 44 }, // Idyllwild
  "san-pedro": { miles: 39.6, fee: 0 }, // San Pedro
  "lakewood": { miles: 22.3, fee: 0 }, // Lakewood
  "cerritos": { miles: 15.3, fee: 0 }, // Cerritos
  "sherman-oaks": { miles: 36.6, fee: 0 }, // Sherman Oaks
  "encino": { miles: 39.8, fee: 0 }, // Encino
  "chatsworth": { miles: 49.8, fee: 0 }, // Chatsworth
  "north-hollywood": { miles: 32.3, fee: 0 }, // North Hollywood
  "buena-park": { miles: 13.8, fee: 0 }, // Buena Park
  "fullerton": { miles: 15.1, fee: 0 }, // Fullerton
  "vista": { miles: 85.5, fee: 36 }, // Vista
  "simi-valley": { miles: 58.9, fee: 9 }, // Simi Valley
}

export function getCityTravel(slug: string): CityTravel | undefined {
  return cityTravel[slug]
}
