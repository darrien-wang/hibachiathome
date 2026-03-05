#!/usr/bin/env node
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { chromium } from "@playwright/test"

const EVIDENCE_DIR = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("harness/verification/2026-03-04-cro-deposit-primary-007")
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011"
const DEDUPE_STORAGE_KEY = "realhibachi_deposit_completed_tx_ids"
const SERVER_READY_TIMEOUT_MS = 4 * 60 * 1000
const NAVIGATION_TIMEOUT_MS = 120 * 1000
const BASE_URL_PARSED = new URL(BASE_URL)
const DEV_PORT = BASE_URL_PARSED.port || "3011"

mkdirSync(EVIDENCE_DIR, { recursive: true })

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

function writeJson(name, payload) {
  writeFileSync(resolve(EVIDENCE_DIR, name), `${JSON.stringify(payload, null, 2)}\n`, "utf-8")
}

function writeText(name, content) {
  writeFileSync(resolve(EVIDENCE_DIR, name), `${content}\n`, "utf-8")
}

async function waitForServerReady() {
  const startedAt = Date.now()
  const healthUrl = `${BASE_URL}/`

  while (Date.now() - startedAt < SERVER_READY_TIMEOUT_MS) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(healthUrl, { method: "GET", signal: controller.signal })
      clearTimeout(timeoutId)
      if (response.ok) {
        const seconds = Math.ceil((Date.now() - startedAt) / 1000)
        writeText("dev-server-ready.log", `server_ready_after_seconds=${seconds}`)
        return
      }
    } catch {
      // Keep polling while server boots.
    }

    await sleep(1000)
  }

  throw new Error(`Server did not become ready within ${SERVER_READY_TIMEOUT_MS / 1000}s at ${healthUrl}`)
}

async function isServerReachable() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    const response = await fetch(`${BASE_URL}/`, { method: "GET", signal: controller.signal })
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

async function readDepositCompletedEvents(page) {
  return page.evaluate(() => {
    const dataLayer = window.dataLayer ?? []
    return dataLayer.filter((entry) => entry?.event === "deposit_completed")
  })
}

