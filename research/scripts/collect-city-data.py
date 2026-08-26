# -*- coding: utf-8 -*-
"""Collect real per-city data for the Real Hibachi city pages.

  distance  OSRM driving miles from our base ZIP 91748 (Rowland Heights)
  climate   Open-Meteo historical archive, 2019-2024, aggregated by month
  sunset    from the same archive, so it is the real local sunset

No API keys. Nominatim for geocoding (1 req/sec as their policy requires).
"""
import json, os, time, urllib.request, urllib.parse, statistics, re, sys

UA = {'User-Agent': 'realhibachi-city-data/1.0 (support@realhibachi.com)'}
CACHE = 'city_data.json'
BASE_QUERY = "Rowland Heights, California, USA"   # ZIP 91748

CITIES = [
 ("los-angeles","Los Angeles"),("downtown-los-angeles","Downtown Los Angeles"),
 ("hollywood","Hollywood, Los Angeles"),("west-hollywood","West Hollywood"),
 ("beverly-hills","Beverly Hills"),("culver-city","Culver City"),("burbank","Burbank"),
 ("inglewood","Inglewood"),("malibu","Malibu"),("woodland-hills","Woodland Hills, Los Angeles"),
 ("arcadia","Arcadia, California"),("san-gabriel","San Gabriel, California"),
 ("rowland-heights","Rowland Heights"),("diamond-bar","Diamond Bar"),
 ("thousand-oaks","Thousand Oaks"),("west-covina","West Covina"),("whittier","Whittier, California"),
 ("san-diego","San Diego"),("irvine","Irvine, California"),("anaheim","Anaheim"),
 ("long-beach","Long Beach, California"),("pasadena","Pasadena, California"),
 ("santa-monica","Santa Monica"),("huntington-beach","Huntington Beach"),
 ("riverside","Riverside, California"),("temecula","Temecula"),("santa-clarita","Santa Clarita"),
 ("torrance","Torrance"),("newport-beach","Newport Beach"),("glendale","Glendale, California"),
 ("corona","Corona, California"),("oceanside","Oceanside, California"),("palm-springs","Palm Springs"),
]

def get(url, tries=3):
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90))
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(3 * (i + 1))

def geocode(q):
    r = get("https://nominatim.openstreetmap.org/search?q=%s&format=json&limit=1"
            % urllib.parse.quote(q + ", California, USA" if "California" not in q and "USA" not in q else q))
    if not r: raise RuntimeError("no geocode for " + q)
    return float(r[0]['lat']), float(r[0]['lon'])

def drive_miles(a, b):
    r = get("https://router.project-osrm.org/route/v1/driving/%f,%f;%f,%f?overview=false"
            % (a[1], a[0], b[1], b[0]))
    return r['routes'][0]['distance'] / 1609.344

def climate(lat, lon):
    r = get("https://archive-api.open-meteo.com/v1/archive?latitude=%f&longitude=%f"
            "&start_date=2019-01-01&end_date=2024-12-31"
            "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunset"
            "&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%%2FLos_Angeles" % (lat, lon))
    d = r['daily']
    months = {m: {'hi': [], 'lo': [], 'wet': 0, 'days': 0, 'sunsets': []} for m in range(1, 13)}
    for i, day in enumerate(d['time']):
        m = int(day[5:7])
        b = months[m]
        if d['temperature_2m_max'][i] is not None: b['hi'].append(d['temperature_2m_max'][i])
        if d['temperature_2m_min'][i] is not None: b['lo'].append(d['temperature_2m_min'][i])
        p = d['precipitation_sum'][i]
        if p is not None:
            b['days'] += 1
            if p >= 0.04: b['wet'] += 1          # ~1mm, a day you would notice
        s = d['sunset'][i]
        if s: b['sunsets'].append(s[11:16])
    out = {}
    for m, b in months.items():
        mid = sorted(b['sunsets'])[len(b['sunsets'])//2] if b['sunsets'] else None
        out[m] = {
          'high': round(statistics.mean(b['hi'])) if b['hi'] else None,
          'low':  round(statistics.mean(b['lo'])) if b['lo'] else None,
          'rain_pct': round(100.0 * b['wet'] / b['days']) if b['days'] else None,
          'sunset': mid,
        }
    return out

def main():
    data = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    if 'base' not in data:
        data['base'] = geocode(BASE_QUERY); time.sleep(1.1)
        json.dump(data, open(CACHE,'w'))
    base = tuple(data['base'])
    for slug, q in CITIES:
        if slug in data and data[slug].get('climate'):
            print('cached  ', slug); continue
        try:
            lat, lon = geocode(q); time.sleep(1.1)
            mi = drive_miles(base, (lat, lon)); time.sleep(0.4)
            cl = climate(lat, lon); time.sleep(0.4)
            data[slug] = {'query': q, 'lat': lat, 'lon': lon, 'miles': round(mi, 1), 'climate': cl}
            print('%-22s %5.1f mi  Jul hi %s F  Jul sunset %s' % (slug, mi, cl[7]['high'], cl[7]['sunset']))
        except Exception as e:
            print('FAIL', slug, e)
        json.dump(data, open(CACHE,'w'))
    print('collected', len([k for k in data if k != 'base']), 'cities')

main()
