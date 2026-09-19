// ============================================================
// Home base: where every driving distance is measured from
// ============================================================
// One value, used by the live travel-fee routes (quote page, agent API,
// order workbench) and by the generators that build config/city-travel.ts
// and config/city-climate.ts. Change it here and re-run
// research/scripts/generate-city-travel.py so the static city tables agree
// with the live routing again. The site never prints this location; the
// customer only ever sees "first 50 miles free, then $1/mile" and the miles.
//
// 2026-08-31: moved from 91748 (Rowland Heights) to 91744 (La Puente).
// 2026-09-18: made this the single source; before that the quote route
// already said 91744 while the city tables and the workbench route still
// said 91748, and the same Palm Springs address priced $36 one way and
// $41.90 the other.
export const HOME_BASE_ZIP = "91744"

// What the geocoder is asked for. A ZIP centroid, not the street address.
export const HOME_BASE_QUERY = `${HOME_BASE_ZIP}, CA, USA`

// Runtime origin for the routing services. TRAVEL_ORIGIN_ADDRESS lets an
// environment point somewhere else (a second dispatch point, a test) without
// a deploy; the config value is the default everywhere.
export function homeBaseOrigin(): string {
  const env = process.env.TRAVEL_ORIGIN_ADDRESS?.trim()
  return env || HOME_BASE_ZIP
}
