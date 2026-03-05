import { mkdirSync, writeFileSync } from "node:fs"
import { test, expect, type Page } from "@playwright/test"

const EVIDENCE_DIR = process.env.TRACKING_EVIDENCE_DIR ?? "harness/verification/2026-03-04-cro-deposit-primary-007"
const DEDUPE_STORAGE_KEY = "realhibachi_deposit_completed_tx_ids"

type DataLayerEvent = Record<string, unknown>

function ensureEvidenceDir() {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
}

async function readDepositCompletedEvents(page: Page): Promise<DataLayerEvent[]> {
  await page.waitForFunction(() =>
    Array.isArray((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer),
  )

  return page.evaluate(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.filter((entry) => entry.event === "deposit_completed")
  })
}

function writeEvidence(filename: string, payload: unknown) {
  writeFileSync(`${EVIDENCE_DIR}/${filename}`, `${JSON.stringify(payload, null, 2)}\n`, "utf-8")
}

test.beforeEach(async () => {
  ensureEvidenceDir()
})

test("CRO-DEPOSIT-PRIMARY-007-01: paid verify emits exactly one deposit_completed with required payload", async ({
  context,
  page,
}) => {
  const sessionId = "cs_test_cro007_paid_first"
  const transactionId = "pi_test_cro007_paid_first"

  await context.route("**/api/deposit/verify?session_id=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        paid: true,
        session_id: sessionId,
        status: "paid",
        value: 325,
        currency: "USD",
        transaction_id: transactionId,
        booking_id: "BOOK007-01",
      }),
      headers: {
        "Cache-Control": "no-store",
      },
    })
  })

  await page.goto(`/deposit/success?session_id=${encodeURIComponent(sessionId)}`, { waitUntil: "networkidle" })
  await expect(page.getByText("Deposit payment confirmed")).toBeVisible()

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "deposit_completed")
  })

  const depositCompletedEvents = await readDepositCompletedEvents(page)
  await expect(depositCompletedEvents).toHaveLength(1)

  const latest = depositCompletedEvents[0] as Record<string, unknown>
  await expect(latest.transaction_id).toBe(transactionId)
  await expect(latest.value).toBe(325)
  await expect(latest.currency).toBe("USD")

  writeEvidence("cro-deposit-primary-007-paid-once.json", {
    session_id: sessionId,
    transaction_id: transactionId,
    count: depositCompletedEvents.length,
    payload: latest,
  })
  await page.screenshot({ path: `${EVIDENCE_DIR}/cro-deposit-primary-007-paid-once.png`, fullPage: true })
})

test("CRO-DEPOSIT-PRIMARY-007-02: cancel flow does not emit deposit_completed", async ({ page }) => {
  await page.goto("/deposit/cancel?booking_id=BOOK007-02", { waitUntil: "networkidle" })
  await expect(page.getByText("Deposit Checkout Canceled")).toBeVisible()

  const depositCompletedEvents = await readDepositCompletedEvents(page)
  await expect(depositCompletedEvents).toHaveLength(0)

  writeEvidence("cro-deposit-primary-007-cancel-no-conversion.json", {
    booking_id: "BOOK007-02",
    count: depositCompletedEvents.length,
  })
  await page.screenshot({ path: `${EVIDENCE_DIR}/cro-deposit-primary-007-cancel.png`, fullPage: true })
})

