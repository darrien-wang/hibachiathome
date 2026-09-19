# -*- coding: utf-8 -*-
"""Regenerate config/city-travel.ts from the home base in config/home-base.ts.

Every city on /hibachi-at-home/<slug> gets its driving miles from the SAME
service the quote page and the invoice tool use (/api/quote/travel-fee), so
the "about $X" on a city page is the number the customer is billed. Run from
the repo root after changing HOME_BASE_ZIP or adding a city page:

    python research/scripts/generate-city-travel.py

Uses curl (the site sits behind Cloudflare, which rejects Python's urllib).
Cities the service cannot geocode keep their previous value and are listed.
"""
import json, re, subprocess, sys, time, datetime

ROOT = "."
base_ts = open(f"{ROOT}/config/home-base.ts", encoding="utf-8").read()
BASE_ZIP = re.search(r'HOME_BASE_ZIP = "(\d{5})"', base_ts).group(1)

pages = open(f"{ROOT}/config/city-pages.ts", encoding="utf-8").read()
cities = re.findall(r'^\s{4}slug: "([a-z0-9-]+)",\r?\n\s{4}city: "([^"]+)",', pages, re.M)

old_path = f"{ROOT}/config/city-travel.ts"
old = {}
try:
    for m in re.finditer(r'"([a-z0-9-]+)": \{ miles: ([\d.]+), fee: (\d+) \}', open(old_path, encoding="utf-8").read()):
        old[m.group(1)] = (float(m.group(2)), int(m.group(3)))
except FileNotFoundError:
    pass

def lookup(query):
    url = "https://www.realhibachi.com/api/quote/travel-fee?destination=%s&origin=%s" % (
        subprocess.run([sys.executable, "-c", "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))", query], capture_output=True, text=True).stdout.strip(), BASE_ZIP)
    out = subprocess.run(["curl", "-s", "--max-time", "60", url], capture_output=True).stdout.decode("utf-8", "replace")
    try:
        d = json.loads(out)
    except Exception:
        return None
    return d if isinstance(d.get("distance_miles"), (int, float)) else None

rows, failed = [], []
for slug, city in cities:
    d = lookup(f"{city}, CA")
    if d is None:
        if slug in old:
            rows.append((slug, city, old[slug][0], old[slug][1], "kept"))
        failed.append(slug)
        continue
    miles = round(float(d["distance_miles"]), 1)
    fee = 0 if miles <= 50 else round(miles - 50)
    rows.append((slug, city, miles, fee, d.get("source", "?")))
    print("%-24s %6.1f mi  fee $%-3d  %s" % (slug, miles, fee, d.get("source", "")))
    time.sleep(1.2)

today = datetime.date.today().isoformat()
out = [
    f"// GENERATED {today} by research/scripts/generate-city-travel.py — driving miles",
    f"// from the home base in config/home-base.ts (ZIP {BASE_ZIP}), measured by the",
    "// same /api/quote/travel-fee service the quote page and the invoice tool use,",
    "// and the travel fee under the published policy: first 50 miles free, then",
    "// $1 per mile. Re-run the script if the base moves or a city page is added.",
    "// The site never states where the base is.",
    "",
    "export type CityTravel = { miles: number; fee: number }",
    "",
    "export const cityTravel: Record<string, CityTravel> = {",
]
for slug, city, miles, fee, src in rows:
    out.append(f'  "{slug}": {{ miles: {miles:.1f}, fee: {fee} }}, // {city}' + (" (kept: lookup failed)" if src == "kept" else ""))
out += ["}", "", "export function getCityTravel(slug: string): CityTravel | undefined {", "  return cityTravel[slug]", "}", ""]
open(old_path, "w", encoding="utf-8", newline="\n").write("\n".join(out))
print(f"wrote {old_path}: {len(rows)} cities, base {BASE_ZIP}, failed: {failed or 'none'}")
