#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"

const outDirArg = process.argv[2]
if (!outDirArg) {
  console.error("Usage: node harness/scripts/verify-contact-email-message-cleanup.mjs <output-dir>")
  process.exit(1)
}

const rootDir = process.cwd()
const outDir = path.resolve(rootDir, outDirArg)
fs.mkdirSync(outDir, { recursive: true })

function read(relativePath) {
  return fs.readFileSync(path.resolve(rootDir, relativePath), "utf8")
}

const contactClient = read("app/contact/ContactPageClient.tsx")
const contactRoute = read("app/api/contact/route.ts")

const checks = [
  {
    id: "frontend-sends-only-visible-fields",
    pass:
      contactClient.includes("message: formData.message") &&
      !contactClient.includes("eventDate: formData.eventDate || undefined") &&
      !contactClient.includes("cityOrZip: formData.cityOrZip || undefined") &&
      !contactClient.includes("guestCount: formData.guestCount || undefined") &&
      !contactClient.includes("`Event Date: ${formData.eventDate || \"Not provided\"}`"),
    detail: "Contact page sends only the visible user-entered fields and keeps the message plain.",
  },
  {
    id: "route-cleans-legacy-prefixed-lines",
    pass:
      contactRoute.includes("function extractContactDetailsFromMessage") &&
      contactRoute.includes('trimmed.startsWith("Event Date:")') &&
      contactRoute.includes('trimmed.startsWith("Guest Count:")') &&
      contactRoute.includes('trimmed.startsWith("City/ZIP:")'),
    detail: "Contact API strips legacy prefixed metadata lines out of the email message body.",
  },
  {
    id: "route-renders-structured-details-separately",
    pass:
      contactRoute.includes('<p><strong>Event Date:</strong> ${eventDate}</p>') &&
      contactRoute.includes('<p><strong>Guest Count:</strong> ${guestCount}</p>') &&
      contactRoute.includes('<p><strong>City/ZIP:</strong> ${cityOrZip}</p>'),
    detail: "Contact API renders event details in dedicated optional rows instead of prepending them to the message.",
  },
]

const summary = {
  generatedAt: new Date().toISOString(),
  pass: checks.every((check) => check.pass),
  checks,
}

fs.writeFileSync(path.join(outDir, "contact-email-message-cleanup-summary.json"), `${JSON.stringify(summary, null, 2)}\n`)

if (!summary.pass) {
  console.error(JSON.stringify(summary, null, 2))
  process.exit(1)
}

console.log(`Wrote evidence: ${path.join(outDir, "contact-email-message-cleanup-summary.json")}`)
