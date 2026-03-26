import { expect, test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const EVIDENCE_DIR = resolve("cpl-verification/2026-03-06-cpl-006")

function writeEvidence(filename: string, payload: unknown) {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(resolve(EVIDENCE_DIR, filename), `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

test("CPL-006: quote SMS/Call/Email clicks emit lead_submit with qualified channel payload", async ({ page }) => {
  await page.goto("/quoteA")

  await page.evaluate(() => {
    ;(window as Window & { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__ = true
  })

  const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  await page.getByPlaceholder("Your full name").fill("CPL QA")
  await page.locator('input[type="date"]').fill(futureDate)
  await page.locator("select").selectOption("16:00")
  await page.getByPlaceholder("Los Angeles or 90001").fill("Los Angeles")

  await page.waitForTimeout(300)

  type ChannelCheck = {
    channel: "sms" | "phone" | "email"
    buttonLabel: string
    contactEventName: "contact_sms_click" | "contact_call_click" | "contact_email_click"
  }

  const checks: ChannelCheck[] = [
    { channel: "sms", buttonLabel: "SMS", contactEventName: "contact_sms_click" },
    { channel: "phone", buttonLabel: "Call", contactEventName: "contact_call_click" },
    { channel: "email", buttonLabel: "Email", contactEventName: "contact_email_click" },
  ]

  const results: Array<{
    channel: string
    pass: boolean
    leadSubmitCount: number
    contactEventCount: number
    matchedLeadPayload: Record<string, unknown> | null
    events: Array<Record<string, unknown>>
  }> = []

  for (const check of checks) {
    await page.evaluate(() => {
      ;(window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer = []
    })

    await page.getByRole("button", { name: new RegExp(`^${check.buttonLabel}`, "i") }).click()

    const events = await page.evaluate(() => {
      const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
      return dataLayer
    })

    const leadSubmitEvents = events.filter((entry) => entry.event === "lead_submit")
    const contactEvents = events.filter((entry) => entry.event === check.contactEventName)
    const matchedLeadPayload =
      leadSubmitEvents.find(
        (entry) =>
          entry.lead_channel === check.channel &&
          entry.lead_type === "quote_contact" &&
          entry.lead_source === "quote_builder_a",
      ) ?? null

    results.push({
      channel: check.channel,
      pass: Boolean(matchedLeadPayload) && contactEvents.length > 0,
      leadSubmitCount: leadSubmitEvents.length,
      contactEventCount: contactEvents.length,
      matchedLeadPayload,
      events,
    })
  }

  const summary = {
    item: "CPL-006",
    date: "2026-03-06",
    pass: results.every((result) => result.pass),
    results,
  }

  writeEvidence("cpl-006-quote-contact-actions.json", summary)
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "cpl-006-quote-contact-actions.png"),
    fullPage: true,
  })

  expect(summary.pass).toBeTruthy()
})
