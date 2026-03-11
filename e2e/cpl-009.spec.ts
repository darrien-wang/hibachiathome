import { expect, test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const EVIDENCE_DIR = resolve("cpl-verification/2026-03-11-cpl-009")

function writeEvidence(filename: string, payload: unknown) {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(resolve(EVIDENCE_DIR, filename), `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

test("CPL-009: quote deep link forwards CRM context into livechat widget setContext payload", async ({ page }) => {
  await page.route("**/widget.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "",
    })
  })

  await page.addInitScript(() => {
    ;(window as Window & { __rhSetContexts?: Array<Record<string, string>> }).__rhSetContexts = []
    ;(window as Window & { RealHibachiLiveChat?: { setContext?: (context: Record<string, string>) => void } }).RealHibachiLiveChat = {
      setContext(context) {
        const store = (window as Window & { __rhSetContexts?: Array<Record<string, string>> }).__rhSetContexts
        store?.push(context)
      },
    }
  })

  await page.goto(
    "/quoteA?crm_conversation_id=conv_001&crm_channel=sms&crm_contact_id=ct_001&booking_id=RH-20260311-1234",
    { waitUntil: "domcontentloaded" },
  )

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const setContexts = (window as Window & { __rhSetContexts?: Array<Record<string, string>> }).__rhSetContexts ?? []
        return setContexts.length
      })
    })
    .toBe(1)

  const setContextCallCount = await page.evaluate(() => {
    const all = (window as Window & { __rhSetContexts?: Array<Record<string, string>> }).__rhSetContexts ?? []
    return all.length
  })

  const captured = await page.evaluate(() => {
    const all = (window as Window & { __rhSetContexts?: Array<Record<string, string>> }).__rhSetContexts ?? []
    return all[all.length - 1] ?? null
  })

  const pass =
    Boolean(captured) &&
    captured?.path === "/quoteA" &&
    captured?.intent === "quote" &&
    captured?.page_group === "quote" &&
    captured?.source === "realhibachi-marketing" &&
    captured?.crm_conversation_id === "conv_001" &&
    captured?.crm_channel === "sms" &&
    captured?.crm_contact_id === "ct_001" &&
    captured?.order_hint === "RH-20260311-1234"

  const summary = {
    item: "CPL-009",
    date: "2026-03-11",
    pass,
    setContextCallCount,
    captured,
  }

  writeEvidence("cpl-009-livechat-crm-context.json", summary)
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "cpl-009-livechat-crm-context.png"),
    fullPage: true,
  })

  expect(pass).toBeTruthy()
})
