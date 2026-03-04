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

  await page.getByRole("button", { name: "Get Instant Quote" }).click()
  await page.waitForURL(/\/quoteA(?:\?.*)?$/, { timeout: 20_000 })

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

test("TRK-006: quote completion event includes required payload without undefined values", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(90_000)

  await page.goto("/quoteA", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Quote A|Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.getByPlaceholder("Your full name").fill("TRK Quote User")
  await page.locator('input[type="date"]').first().fill("2026-05-18")

  const timeSelect = page.locator("select").first()
  await expect(timeSelect).toBeVisible({ timeout: 20_000 })
  await timeSelect.selectOption("19:00")

  await page.getByPlaceholder("Los Angeles or 90001").fill("90001")

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "quote_completed")
  })

  const quoteCompletedEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "quote_completed")
  })

  await expect(quoteCompletedEvents.length).toBeGreaterThan(0)
  const latestEvent = quoteCompletedEvents[quoteCompletedEvents.length - 1] as Record<string, unknown>
  const requiredKeys = [
    "event",
    "page_path",
    "page_title",
    "quote_surface",
    "city_or_zip",
    "guest_count",
    "estimate_low",
    "estimate_high",
  ]

  for (const key of requiredKeys) {
    await expect(Object.prototype.hasOwnProperty.call(latestEvent, key)).toBeTruthy()
    await expect(latestEvent[key]).not.toBeUndefined()
  }

  const undefinedEntries = Object.entries(latestEvent).filter(([, value]) => value === undefined)
  await expect(undefinedEntries).toHaveLength(0)
  await expect(latestEvent.page_path).toBe("/quoteA")
  await expect(Number(latestEvent.estimate_low)).toBeGreaterThan(0)
  await expect(Number(latestEvent.estimate_high)).toBeGreaterThanOrEqual(Number(latestEvent.estimate_low))

  writeFileSync(`${EVIDENCE_DIR}/trk-006-quote-completed-events.json`, JSON.stringify(quoteCompletedEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-006-quote-completed.png`, fullPage: true })
})

test("TRK-007: deposit CTA click emits conversion-intent event", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.goto("/deposit/pay?id=TRK007", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.evaluate(() => {
    ;(window as Window & { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__ = true
  })

  await page.getByRole("button", { name: /Lock Your Date/i }).click()

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

  await expect(latestEvent.page_path).toBe("/deposit/pay")
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
  await page.locator('input[name="eventDate"]').fill("2026-04-15")
  await page.locator('input[name="guestCount"]').fill("18")
  await page.locator('input[name="cityOrZip"]').fill("Irvine")
  await page.locator('input[name="reason"]').fill("Birthday booking")
  await page.locator('textarea[name="message"]').fill("Looking for a private hibachi birthday dinner.")

  await page.getByRole("button", { name: "Send Request" }).click()
  await expect(page.getByText("Thanks. Your request is in and we will contact you shortly.")).toBeVisible()

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
  await expect(latestEvent.lead_type).toBe("customer_inquiry")
  await expect(latestEvent.inquiry_reason).toBe("Birthday booking")

  writeFileSync(`${EVIDENCE_DIR}/trk-008-lead-submit-events.json`, JSON.stringify(leadSubmitEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-008-contact-submit.png`, fullPage: true })
})

test("TRK-009: quote start emits quote_started with expected quote context", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.goto("/quoteA", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Quote A|Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "quote_started")
  })

  const quoteStartedEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "quote_started")
  })

  await expect(quoteStartedEvents.length).toBeGreaterThan(0)
  const latestEvent = quoteStartedEvents[quoteStartedEvents.length - 1] as Record<string, unknown>
  await expect(latestEvent.quote_surface).toBe("quote_builder_a")
  await expect(Number(latestEvent.adults)).toBeGreaterThan(0)
  await expect(typeof latestEvent.tableware_rental).toBe("boolean")
  await expect(typeof latestEvent.tent_10x10).toBe("boolean")

  writeFileSync(`${EVIDENCE_DIR}/trk-009-quote-started-events.json`, JSON.stringify(quoteStartedEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-009-quote-started.png`, fullPage: true })
})

test("TRK-010: package selection emits package_selected with package metadata", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.goto("/hibachi-at-home", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  const packageSection = page.locator("section").filter({ hasText: "Our Popular Packages" }).first()
  await packageSection.getByRole("button", { name: "Book Now" }).first().click()
  await page.waitForURL(/\/book\?package=show$/, { timeout: 20_000 })

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "package_selected" && entry.package_type === "show")
  })

  const packageSelectedEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "package_selected")
  })

  await expect(packageSelectedEvents.length).toBeGreaterThan(0)
  const latestEvent = packageSelectedEvents[packageSelectedEvents.length - 1] as Record<string, unknown>

  await expect(latestEvent.package_type).toBe("show")
  await expect(latestEvent.package_name).toBe("Hibachi Show Package")
  await expect(latestEvent.price_tier).toBe("59.9_per_person")

  writeFileSync(
    `${EVIDENCE_DIR}/trk-010-package-selected-events.json`,
    JSON.stringify(packageSelectedEvents, null, 2),
    "utf-8",
  )
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-010-package-selected.png`, fullPage: true })
})

