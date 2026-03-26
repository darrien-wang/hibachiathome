import { expect, test, type Page } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const EVIDENCE_DIR = resolve("cpl-verification/2026-03-06-cpl-007")

function writeEvidence(filename: string, payload: unknown) {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(resolve(EVIDENCE_DIR, filename), `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

async function mockContactApi(page: Page) {
  await page.route("**/api/contact", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  })
}

async function submitContactForm(page: Page) {
  await page.locator('input[name="firstName"]').fill("CPL")
  await page.locator('input[name="lastName"]').fill("Contact")
  await page.locator('input[name="email"]').fill("cpl@example.com")
  await page.locator('input[name="phone"]').fill("2137707788")
  await page.locator('textarea[name="message"]').fill("Need help booking a hibachi event.")
  await page.getByRole("button", { name: /send request/i }).click()
  await expect(page.getByText(/thanks\. your request is in/i)).toBeVisible()
}

test("CPL-007-01: default contact intent emits lead_submit booking_inquiry", async ({ page }) => {
  await mockContactApi(page)
  await page.goto("/contact")

  await expect(page.getByRole("heading", { name: /book or ask about your event/i })).toBeVisible()

  await submitContactForm(page)

  const summary = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    const leadSubmitEvents = dataLayer.filter((entry) => entry.event === "lead_submit")
    const supportSubmitEvents = dataLayer.filter((entry) => entry.event === "support_submit")
    const matchedLead = leadSubmitEvents.find(
      (entry) =>
        entry.lead_type === "booking_inquiry" &&
        entry.lead_source === "contact_page" &&
        entry.lead_channel === "contact_form",
    )

    return {
      leadSubmitEvents,
      supportSubmitEvents,
      matchedLead: matchedLead ?? null,
      pass: Boolean(matchedLead) && supportSubmitEvents.length === 0,
    }
  })

  writeEvidence("cpl-007-default-booking-intent.json", summary)
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "cpl-007-default-booking-intent.png"),
    fullPage: true,
  })

  expect(summary.pass).toBeTruthy()
})

test("CPL-007-02: support reason query emits support_submit customer_support", async ({ page }) => {
  await mockContactApi(page)
  await page.goto("/contact?reason=post_event_support")

  await submitContactForm(page)

  const summary = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    const leadSubmitEvents = dataLayer.filter((entry) => entry.event === "lead_submit")
    const supportSubmitEvents = dataLayer.filter((entry) => entry.event === "support_submit")
    const matchedSupport = supportSubmitEvents.find(
      (entry) =>
        entry.lead_type === "customer_support" &&
        entry.lead_source === "contact_page" &&
        entry.lead_channel === "contact_form",
    )

    return {
      leadSubmitEvents,
      supportSubmitEvents,
      matchedSupport: matchedSupport ?? null,
      pass: Boolean(matchedSupport) && leadSubmitEvents.length === 0,
    }
  })

  writeEvidence("cpl-007-support-reason-intent.json", summary)

  expect(summary.pass).toBeTruthy()
})
