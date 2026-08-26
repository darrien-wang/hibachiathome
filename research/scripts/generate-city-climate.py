# -*- coding: utf-8 -*-
"""Emit config/city-climate.ts from the collected real data."""
import json, io

d = json.load(open('city_data.json'))
MON = "January February March April May June July August September October November December".split()
ABBR = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
FREE_MILES, FEE_PER_MILE = 50, 1

def runs(months):
    """[4,5,6,9,10] -> [(4,6),(9,10)], wrapping Dec->Jan into one range."""
    if not months: return []
    ms = sorted(months)
    out, start, prev = [], ms[0], ms[0]
    for m in ms[1:]:
        if m == prev + 1: prev = m; continue
        out.append((start, prev)); start = prev = m
    out.append((start, prev))
    if len(out) > 1 and out[0][0] == 1 and out[-1][1] == 12:
        out = [(out[-1][0], out[0][1])] + out[1:-1]
    return out

def phrase(months):
    r = runs(months)
    if not r: return ""
    parts = []
    for a, b in r:
        parts.append(MON[a-1] if a == b else "%s through %s" % (MON[a-1], MON[b-1]))
    if len(parts) == 1: return parts[0]
    return ", ".join(parts[:-1]) + " and " + parts[-1]

def hhmm(s):
    h, m = int(s[:2]), s[3:5]
    ap = "am" if h < 12 else "pm"
    hh = h % 12 or 12
    return "%d:%s%s" % (hh, m, ap)

rows = []
for slug, v in sorted(d.items()):
    if slug == 'base': continue
    c = {int(k): x for k, x in v['climate'].items()}
    mi = v['miles']
    fee = 0 if mi <= FREE_MILES else round((mi - FREE_MILES) * FEE_PER_MILE)

    evening = [m for m in range(1,13) if c[m]['rain_pct'] <= 12 and 72 <= c[m]['high'] <= 95]
    lunch   = [m for m in range(1,13) if c[m]['rain_pct'] <= 12 and 66 <= c[m]['high'] <= 84]
    hot     = [m for m in range(1,13) if c[m]['high'] >= 93]
    wettest = max(range(1,13), key=lambda m: c[m]['rain_pct'])
    peak    = max(range(1,13), key=lambda m: c[m]['sunset'])

    months_ts = ",\n      ".join(
      '{ month: "%s", high: %d, low: %d, rainPct: %d, sunset: "%s" }'
      % (ABBR[m-1], c[m]['high'], c[m]['low'], c[m]['rain_pct'], hhmm(c[m]['sunset']))
      for m in range(1,13))

    rows.append("""  "%s": {
    miles: %.1f,
    travelFee: %d,
    bestEvening: "%s",
    bestLunch: "%s",
    hotMonths: "%s",
    wettestMonth: "%s",
    wettestPct: %d,
    latestSunset: "%s",
    latestSunsetMonth: "%s",
    julyHigh: %d,
    januaryHigh: %d,
    months: [
      %s,
    ],
  },""" % (slug, mi, fee, phrase(evening), phrase(lunch), phrase(hot),
           MON[wettest-1], c[wettest]['rain_pct'], hhmm(c[peak]['sunset']), MON[peak-1],
           c[7]['high'], c[1]['high'], months_ts))

header = '''// GENERATED FILE - do not hand-edit. Regenerate with the collector in
// research/scripts/ if the base location or the source data changes.
//
// Every number here is measured, not written:
//   miles       driving distance from our base ZIP 91748 (Rowland Heights),
//               via OSRM road routing
//   travelFee   that distance under our published policy: first %d miles free,
//               then $%d for each mile beyond
//   months      2019-2024 daily observations from the Open-Meteo historical
//               archive, averaged by month. rainPct is the share of days with
//               at least 0.04 in of precipitation. sunset is real local sunset.
//
// The point of this file is that no competitor can copy it: it is our base,
// our travel policy, and six years of weather for the exact place we cook.

export type CityMonth = {
  month: string
  high: number
  low: number
  rainPct: number
  sunset: string
}

export type CityClimate = {
  miles: number
  travelFee: number
  bestEvening: string
  bestLunch: string
  hotMonths: string
  wettestMonth: string
  wettestPct: number
  latestSunset: string
  latestSunsetMonth: string
  julyHigh: number
  januaryHigh: number
  months: CityMonth[]
}

export const cityClimate: Record<string, CityClimate> = {
''' % (FREE_MILES, FEE_PER_MILE)

out = header + "\n".join(rows) + """
}

export function getCityClimate(slug: string): CityClimate | undefined {
  return cityClimate[slug]
}
"""

io.open('city-climate.ts', 'w', encoding='utf-8', newline='\n').write(out)
print("wrote city-climate.ts with %d cities" % len(rows))
for slug in ['santa-monica','burbank','palm-springs','malibu','san-diego']:
    v = d[slug]; mi = v['miles']
    print("  %-14s %5.1f mi  fee $%d" % (slug, mi, 0 if mi<=50 else round(mi-50)))