test("TRK-011: promo banner CTA click emits promotion_click with campaign id", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.goto("/book", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.getByRole("button", { name: "Contact Us" }).click()
  await page.waitForURL(/\/contact$/, { timeout: 20_000 })

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "promotion_click" && entry.campaign_id === "seasonal-menu")
  })

  const promotionClickEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "promotion_click")
  })

  await expect(promotionClickEvents.length).toBeGreaterThan(0)
  const latestEvent = promotionClickEvents[promotionClickEvents.length - 1] as Record<string, unknown>

  await expect(latestEvent.campaign_id).toBe("seasonal-menu")
  await expect(typeof latestEvent.campaign_name).toBe("string")
  await expect(latestEvent.campaign_destination).toBe("/contact")

  writeFileSync(
    `${EVIDENCE_DIR}/trk-011-promotion-click-events.json`,
    JSON.stringify(promotionClickEvents, null, 2),
    "utf-8",
  )
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-011-promotion-click.png`, fullPage: true })
})

test("TRK-012: Instagram video interaction emits social_video_engagement event", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.evaluate(() => {
    window.open = () => null
  })

  const playButtons = page.locator('button[aria-label^="Play Instagram video"]')
  const openButtons = page.locator('button[aria-label^="Open Instagram post"]')
  let expectedInteractionType: "play" | "open_instagram" = "play"

  if (await playButtons.count()) {
    await expect(playButtons.first()).toBeVisible({ timeout: 20_000 })
    await playButtons.first().click()
  } else {
    expectedInteractionType = "open_instagram"
    await expect(openButtons.first()).toBeVisible({ timeout: 20_000 })
    await openButtons.first().click()
  }

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "social_video_engagement")
  })

  const socialVideoEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "social_video_engagement")
  })

  await expect(socialVideoEvents.length).toBeGreaterThan(0)
  const latestEvent = socialVideoEvents[socialVideoEvents.length - 1] as Record<string, unknown>

  await expect(latestEvent.interaction_type).toBe(expectedInteractionType)
  await expect(typeof latestEvent.video_id).toBe("string")
  await expect(latestEvent.video_source).toBe("instagram_section")

  writeFileSync(
    `${EVIDENCE_DIR}/trk-012-social-video-engagement-events.json`,
    JSON.stringify(socialVideoEvents, null, 2),
    "utf-8",
  )
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-012-social-video-engagement.png`, fullPage: true })
})

test("TRK-013: floating contact phone click emits phone_click event", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.evaluate(() => {
    ;(window as Window & { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__ = true
  })

  const floatingBar = page.locator("div.fixed.bottom-0.left-0.right-0").first()
  await floatingBar.getByRole("button", { name: "Book Now" }).click()
  await floatingBar.getByRole("button", { name: "Call Us" }).click()
  await floatingBar.getByRole("button", { name: "Call Now" }).click()

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "phone_click")
  })

  const phoneClickEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "phone_click")
  })

  await expect(phoneClickEvents.length).toBeGreaterThan(0)
  const latestEvent = phoneClickEvents[phoneClickEvents.length - 1] as Record<string, unknown>
  await expect(latestEvent.contact_surface).toBe("floating_contact_buttons")

  writeFileSync(`${EVIDENCE_DIR}/trk-013-phone-click-events.json`, JSON.stringify(phoneClickEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-013-phone-click.png`, fullPage: true })
})

test("TRK-014: floating contact SMS click emits sms_click event", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.evaluate(() => {
    ;(window as Window & { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__ = true
  })

  const floatingBar = page.locator("div.fixed.bottom-0.left-0.right-0").first()
  await floatingBar.getByRole("button", { name: "Book Now" }).click()
  await floatingBar.getByRole("button", { name: "Send Text" }).click()
  await floatingBar.getByRole("button", { name: "Send SMS" }).click()

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "sms_click")
  })

  const smsClickEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "sms_click")
  })

  await expect(smsClickEvents.length).toBeGreaterThan(0)
  const latestEvent = smsClickEvents[smsClickEvents.length - 1] as Record<string, unknown>
  await expect(latestEvent.contact_surface).toBe("floating_contact_buttons")

  writeFileSync(`${EVIDENCE_DIR}/trk-014-sms-click-events.json`, JSON.stringify(smsClickEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-014-sms-click.png`, fullPage: true })
})

