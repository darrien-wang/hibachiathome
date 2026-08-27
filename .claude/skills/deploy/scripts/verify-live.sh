#!/usr/bin/env bash
# Post-deploy production verification for www.realhibachi.com.
# Checks homepage SSR health, city pages, redirects, and SEO endpoints.
# Safe to re-run; makes only GET requests.
set -uo pipefail

BASE="https://www.realhibachi.com"

echo "=== 1. Homepage SSR ==="
h=$(curl -s "$BASE/")
printf 'size: %s | h1: %s | jsonld: %s | canonical: %s\n' \
  "${#h}" \
  "$(printf '%s' "$h" | grep -o '<h1' | wc -l | tr -d ' ')" \
  "$(printf '%s' "$h" | grep -o 'application/ld+json' | wc -l | tr -d ' ')" \
  "$(printf '%s' "$h" | grep -o 'rel="canonical" href="[^"]*' | head -1 | sed 's/.*href="//')"

echo "=== 2. City pages (expect 200) ==="
for c in san-diego irvine anaheim long-beach palm-springs; do
  printf '%s: %s  ' "$c" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/hibachi-at-home/$c")"
done
echo

echo "=== 3. Redirects (expect 308) ==="
curl -s -o /dev/null -w "nyc-long-island: %{http_code} -> %{redirect_url}\n" "$BASE/locations/nyc-long-island"
curl -s -o /dev/null -w "non-www:         %{http_code} -> %{redirect_url}\n" "https://realhibachi.com/menu"

echo "=== 4. SEO endpoints ==="
printf 'llms.txt: %s | sitemap <loc> count: %s\n' \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/llms.txt")" \
  "$(curl -s "$BASE/sitemap.xml" | grep -c '<loc>')"