async function run() {
  const devLogStream = createWriteStream(resolve(EVIDENCE_DIR, "dev-server.log"), { flags: "a" })
  let devProcess = null
  let startedLocalServer = false

  if (!(await isServerReachable())) {
    devProcess = spawn("pnpm", ["dev", "--port", DEV_PORT], {
      cwd: process.cwd(),
      env: { ...process.env, CI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    devProcess.stdout.pipe(devLogStream)
    devProcess.stderr.pipe(devLogStream)
    startedLocalServer = true
    await waitForServerReady()
  } else {
    writeText("dev-server-ready.log", "server_reused_existing_process=true")
  }

  const stopServer = async () => {
    if (startedLocalServer && devProcess) {
      const waitForExit = new Promise((resolveExit) => {
        devProcess.once("exit", () => resolveExit(undefined))
      })

      if (devProcess.exitCode === null) {
        devProcess.kill("SIGTERM")
      }
      await Promise.race([waitForExit, sleep(3000)])

      if (devProcess.exitCode === null) {
        devProcess.kill("SIGKILL")
      }
      await Promise.race([waitForExit, sleep(3000)])
    }
    devLogStream.end()
  }

  let browser

  try {
    await waitForServerReady()
    browser = await chromium.launch({ headless: true })

    // Baseline: verify one previously passing core flow before feature checks.
    {
      const page = await browser.newPage()
      const baselineUrl = `${BASE_URL}/deposit/pay?id=BASELINE007`
      page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS)
      const response = await page.goto(baselineUrl, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS })
      await page.waitForLoadState("networkidle")
      const title = await page.title()
      assert.ok(response && response.ok(), "Expected baseline deposit pay route to return a successful response.")
      assert.ok(/Real Hibachi|Deposit/i.test(title), "Expected baseline page title to load correctly.")

      await page.screenshot({ path: resolve(EVIDENCE_DIR, "core-baseline-deposit-pay.png"), fullPage: true })
      writeJson("core-baseline-deposit-pay.log", {
        url: baselineUrl,
        status: response?.status() ?? null,
        title,
        pass: true,
      })
      writeText("core-baseline-deposit-pay.exit", "0")
      await page.close()
    }

    // 007-01: success paid path emits exactly one conversion payload.
    {
      const context = await browser.newContext()
      const sessionId = "cs_test_cro007_paid_once"
      const transactionId = "pi_test_cro007_paid_once"
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

      const page = await context.newPage()
      page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS)
      await page.goto(`${BASE_URL}/deposit/success?session_id=${encodeURIComponent(sessionId)}`, {
        waitUntil: "networkidle",
        timeout: NAVIGATION_TIMEOUT_MS,
      })
      await page.getByText("Deposit payment confirmed").waitFor({ timeout: NAVIGATION_TIMEOUT_MS })

      await page.waitForFunction(() => (window.dataLayer ?? []).some((entry) => entry?.event === "deposit_completed"))
      const events = await readDepositCompletedEvents(page)
      assert.equal(events.length, 1, "Paid success should emit exactly one deposit_completed event.")
      assert.equal(events[0]?.transaction_id, transactionId)
      assert.equal(events[0]?.value, 325)
      assert.equal(events[0]?.currency, "USD")

      writeJson("cro-deposit-primary-007-paid-once.json", {
        session_id: sessionId,
        transaction_id: transactionId,
        count: events.length,
        payload: events[0],
      })
      await page.screenshot({ path: resolve(EVIDENCE_DIR, "cro-deposit-primary-007-paid-once.png"), fullPage: true })
      await context.close()
    }

    // 007-02: cancel page never emits deposit_completed conversion.
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS)
      await page.goto(`${BASE_URL}/deposit/cancel?booking_id=BOOK007-02`, {
        waitUntil: "networkidle",
        timeout: NAVIGATION_TIMEOUT_MS,
      })
      await page.getByText("Deposit Checkout Canceled").waitFor({ timeout: NAVIGATION_TIMEOUT_MS })

      const events = await readDepositCompletedEvents(page)
      assert.equal(events.length, 0, "Cancel page should not emit deposit_completed.")

      writeJson("cro-deposit-primary-007-cancel-no-conversion.json", {
        booking_id: "BOOK007-02",
        count: events.length,
      })
      await page.screenshot({ path: resolve(EVIDENCE_DIR, "cro-deposit-primary-007-cancel.png"), fullPage: true })
      await context.close()
    }

    // 007-03: refresh/reopen dedupe by transaction_id.
    {
      const context = await browser.newContext()
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

      const successUrl = `${BASE_URL}/deposit/success?session_id=${encodeURIComponent(sessionId)}`

      const page = await context.newPage()
      page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS)
      await page.goto(successUrl, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT_MS })
      await page.getByText("Deposit payment confirmed").waitFor({ timeout: NAVIGATION_TIMEOUT_MS })
      await page.waitForFunction(() => (window.dataLayer ?? []).some((entry) => entry?.event === "deposit_completed"))
      const firstLoadEvents = await readDepositCompletedEvents(page)
      assert.equal(firstLoadEvents.length, 1, "Initial load should emit one conversion.")

      await page.reload({ waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT_MS })
      await page.getByText("Deposit payment confirmed").waitFor({ timeout: NAVIGATION_TIMEOUT_MS })
      const reloadEvents = await readDepositCompletedEvents(page)
      assert.equal(reloadEvents.length, 0, "Reload should not emit duplicate conversion.")

      const reopenedPage = await context.newPage()
      reopenedPage.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS)
      await reopenedPage.goto(successUrl, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT_MS })
      await reopenedPage.getByText("Deposit payment confirmed").waitFor({ timeout: NAVIGATION_TIMEOUT_MS })
      const reopenEvents = await readDepositCompletedEvents(reopenedPage)
      assert.equal(reopenEvents.length, 0, "Reopen in same context should not emit duplicate conversion.")

      const dedupeStorage = await reopenedPage.evaluate((storageKey) => {
        try {
          const raw = window.localStorage.getItem(storageKey)
          if (!raw) return []
          const parsed = JSON.parse(raw)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      }, DEDUPE_STORAGE_KEY)
      assert.ok(Array.isArray(dedupeStorage), "Expected dedupe storage to be an array.")
      assert.ok(dedupeStorage.includes(transactionId), "Expected transaction_id persisted for dedupe.")

      writeJson("cro-deposit-primary-007-refresh-reopen-dedupe.json", {
        session_id: sessionId,
        transaction_id: transactionId,
        first_load_count: firstLoadEvents.length,
        reload_count: reloadEvents.length,
        reopen_count: reopenEvents.length,
        dedupe_storage: dedupeStorage,
      })
      await page.screenshot({ path: resolve(EVIDENCE_DIR, "cro-deposit-primary-007-refresh.png"), fullPage: true })
      await reopenedPage.screenshot({ path: resolve(EVIDENCE_DIR, "cro-deposit-primary-007-reopen.png"), fullPage: true })
      await context.close()
    }

    // 007-04: delayed webhook blocks conversion until paid verify arrives.
    {
      const context = await browser.newContext()
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

      const page = await context.newPage()
      page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS)
      await page.goto(`${BASE_URL}/deposit/success?session_id=${encodeURIComponent(sessionId)}`, {
        waitUntil: "networkidle",
        timeout: NAVIGATION_TIMEOUT_MS,
      })
      await page.getByText("Payment not confirmed yet").waitFor({ timeout: NAVIGATION_TIMEOUT_MS })
      await page.screenshot({ path: resolve(EVIDENCE_DIR, "cro-deposit-primary-007-delayed-webhook-pending.png"), fullPage: true })

      const beforeRefreshEvents = await readDepositCompletedEvents(page)
      assert.equal(beforeRefreshEvents.length, 0, "Unpaid verification state must not emit conversion.")

      await page.getByRole("button", { name: "Refresh Verification" }).click()
      await page.getByText("Deposit payment confirmed").waitFor({ timeout: NAVIGATION_TIMEOUT_MS })
      await page.waitForFunction(() => (window.dataLayer ?? []).some((entry) => entry?.event === "deposit_completed"))

      const afterRefreshEvents = await readDepositCompletedEvents(page)
      assert.equal(afterRefreshEvents.length, 1, "Paid verification after refresh should emit one conversion.")
      assert.equal(afterRefreshEvents[0]?.transaction_id, transactionId)
      assert.ok(verifyCallCount >= 2, "Expected at least two verify calls for delayed webhook scenario.")

      writeJson("cro-deposit-primary-007-delayed-webhook.json", {
        session_id: sessionId,
        transaction_id: transactionId,
        verify_call_count: verifyCallCount,
        before_refresh_count: beforeRefreshEvents.length,
        after_refresh_count: afterRefreshEvents.length,
        after_refresh_payload: afterRefreshEvents[0],
      })
      await page.screenshot({ path: resolve(EVIDENCE_DIR, "cro-deposit-primary-007-delayed-webhook-confirmed.png"), fullPage: true })
      await context.close()
    }

    writeText("cro-deposit-primary-007.exit", "0")
    console.log("CRO-DEPOSIT-PRIMARY-007 verification passed.")
  } finally {
    if (browser) {
      await browser.close()
    }
    await stopServer()
  }
}

run().catch((error) => {
  writeText("cro-deposit-primary-007.exit", "1")
  writeJson("cro-deposit-primary-007-error.json", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  })
  console.error(error)
  process.exit(1)
})
