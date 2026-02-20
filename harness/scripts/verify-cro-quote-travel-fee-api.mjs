#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import assert from "node:assert/strict"

function main() {
  const evidenceDir = process.argv[2]
    ? resolve(process.argv[2])
    : resolve("harness/verification/2026-02-20-cro-quote-travel-fee-api")
  mkdirSync(evidenceDir, { recursive: true })

  const apiPath = resolve("app/api/quote/travel-fee/route.ts")
  const quotePath = resolve("app/quote/QuoteBuilderClient.tsx")
  const apiSource = readFileSync(apiPath, "utf-8")
  const quoteSource = readFileSync(quotePath, "utf-8")

  assert.ok(apiSource.includes('const ORIGIN_ZIP = "91748"'), "Expected 91748 origin zip in travel fee API.")
  assert.ok(
    apiSource.includes("maps.googleapis.com/maps/api/distancematrix"),
    "Expected Google Distance Matrix API call in travel fee route.",
  )
  assert.ok(
    quoteSource.includes("/api/quote/travel-fee?destination="),
    "Expected quote page to call travel fee API.",
  )
  assert.ok(
    quoteSource.includes("Distance from 91748:"),
    "Expected quote page to show distance from 91748.",
  )

  const evidence = {
    task: "quote_travel_fee_api_integration",
    checked_at: new Date().toISOString(),
    checks: {
      api_origin_zip_91748: true,
      api_distance_matrix_call_present: true,
      quote_page_api_fetch_present: true,
      quote_page_distance_display_present: true,
    },
    files: {
      api_route: "app/api/quote/travel-fee/route.ts",
      quote_client: "app/quote/QuoteBuilderClient.tsx",
    },
  }

  const outputPath = resolve(evidenceDir, "cro-quote-travel-fee-api-check.json")
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf-8")
  console.log(`Wrote evidence: ${outputPath}`)
}

main()
