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
    : resolve("harness/verification/2026-02-20-cro-008")
  mkdirSync(evidenceDir, { recursive: true })

  const events = [
    { event: "page_view", timestamp: daysAgo(1) },
    { event: "page_view", timestamp: daysAgo(2) },
    { event: "lead_start", timestamp: daysAgo(1) },
    { event: "quote_started", timestamp: daysAgo(1) },
    { event: "quote_completed", timestamp: daysAgo(1) },
    { event: "lead_submit", timestamp: daysAgo(1) },
    { event: "deposit_completed", timestamp: daysAgo(1), transaction_id: "txn_001" },
    { event: "ab_test_exposure", experiment_id: "hero_headline", variant_id: "control", timestamp: daysAgo(1) },
    { event: "ab_test_exposure", experiment_id: "hero_headline", variant_id: "chef_story", timestamp: daysAgo(1) },
    { event: "ab_test_exposure", experiment_id: "primary_cta_copy", variant_id: "control", timestamp: daysAgo(1) },
    { event: "ab_test_exposure", experiment_id: "primary_cta_copy", variant_id: "value_focused", timestamp: daysAgo(1) },
    { event: "ab_test_conversion", experiment_id: "hero_headline", variant_id: "chef_story", timestamp: daysAgo(1) },
    { event: "ab_test_conversion", experiment_id: "primary_cta_copy", variant_id: "value_focused", timestamp: daysAgo(1) },
  ]

  const report = buildFunnelReport(events, 7)

  assert.ok(report.funnel.visit >= 2, "Expected at least 2 visits in funnel report.")
  assert.ok(report.funnel.click >= 1, "Expected click step count in funnel report.")
  assert.ok(report.funnel.submit >= 1, "Expected submit step count in funnel report.")
  assert.ok(report.ab_tests.length >= 1, "Expected at least one A/B test report.")
  assert.ok(
    report.ab_tests.some((test) => test.winning_variant && test.winning_rate >= 0),
    "Expected at least one A/B winner entry.",
  )

  const outputPath = resolve(evidenceDir, "cro-008-funnel-report.json")
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8")
  console.log(`Wrote evidence: ${outputPath}`)
}

main()
