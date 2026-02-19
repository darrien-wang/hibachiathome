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

test("TRK-005: booking funnel start event fires on first booking interaction", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.goto("/book", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.getByRole("button", { name: "Get Estimate" }).click()
  await page.waitForURL(/\/estimation\?source=booking$/, { timeout: 20_000 })

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "booking_funnel_start")
  })

  const bookingFunnelEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "booking_funnel_start")
  })

  await expect(bookingFunnelEvents.length).toBeGreaterThan(0)
  await expect(bookingFunnelEvents[0]?.page_path).toBe("/book")
  await expect(typeof bookingFunnelEvents[0]?.page_title).toBe("string")
  await expect((bookingFunnelEvents[0]?.page_title as string).length).toBeGreaterThan(0)

  writeFileSync(
    `${EVIDENCE_DIR}/trk-005-booking-funnel-start-events.json`,
    JSON.stringify(bookingFunnelEvents, null, 2),
    "utf-8",
  )
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-005-booking-start.png`, fullPage: true })
})

test("TRK-006: booking submit event includes required payload without undefined values", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(120_000)

  await page.goto("/estimation", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.evaluate(() => {
    window.localStorage.removeItem("hibachi_estimation_form_data")
    window.localStorage.removeItem("hibachi_estimation_order_data")
  })
  await page.reload({ waitUntil: "domcontentloaded" })

  const infoModalClose = page.getByRole("button", { name: "Close" })
  if (await infoModalClose.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await infoModalClose.click()
  }

  await page.getByPlaceholder("Your full name").fill("TRK Test User")
  await page.getByPlaceholder("your.email@example.com").fill("trk006@example.com")
  await page.getByPlaceholder("(123) 456-7890").fill("2135550106")
  await page.getByPlaceholder("Example: 10001").fill("90001")

  if (await infoModalClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await infoModalClose.click()
  }

  await page.getByPlaceholder("Your full name").fill("TRK Test User")
  await page.getByRole("button", { name: "Increase adult count" }).click()
  await page.getByRole("button", { name: "Next Step" }).click()

  await page.getByRole("button", { name: "I don't need appetizers, skip" }).click()
  await page.getByRole("button", { name: "No upgrades needed, skip" }).click()
  await page.getByRole("button", { name: "No thanks, skip" }).click()
  await page.getByRole("button", { name: "Yes, I want to book this!" }).click()

  await page.getByLabel(/Estimated Guest Count/i).fill("10")
  await page.getByPlaceholder("Street Address").fill("123 Test St")
  await page.getByPlaceholder("City").fill("Los Angeles")
  await page.getByPlaceholder("State").fill("CA")
  await page.getByPlaceholder("ZIP").fill("90001")

  await page.waitForFunction(() => {
    const dayButtons = Array.from(document.querySelectorAll("button[type='button']"))
      .map((el) => el.textContent?.trim() ?? "")
      .filter((text) => /^\d+$/.test(text))
    return dayButtons.length > 0
  })
  await page.locator("button[type='button']").filter({ hasText: /^\d+$/ }).first().click()

  const timeSelect = page.locator("select").first()
  await expect(timeSelect).toBeVisible({ timeout: 20_000 })
  await page.waitForFunction(() => {
    const select = document.querySelector("select")
    return !!select && select.options.length > 1
  })
  await timeSelect.selectOption({ index: 1 })

  await page.getByRole("checkbox").first().click()
  await page.getByRole("button", { name: "Book My Hibachi Party" }).click()

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "booking_submit")
  })

  const bookingSubmitEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "booking_submit")
  })

  await expect(bookingSubmitEvents.length).toBeGreaterThan(0)
  const latestEvent = bookingSubmitEvents[bookingSubmitEvents.length - 1] as Record<string, unknown>
  const requiredKeys = ["event", "page_path", "page_title", "booking_id", "guest_count", "event_date", "event_time", "value", "currency"]

  for (const key of requiredKeys) {
    await expect(Object.prototype.hasOwnProperty.call(latestEvent, key)).toBeTruthy()
    await expect(latestEvent[key]).not.toBeUndefined()
  }

  const undefinedEntries = Object.entries(latestEvent).filter(([, value]) => value === undefined)
  await expect(undefinedEntries).toHaveLength(0)

  writeFileSync(`${EVIDENCE_DIR}/trk-006-booking-submit-events.json`, JSON.stringify(bookingSubmitEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-006-booking-submit.png`, fullPage: true })
})

test("TRK-007: deposit CTA click emits conversion-intent event", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.goto("/deposit?id=TRK007", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.evaluate(() => {
    ;(window as Window & { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__ = true
  })

  await page.getByRole("button", { name: /Pay Securely with Stripe/i }).click()

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "deposit_started")
  })

  const depositStartedEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "deposit_started")
  })

  await expect(depositStartedEvents.length).toBeGreaterThan(0)
  const latestEvent = depositStartedEvents[depositStartedEvents.length - 1] as Record<string, unknown>

  await expect(latestEvent.page_path).toBe("/deposit")
  await expect(latestEvent.currency).toBe("USD")
  await expect(typeof latestEvent.value).toBe("number")

  writeFileSync(`${EVIDENCE_DIR}/trk-007-deposit-started-events.json`, JSON.stringify(depositStartedEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-007-deposit.png`, fullPage: true })
})

test("TRK-008: contact form submit emits lead_submit with channel metadata", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.route("**/api/contact", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  })

  await page.goto("/contact", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Contact Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.locator('input[name="name"]').fill("TRK Contact User")
  await page.locator('input[name="email"]').fill("trk008@example.com")
  await page.locator('input[name="phone"]').fill("2135550108")
  await page.locator('input[name="company"]').fill("TRK Co")
  await page.locator('input[name="serviceType"]').fill("Photography")
  await page.locator('textarea[name="message"]').fill("Interested in partnership opportunities.")

  await page.getByRole("button", { name: "Submit Application" }).click()
  await expect(page.getByText("Thank you for your application! We will contact you within 24 hours.")).toBeVisible()

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "lead_submit")
  })

  const leadSubmitEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "lead_submit")
  })

  await expect(leadSubmitEvents.length).toBeGreaterThan(0)
  const latestEvent = leadSubmitEvents[leadSubmitEvents.length - 1] as Record<string, unknown>

  await expect(latestEvent.lead_channel).toBe("contact_form")
  await expect(latestEvent.lead_source).toBe("contact_page")
  await expect(latestEvent.lead_type).toBe("partner_application")
  await expect(latestEvent.service_type).toBe("Photography")

  writeFileSync(`${EVIDENCE_DIR}/trk-008-lead-submit-events.json`, JSON.stringify(leadSubmitEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-008-contact-submit.png`, fullPage: true })
})
