import { expect, test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const EVIDENCE_DIR = resolve("cpl-verification/2026-03-11-cpl-010")

function writeEvidence(filename: string, payload: unknown) {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(resolve(EVIDENCE_DIR, filename), `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

test("CPL-010: launcher shows Live Chat + human avatar and supports drag without accidental toggle", async ({ page }) => {
  await page.goto("/quoteA", { waitUntil: "domcontentloaded" })

  const launcher = page.locator("#rh-livechat-widget-root button[aria-expanded]").first()
  await expect(launcher).toBeVisible({ timeout: 20_000 })
  await expect(launcher).toContainText("Live Chat")
  await expect(launcher.locator("img[alt='Live chat agent']")).toBeVisible()
  await expect(launcher).toHaveAttribute("aria-expanded", "false")

  const transformBefore = await page.evaluate(() => {
    const root = document.getElementById("rh-livechat-widget-root")
    return root ? getComputedStyle(root).transform : null
  })

  const box = await launcher.boundingBox()
  expect(box).not.toBeNull()
  if (!box) {
    throw new Error("Missing launcher bounding box")
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 140, box.y + box.height / 2 - 120, { steps: 12 })
  await page.mouse.up()

  const transformAfter = await page.evaluate(() => {
    const root = document.getElementById("rh-livechat-widget-root")
    return root ? getComputedStyle(root).transform : null
  })

  const summary = {
    item: "CPL-010",
    date: "2026-03-11",
    transformBefore,
    transformAfter,
    moved: transformBefore !== transformAfter,
    ariaExpanded: await launcher.getAttribute("aria-expanded"),
  }

  writeEvidence("cpl-010-livechat-launcher-ux.json", summary)
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "cpl-010-livechat-launcher-ux.png"),
    fullPage: true,
  })

  expect(summary.moved).toBeTruthy()
  expect(summary.ariaExpanded).toBe("false")
})