test("TRK-015: quote completion emits quote_completed with numeric estimate range", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(90_000)

  await page.goto("/quoteA", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Quote A|Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  await page.locator('input[type="date"]').first().fill("2026-06-01")
  await page.getByPlaceholder("Los Angeles or 90001").fill("Irvine")

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "quote_completed")
  })

  const quoteCompletedEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "quote_completed")
  })

  await expect(quoteCompletedEvents.length).toBeGreaterThan(0)
  const latestEvent = quoteCompletedEvents[quoteCompletedEvents.length - 1] as Record<string, unknown>

  await expect(typeof latestEvent.estimate_low).toBe("number")
  await expect(typeof latestEvent.estimate_high).toBe("number")
  await expect(Number(latestEvent.estimate_low)).toBeGreaterThan(0)
  await expect(Number(latestEvent.estimate_high)).toBeGreaterThanOrEqual(Number(latestEvent.estimate_low))

  writeFileSync(`${EVIDENCE_DIR}/trk-015-quote-completed-events.json`, JSON.stringify(quoteCompletedEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-015-quote-completed.png`, fullPage: true })
})

test("TRK-016: tracking remains resilient when GTM/dataLayer is unavailable", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(60_000)

  const runtimeErrors: string[] = []
  page.on("pageerror", (error) => {
    runtimeErrors.push(error.message)
  })

  await page.route("**://www.googletagmanager.com/**", async (route) => {
    await route.abort()
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.evaluate(() => {
    ;(window as Window & { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__ = true
    ;(window as Window & { dataLayer?: unknown }).dataLayer = undefined
  })

  const floatingBar = page.locator("div.fixed.bottom-0.left-0.right-0").first()
  await floatingBar.getByRole("button", { name: "Book Now" }).click()
  await floatingBar.getByRole("button", { name: "Call Us" }).click()
  await floatingBar.getByRole("button", { name: "Call Now" }).click()
  await floatingBar.getByRole("button", { name: "Send Text" }).click()
  await floatingBar.getByRole("button", { name: "Send SMS" }).click()

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    const hasPhoneClick = dataLayer.some((entry) => entry.event === "phone_click")
    const hasSmsClick = dataLayer.some((entry) => entry.event === "sms_click")
    return hasPhoneClick && hasSmsClick
  })

  const eventSummary = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return {
      dataLayerIsArray: Array.isArray(dataLayer),
      phoneClickEvents: dataLayer.filter((entry) => entry.event === "phone_click"),
      smsClickEvents: dataLayer.filter((entry) => entry.event === "sms_click"),
    }
  })

  await expect(runtimeErrors).toHaveLength(0)
  await expect(eventSummary.dataLayerIsArray).toBeTruthy()
  await expect(eventSummary.phoneClickEvents.length).toBeGreaterThan(0)
  await expect(eventSummary.smsClickEvents.length).toBeGreaterThan(0)

  writeFileSync(`${EVIDENCE_DIR}/trk-016-runtime-errors.json`, JSON.stringify(runtimeErrors, null, 2), "utf-8")
  writeFileSync(`${EVIDENCE_DIR}/trk-016-event-summary.json`, JSON.stringify(eventSummary, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-016-tracking-resilience.png`, fullPage: true })
})

test("TRK-017: tracking bootstrap introduces no visual layout shift on home and book pages", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(90_000)

  const layoutMetrics: Array<Record<string, unknown>> = []

  const measurePage = async (path: string, screenshotName: string) => {
    await page.goto(path, { waitUntil: "domcontentloaded" })
    await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

    const anchor = page.getByRole("link", { name: "Home" }).first()
    await expect(anchor).toBeVisible({ timeout: 20_000 })

    const before = await anchor.boundingBox()
    await page.waitForTimeout(1_500)
    const after = await anchor.boundingBox()

    await expect(before).not.toBeNull()
    await expect(after).not.toBeNull()

    const deltaY = Math.abs((after?.y ?? 0) - (before?.y ?? 0))
    const deltaHeight = Math.abs((after?.height ?? 0) - (before?.height ?? 0))

    await expect(deltaY).toBeLessThan(2)
    await expect(deltaHeight).toBeLessThan(2)

    layoutMetrics.push({
      path,
      before,
      after,
      deltaY,
      deltaHeight,
    })

    await page.screenshot({ path: `${EVIDENCE_DIR}/${screenshotName}`, fullPage: true })
  }

  await measurePage("/", "trk-017-home-layout.png")
  await measurePage("/book", "trk-017-book-layout.png")

  writeFileSync(`${EVIDENCE_DIR}/trk-017-layout-metrics.json`, JSON.stringify(layoutMetrics, null, 2), "utf-8")
})

