// City names for the Google "LA Cities" ad groups, keyed by the utm_content each
// group's final URL carries (2026-11-04, D-1104-03: 75 city groups, 40 of them
// landing on the /hibachi-at-home hub until they earn their own page). The ad
// headline said "Hibachi at Home in Downey"; the hub's estimator card says
// "LA & Orange County" — this table lets the card repeat the city the visitor
// clicked. A whitelist, not a title-case of the raw parameter: the URL is
// public and anything not listed here falls back to the ?loc= geo lookup.
const AD_CITY_NAMES: Record<string, string> = {
  // original groups
  anaheim: "Anaheim",
  buena_park: "Buena Park",
  burbank: "Burbank",
  cerritos: "Cerritos",
  chatsworth: "Chatsworth",
  encino: "Encino",
  fullerton: "Fullerton",
  glendale: "Glendale",
  huntington_beach: "Huntington Beach",
  irvine: "Irvine",
  lakewood: "Lakewood",
  long_beach: "Long Beach",
  los_angeles: "Los Angeles",
  newport_beach: "Newport Beach",
  north_hollywood: "North Hollywood",
  pasadena: "Pasadena",
  riverside: "Riverside",
  san_diego: "San Diego",
  san_pedro: "San Pedro",
  santa_clarita: "Santa Clarita",
  santa_monica: "Santa Monica",
  sherman_oaks: "Sherman Oaks",
  simi_valley: "Simi Valley",
  thousand_oaks: "Thousand Oaks",
  torrance: "Torrance",
  vista: "Vista",
  woodland_hills: "Woodland Hills",
  // 2026-11-04 small-city expansion — LA County
  west_covina: "West Covina",
  whittier: "Whittier",
  downey: "Downey",
  pomona: "Pomona",
  el_monte: "El Monte",
  inglewood: "Inglewood",
  alhambra: "Alhambra",
  compton: "Compton",
  south_gate: "South Gate",
  carson: "Carson",
  hawthorne: "Hawthorne",
  baldwin_park: "Baldwin Park",
  redondo_beach: "Redondo Beach",
  pico_rivera: "Pico Rivera",
  montebello: "Montebello",
  monterey_park: "Monterey Park",
  gardena: "Gardena",
  arcadia: "Arcadia",
  diamond_bar: "Diamond Bar",
  hacienda_heights: "Hacienda Heights",
  glendora: "Glendora",
  covina: "Covina",
  rowland_heights: "Rowland Heights",
  la_mirada: "La Mirada",
  culver_city: "Culver City",
  san_gabriel: "San Gabriel",
  manhattan_beach: "Manhattan Beach",
  beverly_hills: "Beverly Hills",
  // Orange County
  santa_ana: "Santa Ana",
  garden_grove: "Garden Grove",
  orange: "Orange",
  costa_mesa: "Costa Mesa",
  westminster: "Westminster",
  tustin: "Tustin",
  yorba_linda: "Yorba Linda",
  mission_viejo: "Mission Viejo",
  lake_forest: "Lake Forest",
  la_habra: "La Habra",
  fountain_valley: "Fountain Valley",
  placentia: "Placentia",
  aliso_viejo: "Aliso Viejo",
  // Inland Empire
  ontario: "Ontario",
  rancho_cucamonga: "Rancho Cucamonga",
  corona: "Corona",
  fontana: "Fontana",
  chino: "Chino",
  chino_hills: "Chino Hills",
  upland: "Upland",
  eastvale: "Eastvale",
  jurupa_valley: "Jurupa Valley",
}

/** The city an ad click names via utm_content, or null when it is not a city group (sitelinks, other campaigns). */
export function adCityName(utmContent: string | null | undefined): string | null {
  if (!utmContent) return null
  const key = String(utmContent).trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(AD_CITY_NAMES, key) ? AD_CITY_NAMES[key] : null
}
