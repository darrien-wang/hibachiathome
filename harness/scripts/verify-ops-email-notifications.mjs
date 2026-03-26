#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"

const outDirArg = process.argv[2]
if (!outDirArg) {
  console.error("Usage: node harness/scripts/verify-ops-email-notifications.mjs <output-dir>")
  process.exit(1)
}

const rootDir = process.cwd()
const outDir = path.resolve(rootDir, outDirArg)
fs.mkdirSync(outDir, { recursive: true })

function read(relativePath) {
  return fs.readFileSync(path.resolve(rootDir, relativePath), "utf8")
}

function fileExists(relativePath) {
  return fs.existsSync(path.resolve(rootDir, relativePath))
}

const opsNotifications = read("lib/ops-notifications.ts")
const contactRoute = read("app/api/contact/route.ts")
const depositStartRoute = read("app/api/deposit/start/route.ts")
const stripeWebhookRoute = read("app/api/stripe/webhook/route.ts")

const checks = [
  {
    id: "ops-helper",
    pass:
      opsNotifications.includes("export async function sendSupportNotificationEmail") &&
      opsNotifications.includes("development_mode_logged"),
    detail: "Unified ops email helper exists with development logging mode.",
  },
  {
    id: "contact-route",
    pass:
      contactRoute.includes('sendSupportNotificationEmail({') &&
      !contactRoute.includes('return NextResponse.json({ error: "Lead persistence is unavailable" }, { status: 500 })') &&
      contactRoute.includes("leadPersistence"),
    detail: "Contact route triggers support email without hard-blocking on Supabase persistence.",
  },
  {
    id: "deposit-start-post",
    pass:
      depositStartRoute.includes("const opsNotification = await sendOpsLeadNotification({") &&
      depositStartRoute.includes("opsNotification,"),
    detail: "Deposit start POST returns ops notification status.",
  },
  {
    id: "deposit-start-get",
    pass:
      depositStartRoute.includes("GET flow continued without confirmed ops email delivery") &&
      depositStartRoute.includes("await sendOpsLeadNotification({"),
    detail: "Deposit start GET path still attempts support notification.",
  },
  {
    id: "webhook-paid",
    pass:
      stripeWebhookRoute.includes("async function sendOpsDepositPaidNotification") &&
      stripeWebhookRoute.includes("const opsNotification = await sendOpsDepositPaidNotification({") &&
      stripeWebhookRoute.includes("opsNotification,"),
    detail: "Deposit-paid webhook sends and returns ops notification status.",
  },
  {
    id: "legacy-notify-route-removed",
    pass: !fileExists("app/api/notify-lead/route.ts"),
    detail: "Legacy /api/notify-lead route remains removed.",
  },
]

const summary = {
  generatedAt: new Date().toISOString(),
  pass: checks.every((check) => check.pass),
  checks,
}

fs.writeFileSync(path.join(outDir, "ops-email-notifications-summary.json"), `${JSON.stringify(summary, null, 2)}\n`)

if (!summary.pass) {
  console.error(JSON.stringify(summary, null, 2))
  process.exit(1)
}

console.log(`Wrote evidence: ${path.join(outDir, "ops-email-notifications-summary.json")}`)
