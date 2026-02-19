import { mkdirSync, writeFileSync } from "node:fs"
import { test, expect } from "@playwright/test"

const EVIDENCE_DIR = process.env.TRACKING_EVIDENCE_DIR ?? "harness/verification/2026-02-19-trk-003"

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

test("TRK-003: navigation from home to /book emits a new page_view event", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  const initialPageViews = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "page_view")
  })

  await expect(initialPageViews).toHaveLength(1)
  await expect(initialPageViews[0]?.page_path).toBe("/")

  await page.locator("header").getByRole("link", { name: "Book Now" }).first().click()
  await page.waitForURL(/\/book(?:\?.*)?$/, { timeout: 20_000 })

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "page_view" && entry.page_path === "/book")
  })

  const pageViewEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "page_view")
  })

  await expect(pageViewEvents.length).toBeGreaterThan(initialPageViews.length)

  const bookPageView = pageViewEvents.find((entry) => entry.page_path === "/book")
  await expect(bookPageView).toBeTruthy()
  await expect(typeof bookPageView?.page_title).toBe("string")
  await expect((bookPageView?.page_title as string).length).toBeGreaterThan(0)

  writeFileSync(`${EVIDENCE_DIR}/trk-003-navigation-page-view-events.json`, JSON.stringify(pageViewEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-003-book.png`, fullPage: true })
})

test("TRK-004: hydration does not emit duplicate page_view on single home load", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.waitForTimeout(2_000)

  const pageViewEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "page_view")
  })

  await expect(pageViewEvents).toHaveLength(1)
  await expect(pageViewEvents[0]?.page_path).toBe("/")
  await expect(typeof pageViewEvents[0]?.page_title).toBe("string")
  await expect((pageViewEvents[0]?.page_title as string).length).toBeGreaterThan(0)

  writeFileSync(`${EVIDENCE_DIR}/trk-004-hydration-page-view-events.json`, JSON.stringify(pageViewEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-004-home.png`, fullPage: true })
})
