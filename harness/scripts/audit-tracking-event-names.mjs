#!/usr/bin/env node

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

const SNAKE_CASE_PATTERN = /^[a-z]+[a-z0-9]*(?:_[a-z0-9]+)*$/

function walkFiles(dir, extensions, output = []) {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      walkFiles(fullPath, extensions, output)
      continue
    }
    if (extensions.includes(path.extname(fullPath))) {
      output.push(fullPath)
    }
  }
  return output
}

function parseArgs(argv) {
  let outputPath = null
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--output") {
      outputPath = argv[i + 1] ?? null
      i += 1
    }
  }
  return { outputPath }
}

function lineNumberFromIndex(text, index) {
  return text.slice(0, index).split("\n").length
}

const { outputPath } = parseArgs(process.argv.slice(2))
const repoRoot = process.cwd()

const trackingFilePath = path.join(repoRoot, "lib", "tracking.ts")
const trackingSource = readFileSync(trackingFilePath, "utf8")

const declaredEvents = Array.from(trackingSource.matchAll(/\|\s+"([a-z0-9_]+)"/g))
  .map((match) => match[1])
  .sort()

const callsiteFiles = [
  ...walkFiles(path.join(repoRoot, "app"), [".ts", ".tsx"]),
  ...walkFiles(path.join(repoRoot, "components"), [".ts", ".tsx"]),
]

const emittedEventDetails = []
for (const filePath of callsiteFiles) {
  const source = readFileSync(filePath, "utf8")
  const matches = Array.from(source.matchAll(/trackEvent\("([a-z0-9_]+)"/g))
  for (const match of matches) {
    emittedEventDetails.push({
      event: match[1],
      file: path.relative(repoRoot, filePath),
      line: lineNumberFromIndex(source, match.index ?? 0),
    })
  }
}

const emittedEvents = Array.from(new Set(emittedEventDetails.map((item) => item.event))).sort()

const declaredEventSet = new Set(declaredEvents)
const emittedEventSet = new Set(emittedEvents)

const undeclaredEmittedEvents = emittedEvents.filter((event) => !declaredEventSet.has(event))
const declaredButNotEmittedEvents = declaredEvents.filter((event) => !emittedEventSet.has(event))

const nonSnakeCaseDeclaredEvents = declaredEvents.filter((event) => !SNAKE_CASE_PATTERN.test(event))
const nonSnakeCaseEmittedEvents = emittedEvents.filter((event) => !SNAKE_CASE_PATTERN.test(event))

const report = {
  generated_at: new Date().toISOString(),
  tracking_file: path.relative(repoRoot, trackingFilePath),
  naming_rule: "snake_case",
  declared_events: declaredEvents,
  emitted_events: emittedEvents,
  undeclared_emitted_events: undeclaredEmittedEvents,
  declared_but_not_emitted_events: declaredButNotEmittedEvents,
  non_snake_case_declared_events: nonSnakeCaseDeclaredEvents,
  non_snake_case_emitted_events: nonSnakeCaseEmittedEvents,
  emitted_event_callsites: emittedEventDetails,
}

if (outputPath) {
  const absoluteOutputPath = path.isAbsolute(outputPath) ? outputPath : path.join(repoRoot, outputPath)
  mkdirSync(path.dirname(absoluteOutputPath), { recursive: true })
  writeFileSync(absoluteOutputPath, JSON.stringify(report, null, 2), "utf8")
}

console.log(`[audit] Declared events: ${declaredEvents.length}`)
console.log(`[audit] Emitted events: ${emittedEvents.length}`)
console.log(`[audit] Non-snake declared events: ${nonSnakeCaseDeclaredEvents.length}`)
console.log(`[audit] Non-snake emitted events: ${nonSnakeCaseEmittedEvents.length}`)
console.log(`[audit] Undeclared emitted events: ${undeclaredEmittedEvents.length}`)

if (undeclaredEmittedEvents.length > 0 || nonSnakeCaseDeclaredEvents.length > 0 || nonSnakeCaseEmittedEvents.length > 0) {
  process.exit(1)
}
