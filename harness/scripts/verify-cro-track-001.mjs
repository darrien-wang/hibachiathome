#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import assert from "node:assert/strict"
import { buildFunnelReport } from "./generate-funnel-report.mjs"

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function main() {
  const evidenceDir = process.argv[2]
    ? resolve(process.argv[2])
    : resolve("harness/verification/2026-02-20-cro-track-001")
  mkdirSync(evidenceDir, { recursive: true })

  const events = [
    { event: "page_view", timestamp: daysAgo(1), utm_source: "google" },
    { event: "quote_started", timestamp: daysAgo(1), city_or_zip: "Irvine", tableware_rental: true },
    {
      event: "quote_completed",
      timestamp: daysAgo(1),
      city_or_zip: "Irvine",
      tableware_rental: true,
      add_on_steak: true,
      add_on_shrimp: false,
      add_on_lobster: true,
      utm_source: "google",
    },
    {
      event: "contact_sms_click",
      timestamp: daysAgo(1),
      city_or_zip: "Irvine",
      tableware_rental: true,
      add_on_steak: true,
      add_on_shrimp: false,
      add_on_lobster: true,
      utm_source: "google",
    },
    {
      event: "contact_call_click",
      timestamp: daysAgo(1),
      city_or_zip: "Pasadena",
      tableware_rental: false,
      add_on_steak: false,
      add_on_shrimp: true,
      add_on_lobster: false,
      utm_source: "instagram",
    },
    {
      event: "contact_email_click",
      timestamp: daysAgo(1),
      city_or_zip: "Pasadena",
      tableware_rental: false,
      add_on_steak: false,
      add_on_shrimp: false,
      add_on_lobster: false,
      gclid: "abc123",
    },
  ]

  const report = buildFunnelReport(events, 7)

  assert.ok(report.quote_funnel.quote_started >= 1, "Expected quote_started count in quote funnel.")
  assert.ok(report.quote_funnel.quote_completed >= 1, "Expected quote_completed count in quote funnel.")
  assert.ok(report.quote_funnel.sms_click >= 1, "Expected SMS click count in quote funnel.")
  assert.ok(report.quote_funnel.call_click >= 1, "Expected Call click count in quote funnel.")
  assert.ok(report.quote_funnel.email_click >= 1, "Expected Email click count in quote funnel.")

  assert.ok(report.quote_segments.by_city_or_zip.Irvine >= 1, "Expected city segmentation for Irvine.")
  assert.ok(report.quote_segments.by_tableware_rental.yes >= 1, "Expected rental segmentation for yes.")
  assert.ok(report.quote_segments.by_add_on.steak >= 1, "Expected add-on segmentation for steak.")
  assert.ok(report.top_traffic_sources.length >= 1, "Expected top traffic source entries.")

  const outputPath = resolve(evidenceDir, "cro-track-001-funnel-segmentation-report.json")
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8")
  console.log(`Wrote evidence: ${outputPath}`)
}

main()
