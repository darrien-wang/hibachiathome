// Verify the most recent leads carry attribution (utm_*, gclid).
// Usage: node scripts/check-lead-attribution.mjs [limit]
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
)

const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
const limit = process.argv[2] || "5"

const res = await fetch(
  `${url}/rest/v1/leads?select=id,created_at,full_name,phone,utm_source,utm_medium,utm_campaign,utm_term,utm_content,gclid,source_page&order=created_at.desc&limit=${limit}`,
  { headers: { apikey: key, authorization: `Bearer ${key}` } }
)
if (!res.ok) {
  console.error("QUERY FAILED", res.status, await res.text())
  process.exit(1)
}
const rows = await res.json()
for (const r of rows) {
  console.log(
    `${r.created_at} | ${r.name ?? "-"} | src=${r.utm_source ?? "-"} med=${r.utm_medium ?? "-"} camp=${r.utm_campaign ?? "-"} term=${r.utm_term ?? "-"} gclid=${(r.gclid ?? "-").slice(0, 30)}`
  )
}
console.log(`TOTAL: ${rows.length}`)
