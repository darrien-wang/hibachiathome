#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"

const CLICK_EVENTS = new Set([
  "lead_start",
  "booking_funnel_start",
  "quote_started",
  "contact_whatsapp_click",
  "contact_sms_click",
  "contact_call_click",
  "contact_email_click",
  "phone_click",
  "sms_click",
])

const SUBMIT_EVENTS = new Set(["lead_submit", "booking_submit", "quote_completed"])
const CLOSE_EVENTS = new Set(["deposit_completed"])

function parseArgs(argv) {
  const args = { input: "", output: "", windowDays: 7 }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--input") args.input = argv[i + 1] || ""
    if (arg === "--output") args.output = argv[i + 1] || ""
    if (arg === "--window-days") args.windowDays = Number(argv[i + 1] || "7")
  }
  return args
}

function normalizeEvents(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.events)) return payload.events
  return []
}

function toTimestamp(event) {
  const raw = event.timestamp || event.event_time || event.ts || event.created_at
  const timestamp = raw ? new Date(raw).getTime() : NaN
  return Number.isFinite(timestamp) ? timestamp : Date.now()
}

function pct(numerator, denominator) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 10000) / 100
}

function pickSource(event) {
  if (event.utm_source) return String(event.utm_source)
  if (event.gclid) return "google_ads_gclid"
  if (event.wbraid) return "google_ads_wbraid"
  if (event.gbraid) return "google_ads_gbraid"
  return "direct_or_unknown"
}

function boolKey(value) {
  return value ? "yes" : "no"
}

export function buildFunnelReport(events, windowDays = 7) {
  const windowStart = Date.now() - windowDays * 24 * 60 * 60 * 1000
  const recent = events.filter((event) => toTimestamp(event) >= windowStart)

  let visit = 0
  let click = 0
  let submit = 0
  let close = 0

  const ab = {}
  const sourceCounts = {}
  const segmentByCity = {}
  const segmentByRental = { yes: 0, no: 0, unknown: 0 }
  const segmentByAddOns = {
    steak: 0,
    shrimp: 0,
    lobster: 0,
    none: 0,
  }

  const quoteFunnel = {
    quote_started: 0,
    quote_completed: 0,
    sms_click: 0,
    call_click: 0,
    email_click: 0,
  }

  for (const event of recent) {
    const eventName = event.event
    if (eventName === "page_view") visit += 1
    if (CLICK_EVENTS.has(eventName)) click += 1
    if (SUBMIT_EVENTS.has(eventName)) submit += 1
    if (CLOSE_EVENTS.has(eventName)) close += 1

    if (eventName === "quote_started") quoteFunnel.quote_started += 1
    if (eventName === "quote_completed") quoteFunnel.quote_completed += 1
    if (eventName === "contact_sms_click") quoteFunnel.sms_click += 1
    if (eventName === "contact_call_click") quoteFunnel.call_click += 1
    if (eventName === "contact_email_click" || (eventName === "lead_submit" && event.lead_channel === "email")) {
      quoteFunnel.email_click += 1
    }

    if (
      eventName === "quote_completed" ||
      eventName === "contact_sms_click" ||
      eventName === "contact_call_click" ||
      eventName === "contact_email_click"
    ) {
      const source = pickSource(event)
      sourceCounts[source] = (sourceCounts[source] || 0) + 1

      const city = String(event.city_or_zip || "unspecified")
      segmentByCity[city] = (segmentByCity[city] || 0) + 1

      if (typeof event.tableware_rental === "boolean") {
        segmentByRental[boolKey(event.tableware_rental)] += 1
      } else {
        segmentByRental.unknown += 1
      }

      const hasSteak = Boolean(event.add_on_steak)
      const hasShrimp = Boolean(event.add_on_shrimp)
      const hasLobster = Boolean(event.add_on_lobster)
      if (hasSteak) segmentByAddOns.steak += 1
      if (hasShrimp) segmentByAddOns.shrimp += 1
      if (hasLobster) segmentByAddOns.lobster += 1
      if (!hasSteak && !hasShrimp && !hasLobster) segmentByAddOns.none += 1
    }

    if (eventName === "ab_test_exposure" || eventName === "ab_test_conversion") {
      const experiment = String(event.experiment_id || "unknown")
      const variant = String(event.variant_id || "unknown")
      if (!ab[experiment]) ab[experiment] = {}
      if (!ab[experiment][variant]) {
        ab[experiment][variant] = { exposures: 0, conversions: 0, conversion_rate: 0 }
      }
      if (eventName === "ab_test_exposure") ab[experiment][variant].exposures += 1
      if (eventName === "ab_test_conversion") ab[experiment][variant].conversions += 1
    }
  }

  for (const experiment of Object.keys(ab)) {
    for (const variant of Object.keys(ab[experiment])) {
      const row = ab[experiment][variant]
      row.conversion_rate = pct(row.conversions, row.exposures)
    }
  }

  const abWinners = Object.entries(ab).map(([experiment, variants]) => {
    const variantEntries = Object.entries(variants)
    const sorted = variantEntries.sort((a, b) => b[1].conversion_rate - a[1].conversion_rate)
    return {
      experiment,
      winning_variant: sorted[0]?.[0] || "unknown",
      winning_rate: sorted[0]?.[1]?.conversion_rate || 0,
      variants,
    }
  })

  const topSources = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    window_days: windowDays,
    generated_at: new Date().toISOString(),
    funnel: {
      visit,
      click,
      submit,
      close,
      visit_to_click_rate: pct(click, visit),
      click_to_submit_rate: pct(submit, click),
      submit_to_close_rate: pct(close, submit),
    },
    quote_funnel: quoteFunnel,
    quote_segments: {
      by_city_or_zip: segmentByCity,
      by_tableware_rental: segmentByRental,
      by_add_on: segmentByAddOns,
    },
    top_traffic_sources: topSources,
    ab_tests: abWinners,
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.input || !args.output) {
    console.error("Usage: node harness/scripts/generate-funnel-report.mjs --input <events.json> --output <report.json> [--window-days 7]")
    process.exit(1)
  }

  const inputPath = resolve(args.input)
  const outputPath = resolve(args.output)
  const payload = JSON.parse(readFileSync(inputPath, "utf-8"))
  const events = normalizeEvents(payload)

  const report = buildFunnelReport(events, args.windowDays)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8")
  console.log(`Wrote funnel report: ${outputPath}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
