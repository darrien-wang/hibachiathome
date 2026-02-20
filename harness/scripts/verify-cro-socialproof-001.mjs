#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import assert from "node:assert/strict"

function main() {
  const evidenceDir = process.argv[2]
    ? resolve(process.argv[2])
    : resolve("harness/verification/2026-02-20-cro-socialproof-001")
  mkdirSync(evidenceDir, { recursive: true })

  const toastPath = resolve("components/social-proof-toast.tsx")
  const layoutPath = resolve("app/layout.tsx")
  const toastSource = readFileSync(toastPath, "utf-8")
  const layoutSource = readFileSync(layoutPath, "utf-8")

  assert.ok(layoutSource.includes("<SocialProofToast />"), "Expected SocialProofToast mounted in global layout.")
  assert.ok(
    toastSource.includes("SESSION_DISMISS_KEY") && toastSource.includes("window.sessionStorage"),
    "Expected toast dismissal state to persist for session."
  )
  assert.ok(
    toastSource.includes("const minSeconds = 20") && toastSource.includes("const maxSeconds = 40"),
    "Expected toast rotation delay within 20-40 seconds."
  )
  assert.ok(
    toastSource.includes("bottom-24") && toastSource.includes("md:bottom-6"),
    "Expected mobile-safe and desktop-safe bottom offsets."
  )
  assert.ok(
    toastSource.includes("Recent Booking") && toastSource.includes("Booked"),
    "Expected social-proof content with recent booking messaging."
  )

  const evidence = {
    task: "CRO-SOCIALPROOF-001",
    checked_at: new Date().toISOString(),
    checks: {
      mounted_in_layout: true,
      session_dismiss_persistence: true,
      rotation_20_to_40_seconds: true,
      mobile_safe_placement: true,
      recent_booking_content: true,
    },
    files: {
      toast_component: "components/social-proof-toast.tsx",
      root_layout: "app/layout.tsx",
    },
  }

  const outputPath = resolve(evidenceDir, "cro-socialproof-001-toast-check.json")
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf-8")
  console.log(`Wrote evidence: ${outputPath}`)
}

main()