test("TRK-018: core pages stay interactive on desktop and mobile after tracking hooks", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(120_000)

  const runtimeErrors: string[] = []
  page.on("pageerror", (error) => {
    runtimeErrors.push(error.message)
  })

  const interactionLatency: Record<string, number> = {}

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  let start = Date.now()
  await page.locator("header").getByRole("link", { name: "Book Now" }).first().click()
  await page.waitForURL(/\/book(?:\?.*)?$/, { timeout: 20_000 })
  interactionLatency.desktop_home_to_book_ms = Date.now() - start

  start = Date.now()
  await page.getByRole("button", { name: "Get Instant Quote" }).click()
  await page.waitForURL(/\/quoteA(?:\?.*)?$/, { timeout: 20_000 })
  interactionLatency.desktop_book_to_quote_ms = Date.now() - start

  start = Date.now()
  await page.getByPlaceholder("Your full name").fill("TRK018 Desktop User")
  await expect(page.getByPlaceholder("Your full name")).toHaveValue("TRK018 Desktop User")
  interactionLatency.desktop_quote_input_ms = Date.now() - start

  start = Date.now()
  await page.goto("/contact", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveURL(/\/contact(?:\?.*)?$/)
  interactionLatency.desktop_quote_to_contact_ms = Date.now() - start

  await page.locator('input[name="firstName"]').fill("TRK018")
  await page.locator('input[name="lastName"]').fill("Contact User")
  await page.locator('input[name="email"]').fill("trk018@example.com")
  await page.locator('input[name="phone"]').fill("2135550118")
  await expect(page.locator('input[name="firstName"]')).toHaveValue("TRK018")
  await expect(page.locator('input[name="lastName"]')).toHaveValue("Contact User")

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  start = Date.now()
  await page.getByRole("button", { name: "Open menu" }).click()
  await expect(page.getByRole("link", { name: "Feedback" })).toBeVisible({ timeout: 10_000 })
  interactionLatency.mobile_open_menu_ms = Date.now() - start

  start = Date.now()
  await page.getByRole("link", { name: "Feedback" }).click()
  await page.waitForURL(/\/contact(?:\?.*)?$/, { timeout: 20_000 })
  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "page_view" && entry.page_path === "/contact")
  })
  interactionLatency.mobile_menu_to_contact_ms = Date.now() - start

  for (const [metric, value] of Object.entries(interactionLatency)) {
    await expect(value, `${metric} should stay responsive`).toBeLessThan(5_000)
  }

  await expect(runtimeErrors).toHaveLength(0)

  writeFileSync(`${EVIDENCE_DIR}/trk-018-interaction-latency.json`, JSON.stringify(interactionLatency, null, 2), "utf-8")
  writeFileSync(`${EVIDENCE_DIR}/trk-018-runtime-errors.json`, JSON.stringify(runtimeErrors, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-018-mobile-interactions.png`, fullPage: true })
})

test("TRK-019: browser back/forward keeps page_view events consistent with active route", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  test.setTimeout(90_000)

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveTitle(/Real Hibachi/i, { timeout: 20_000 })

  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  const assertLatestPageViewPath = async (expectedPath: string) => {
    await page.waitForFunction((path) => {
      const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
      const pageViews = dataLayer.filter((entry) => entry.event === "page_view")
      const latest = pageViews[pageViews.length - 1]
      return latest?.page_path === path
    }, expectedPath)
  }

  await assertLatestPageViewPath("/")

  await page.locator("header").getByRole("link", { name: "Menu" }).first().click()
  await page.waitForURL(/\/menu(?:\?.*)?$/, { timeout: 20_000 })
  await assertLatestPageViewPath("/menu")

  await page.locator("header").getByRole("link", { name: "FAQ" }).first().click()
  await page.waitForURL(/\/faq(?:\?.*)?$/, { timeout: 20_000 })
  await assertLatestPageViewPath("/faq")

  await page.goBack()
  await page.waitForURL(/\/menu(?:\?.*)?$/, { timeout: 20_000 })
  await assertLatestPageViewPath("/menu")

  await page.goBack()
  await page.waitForURL(/\/(?:\?.*)?$/, { timeout: 20_000 })
  await assertLatestPageViewPath("/")

  await page.goForward()
  await page.waitForURL(/\/menu(?:\?.*)?$/, { timeout: 20_000 })
  await assertLatestPageViewPath("/menu")

  await page.goForward()
  await page.waitForURL(/\/faq(?:\?.*)?$/, { timeout: 20_000 })
  await assertLatestPageViewPath("/faq")

  const pageViewEvents = await page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "page_view")
  })

  await expect(pageViewEvents.length).toBeGreaterThanOrEqual(7)

  writeFileSync(`${EVIDENCE_DIR}/trk-019-page-view-history.json`, JSON.stringify(pageViewEvents, null, 2), "utf-8")
  await page.screenshot({ path: `${EVIDENCE_DIR}/trk-019-faq-after-history-nav.png`, fullPage: true })
})
