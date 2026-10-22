// Weekly competitor watch (/api/admin/competitor-watch, 2026-10-21): who is
// advertising hibachi-at-home in Southern California this week, and what their
// newest Google reviews complain about. Read-only; the report lands in
// competitor_watch_reports and the ops inbox every Monday morning.
//
// placeId comes from Google Maps (the dataforseo google-business/reviews pull of
// 2026-10-21); a name search can land on the wrong business ("Sakesake" found a
// sushi bar), so only ids go here. domain is what the Google Ads Transparency
// Center is asked about; leave it out when we don't know it. aliases are
// lower-case fragments matched against ad page names, post authors and copy.

export type Competitor = { name: string; domain?: string; placeId?: string; aliases: string[] }

export const COMPETITORS: Competitor[] = [
  { name: "Hibachi 4Ever", placeId: "ChIJ050bbn1_OEARvKSmhXgi7-s", aliases: ["hibachi 4ever", "hibachi4ever"] },
  { name: "Hibachi at Home Catering LA", placeId: "ChIJp3CXKvEaYioRpnh1CMChFHM", aliases: ["hibachi at home catering"] },
  { name: "Let's Hibachi", placeId: "ChIJO6mMglH8RUoRFP_peq5-_0M", aliases: ["let's hibachi", "lets hibachi", "letshibachi"] },
  { name: "OMG Hibachi", domain: "omghibachi.com", placeId: "ChIJr36H5mi13IARpJO_6fzrRxU", aliases: ["omg hibachi", "omghibachi"] },
  { name: "Senshi Hibachi", placeId: "ChIJxy70vY-x3IARA9M1ifp3I8I", aliases: ["senshi"] },
  { name: "JustOne Hibachi", placeId: "ChIJr-HlC5bXwoARkobKjL3SExw", aliases: ["justone hibachi", "just one hibachi", "justonehibachi"] },
  { name: "Monster Hibachi", domain: "monsterhibachi.com", placeId: "ChIJRQTmUsHXwoARRiclAKrvx0k", aliases: ["monster hibachi", "monsterhibachi"] },
  { name: "TacoMan (hibachi)", domain: "tacoman.com", aliases: ["taco man", "tacoman"] },
  { name: "Love Hibachi", domain: "lovehibachi.com", aliases: ["love hibachi", "lovehibachi"] },
  { name: "Patio Hibachi", aliases: ["patio hibachi", "patiohibachi"] },
  { name: "Hibachi2u", domain: "hibachi2u.com", aliases: ["hibachi2u", "hibachi 2u"] },
  { name: "Yaki24", aliases: ["yaki24", "yaki 24"] },
  { name: "Fuji Flame Hibachi", aliases: ["fuji flame", "fujihibachi"] },
]

/** Meta Ad Library queries, loose keyword match, newest first. The plain "hibachi" one also gives the national total. */
export const META_AD_QUERIES = ["hibachi los angeles", "hibachi orange county", "hibachi"]

/** Place names that make a national "hibachi" ad relevant to us. */
export const SOCAL_PLACES_RE =
  /(los angeles|orange county|southern california|socal|san diego|inland empire|palm springs|riverside|temecula|san fernando|san gabriel|long beach|irvine|anaheim|pasadena|ventura|big bear|joshua tree|santa barbara|torrance|burbank|glendale)/i
/** Upper-case LA / OC as a word, case-sensitive on purpose ("la" is also Spanish). */
export const SOCAL_ABBR_RE = /\b(LA|OC)\b/

/** Google reviews at or under this rating count as complaints. */
export const COMPLAINT_MAX_RATING = 3
/** Only reviews newer than this many days make the weekly report. */
export const WATCH_WINDOW_DAYS = 7
/** Newest reviews pulled per competitor (one litescrape call, $0.00015). */
export const REVIEWS_PER_COMPETITOR = 20
