import { expect, test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const EVIDENCE_DIR = resolve("cpl-verification/2026-03-11-cpl-010")

function writeEvidence(filename: string, payload: unknown) {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(resolve(EVIDENCE_DIR, filename), `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

test("CPL-010: launcher opens the embedded support panel and exposes expanded state", async ({ page }) => {
  await page.route("**/api/livechat/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, session: null, messages: [] }),
    })
  })

  await page.goto("/quoteA", { waitUntil: "domcontentloaded" })

  const launcher = page.locator("#rh-livechat-widget-root button[aria-expanded]").first()
  await expect(launcher).toBeVisible({ timeout: 20_000 })
  await expect(launcher).toContainText("Chat with support")
  await expect(launcher).toHaveAttribute("aria-expanded", "false")
  await expect(page.locator("#rh-livechat-panel")).toHaveCount(0)

  await launcher.click()
  await expect(launcher).toHaveAttribute("aria-expanded", "true")
  await expect(page.locator("#rh-livechat-panel")).toBeVisible()
  await expect(page.getByLabel("Visitor name")).toBeVisible()
  await expect(page.getByLabel("Support message")).toBeVisible()

  await page.getByRole("button", { name: "Close support chat" }).click()
  await expect(launcher).toHaveAttribute("aria-expanded", "false")
  await expect(page.locator("#rh-livechat-panel")).toHaveCount(0)

  const summary = {
    item: "CPL-010",
    date: "2026-03-11",
    ariaExpanded: await launcher.getAttribute("aria-expanded"),
    panelPresentAfterClose: await page.locator("#rh-livechat-panel").count(),
  }

  writeEvidence("cpl-010-livechat-launcher-ux.json", summary)
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "cpl-010-livechat-launcher-ux.png"),
    fullPage: true,
  })

  expect(summary.ariaExpanded).toBe("false")
  expect(summary.panelPresentAfterClose).toBe(0)
})