test("CRO-DEPOSIT-PRIMARY-007-03: success refresh and reopen are deduped by transaction_id", async ({
  context,
  page,
}) => {
  const sessionId = "cs_test_cro007_dedupe"
  const transactionId = "pi_test_cro007_dedupe"

  await context.route("**/api/deposit/verify?session_id=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        paid: true,
        session_id: sessionId,
        status: "paid",
        value: 410,
        currency: "USD",
        transaction_id: transactionId,
        booking_id: "BOOK007-03",
      }),
      headers: {
        "Cache-Control": "no-store",
      },
    })
  })

  const successUrl = `/deposit/success?session_id=${encodeURIComponent(sessionId)}`

  await page.goto(successUrl, { waitUntil: "networkidle" })
  await expect(page.getByText("Deposit payment confirmed")).toBeVisible()
  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "deposit_completed")
  })

  const firstLoadEvents = await readDepositCompletedEvents(page)
  await expect(firstLoadEvents).toHaveLength(1)

  await page.reload({ waitUntil: "networkidle" })
  await expect(page.getByText("Deposit payment confirmed")).toBeVisible()
  const reloadEvents = await readDepositCompletedEvents(page)
  await expect(reloadEvents).toHaveLength(0)

  const reopenedPage = await context.newPage()
  await reopenedPage.goto(successUrl, { waitUntil: "networkidle" })
  await expect(reopenedPage.getByText("Deposit payment confirmed")).toBeVisible()
  const reopenEvents = await readDepositCompletedEvents(reopenedPage)
  await expect(reopenEvents).toHaveLength(0)

  const dedupeStorage = await reopenedPage.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return []
    }
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, DEDUPE_STORAGE_KEY)

  await expect(Array.isArray(dedupeStorage)).toBeTruthy()
  await expect(dedupeStorage).toContain(transactionId)

  writeEvidence("cro-deposit-primary-007-refresh-reopen-dedupe.json", {
    session_id: sessionId,
    transaction_id: transactionId,
    first_load_count: firstLoadEvents.length,
    reload_count: reloadEvents.length,
    reopen_count: reopenEvents.length,
    dedupe_storage: dedupeStorage,
  })
  await page.screenshot({ path: `${EVIDENCE_DIR}/cro-deposit-primary-007-refresh.png`, fullPage: true })
  await reopenedPage.screenshot({ path: `${EVIDENCE_DIR}/cro-deposit-primary-007-reopen.png`, fullPage: true })
})

test("CRO-DEPOSIT-PRIMARY-007-04: delayed webhook blocks conversion until paid verification", async ({
  context,
  page,
}) => {
  const sessionId = "cs_test_cro007_delayed"
  const transactionId = "pi_test_cro007_delayed"
  let verifyCallCount = 0

  await context.route("**/api/deposit/verify?session_id=*", async (route) => {
    verifyCallCount += 1
    const isPaid = verifyCallCount >= 2

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        paid: isPaid,
        session_id: sessionId,
        status: isPaid ? "paid" : "pending",
        value: 360,
        currency: "USD",
        transaction_id: isPaid ? transactionId : undefined,
        booking_id: "BOOK007-04",
      }),
      headers: {
        "Cache-Control": "no-store",
      },
    })
  })

  await page.goto(`/deposit/success?session_id=${encodeURIComponent(sessionId)}`, { waitUntil: "networkidle" })
  await expect(page.getByText("Payment not confirmed yet")).toBeVisible()

  const beforeRefreshEvents = await readDepositCompletedEvents(page)
  await expect(beforeRefreshEvents).toHaveLength(0)

  await page.getByRole("button", { name: "Refresh Verification" }).click()
  await expect(page.getByText("Deposit payment confirmed")).toBeVisible()

  await page.waitForFunction(() => {
    const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []
    return dataLayer.some((entry) => entry.event === "deposit_completed")
  })

  const afterRefreshEvents = await readDepositCompletedEvents(page)
  await expect(afterRefreshEvents).toHaveLength(1)
  await expect((afterRefreshEvents[0] as Record<string, unknown>).transaction_id).toBe(transactionId)
  await expect(verifyCallCount).toBeGreaterThanOrEqual(2)

  writeEvidence("cro-deposit-primary-007-delayed-webhook.json", {
    session_id: sessionId,
    transaction_id: transactionId,
    verify_call_count: verifyCallCount,
    before_refresh_count: beforeRefreshEvents.length,
    after_refresh_count: afterRefreshEvents.length,
    after_refresh_payload: afterRefreshEvents[0] ?? null,
  })
  await page.screenshot({ path: `${EVIDENCE_DIR}/cro-deposit-primary-007-delayed-webhook.png`, fullPage: true })
})
