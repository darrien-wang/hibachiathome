import { mkdirSync, writeFileSync } from "node:fs"
import { test, expect } from "@playwright/test"

const EVIDENCE_DIR = "harness/verification/2026-02-19-e2e-p0"

test("TRK-001: home load emits exactly one page_view via dataLayer", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  const pageViewEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "page_view")
  })

  await expect(pageViewEvents).toHaveLength(1)
  await expect(pageViewEvents[0]?.page_path).toBe("/")
  await expect(typeof pageViewEvents[0]?.page_title).toBe("string")
  await expect((pageViewEvents[0]?.page_title as string).length).toBeGreaterThan(0)

  writeFileSync(`${EVIDENCE_DIR}/trk-001-page-view-events.json`, JSON.stringify(pageViewEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-001-home.png`, fullPage: true })
})
