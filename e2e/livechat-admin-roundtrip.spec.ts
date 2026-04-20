import { expect, test } from "@playwright/test"
import fs from "node:fs/promises"
import path from "node:path"

const adminBaseUrl = process.env.ADMIN_BASE_URL || "http://127.0.0.1:3510"
const adminUsername = process.env.ADMIN_E2E_USERNAME || "admin"
const adminPassword = process.env.ADMIN_E2E_PASSWORD || "realhibachi@0326"

test.describe("Livechat Admin Roundtrip", () => {
  test.setTimeout(120_000)

  test("visitor can start a chat and receive an admin reply", async ({ browser, baseURL }, testInfo) => {
    if (!baseURL) {
      throw new Error("PLAYWRIGHT_BASE_URL is required for the marketing app.")
    }

    const stamp = Date.now()
    const suffix = String(stamp).slice(-6)
    const visitorName = `E2E Visitor ${suffix}`
    const visitorEmail = `e2e-${stamp}@realhibachi.test`
    const visitorPhone = `626555${String(suffix).slice(-4)}`
    const visitorMessage = `E2E visitor message ${stamp}`
    const adminReply = `E2E admin reply ${stamp}`

    const visitorContext = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const visitorPage = await visitorContext.newPage()
    const adminPage = await adminContext.newPage()

    const evidenceDir = path.dirname(testInfo.outputPath("roundtrip-result.json"))
    const result = {
      marketingBaseUrl: baseURL,
      adminBaseUrl,
      adminUsername,
      visitorName,
      visitorEmail,
      visitorPhone,
      visitorMessage,
      adminReply,
      sessionId: null as string | null,
      adminDetailUrl: null as string | null,
      visitorReceivedReplyViaRealtime: false,
      visitorReceivedReplyAfterFallbackRefresh: false,
      visitorUnreadPopupShown: false,
      visitorUnreadPopupClearedAfterOpen: false,
    }

    async function persistResult(ok: boolean, extra?: Record<string, unknown>) {
      await fs.mkdir(evidenceDir, { recursive: true })
      await fs.writeFile(
        testInfo.outputPath("roundtrip-result.json"),
        JSON.stringify({ ok, ...result, ...extra }, null, 2)
      )
    }

    async function waitForSessionId() {
      for (let index = 0; index < 20; index += 1) {
        const sessionId = await visitorPage.evaluate(() => window.localStorage.getItem("rh_livechat_session_id"))
        if (sessionId) {
          return sessionId
        }
        await visitorPage.waitForTimeout(500)
      }

      throw new Error("Timed out waiting for rh_livechat_session_id in localStorage")
    }

    try {
      const healthResponse = await adminContext.request.get(`${adminBaseUrl}/login`)
      if (!healthResponse.ok()) {
        throw new Error(`Admin app is not reachable at ${adminBaseUrl}/login`)
      }

      await visitorPage.goto(baseURL, { waitUntil: "domcontentloaded" })
      await visitorPage.evaluate(() => {
        window.localStorage.removeItem("rh_livechat_session_id")
        window.localStorage.removeItem("rh_livechat_visitor_name")
        window.localStorage.removeItem("rh_livechat_visitor_email")
        window.localStorage.removeItem("rh_livechat_visitor_phone")
      })
      await visitorPage.reload({ waitUntil: "domcontentloaded" })

      await visitorPage.getByRole("button", { name: /open support chat|chat with support/i }).click()
      await visitorPage.getByLabel("Visitor name").fill(visitorName)
      await visitorPage.getByLabel("Visitor email").fill(visitorEmail)
      await visitorPage.getByLabel("Visitor phone").fill(visitorPhone)
      await visitorPage.getByLabel("Support message").fill(visitorMessage)
      await visitorPage.getByRole("button", { name: /^send$/i }).click()
      await visitorPage.getByText(visitorMessage, { exact: false }).waitFor({ timeout: 20_000 })
      await visitorPage.getByRole("button", { name: "Close support chat" }).click()

      result.sessionId = await waitForSessionId()
      await visitorPage.screenshot({ path: testInfo.outputPath("01-visitor-message-sent.png") })

      const loginResponse = await adminContext.request.post(`${adminBaseUrl}/api/admin/login`, {
        data: {
          username: adminUsername,
          password: adminPassword,
          next: "/support",
        },
      })

      if (!loginResponse.ok()) {
        throw new Error(`Admin login API failed with status ${loginResponse.status()}`)
      }

      await adminPage.goto(`${adminBaseUrl}/support`, { waitUntil: "domcontentloaded" })
      await adminPage.getByRole("heading", { name: "客服工作台" }).waitFor({ timeout: 30_000 })

      const searchInput = adminPage.getByPlaceholder("搜索访客姓名、邮箱、电话、订单号、消息内容...")
      await searchInput.fill(visitorEmail)

      const visitorResult = adminPage.getByText(visitorName, { exact: false }).first()
      await visitorResult.waitFor({ timeout: 30_000 })
      await visitorResult.click()

      await adminPage.getByRole("link", { name: /打开完整会话详情/i }).click()
      await adminPage.waitForURL(new RegExp(`/support/chat/${result.sessionId}`), { timeout: 30_000 })
      result.adminDetailUrl = adminPage.url()

      await adminPage.getByText(visitorMessage, { exact: false }).first().waitFor({ timeout: 20_000 })
      const adminReplyComposer = adminPage.getByPlaceholder("输入要发送给客户的回复内容...")
      await adminReplyComposer.fill(adminReply)
      await adminPage.getByRole("button", { name: /发送回复|发送中/i }).click()
      await expect(adminReplyComposer).toHaveValue("", { timeout: 45_000 })
      await adminPage.getByText(adminReply, { exact: false }).last().waitFor({ timeout: 20_000 })
      await adminPage.screenshot({ path: testInfo.outputPath("02-admin-replied.png") })

      try {
        await visitorPage.getByText("New Support Reply", { exact: false }).waitFor({ timeout: 20_000 })
        result.visitorReceivedReplyViaRealtime = true
      } catch {
        await visitorPage.getByRole("button", { name: /open support chat|chat with support/i }).click()
        await visitorPage.getByRole("button", { name: /refresh/i }).click()
        await visitorPage.getByRole("button", { name: "Close support chat" }).click()
        await visitorPage.getByText("New Support Reply", { exact: false }).waitFor({ timeout: 20_000 })
        result.visitorReceivedReplyAfterFallbackRefresh = true
      }

      result.visitorUnreadPopupShown = true
      await visitorPage.getByText("1 unread reply", { exact: false }).waitFor({ timeout: 20_000 })
      await visitorPage.getByRole("button", { name: /^open$/i }).click()
      await visitorPage.getByText(adminReply, { exact: false }).last().waitFor({ timeout: 20_000 })
      await expect(visitorPage.getByText("New Support Reply", { exact: false })).toBeHidden()
      await visitorPage.getByRole("button", { name: "Close support chat" }).click()
      await expect(visitorPage.getByText("New Support Reply", { exact: false })).toBeHidden()
      result.visitorUnreadPopupClearedAfterOpen = true

      await visitorPage.screenshot({ path: testInfo.outputPath("03-visitor-received-reply.png") })
      await persistResult(true)
    } catch (error) {
      await visitorPage.screenshot({ path: testInfo.outputPath("error-visitor.png") }).catch(() => null)
      await adminPage.screenshot({ path: testInfo.outputPath("error-admin.png") }).catch(() => null)
      await persistResult(false, {
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      })
      throw error
    } finally {
      await visitorContext.close()
      await adminContext.close()
    }
  })
})
