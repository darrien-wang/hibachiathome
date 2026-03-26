import { expect, test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const EVIDENCE_DIR = resolve("cpl-verification/2026-03-06-cpl-008")

function writeEvidence(filename: string, payload: unknown) {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(resolve(EVIDENCE_DIR, filename), `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

test("CPL-008: quote_started emits only after first real input and only once", async ({ page }) => {
  await page.goto("/quoteA")

  const quoteStartedOnLoad = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "quote_started")
  })

  expect(quoteStartedOnLoad.length).toBe(0)

  await page.getByPlaceholder("Los Angeles or 90001").fill("Los Angeles")

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
        return dataLayer.filter((entry) => entry.event === "quote_started")
      })
    })
    .toHaveLength(1)

  await page.locator('input[type="date"]').fill(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  await page.locator('input[type="number"]').first().fill("12")

  const quoteStartedAfterAdditionalInputs = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "quote_started")
  })

  const summary = {
    item: "CPL-008",
    date: "2026-03-06",
    initialQuoteStartedCount: quoteStartedOnLoad.length,
    finalQuoteStartedCount: quoteStartedAfterAdditionalInputs.length,
    firstEvent: quoteStartedAfterAdditionalInputs[0] ?? null,
    pass:
      quoteStartedOnLoad.length === 0 &&
      quoteStartedAfterAdditionalInputs.length === 1 &&
      quoteStartedAfterAdditionalInputs[0]?.quote_surface === "quote_builder_a",
  }

  writeEvidence("cpl-008-quote-started-gating.json", summary)
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "cpl-008-quote-started-gating.png"),
    fullPage: true,
  })

  expect(summary.pass).toBeTruthy()
})
