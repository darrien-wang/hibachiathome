import { expect, test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const EVIDENCE_DIR = resolve("cpl-verification/2026-03-11-cpl-009")

function writeEvidence(filename: string, payload: unknown) {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(resolve(EVIDENCE_DIR, filename), `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

test("CPL-009: quote deep link forwards CRM context into livechat message payload", async ({ page }) => {
  let capturedRequest: Record<string, unknown> | null = null

  await page.route("**/api/livechat/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, session: null, messages: [] }),
    })
  })

  await page.route("**/api/livechat/message", async (route) => {
    capturedRequest = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        session: {
          id: "session-cpl-009",
          status: "waiting_admin",
          assignedAdmin: null,
          visitorName: "Test Visitor",
          visitorEmail: "test@example.com",
          visitorPhone: "6265550000",
          latestMessagePreview: "Need help with my quote.",
          unreadForVisitorCount: 0,
          lastMessageAt: "2026-03-11T10:00:00.000Z",
        },
        messages: [
          {
            id: "msg-cpl-009",
            senderRole: "visitor",
            senderName: "Test Visitor",
            body: "Need help with my quote.",
            contentType: "text",
            createdAt: "2026-03-11T10:00:00.000Z",
          },
        ],
      }),
    })
  })

  await page.goto(
    "/quoteA?crm_conversation_id=conv_001&crm_channel=sms&crm_contact_id=ct_001&booking_id=RH-20260311-1234",
    { waitUntil: "domcontentloaded" },
  )

  await page.getByRole("button", { name: /open support chat|chat with support/i }).click()
  await page.getByLabel("Visitor name").fill("Test Visitor")
  await page.getByLabel("Visitor email").fill("test@example.com")
  await page.getByLabel("Visitor phone").fill("6265550000")
  await page.getByLabel("Support message").fill("Need help with my quote.")
  await page.getByRole("button", { name: /^send$/i }).click()

  await expect.poll(() => capturedRequest).not.toBeNull()

  const contextMetadata =
    capturedRequest?.contextMetadata && typeof capturedRequest.contextMetadata === "object"
      ? (capturedRequest.contextMetadata as Record<string, string>)
      : null

  const pass =
    Boolean(capturedRequest) &&
    capturedRequest?.source === "marketing_page" &&
    typeof capturedRequest?.initialPageUrl === "string" &&
    capturedRequest.initialPageUrl.includes("/quoteA?") &&
    Boolean(contextMetadata) &&
    contextMetadata?.path === "/quoteA" &&
    contextMetadata?.intent === "quote" &&
    contextMetadata?.page_group === "quote" &&
    contextMetadata?.source === "realhibachi-marketing" &&
    contextMetadata?.crm_conversation_id === "conv_001" &&
    contextMetadata?.crm_channel === "sms" &&
    contextMetadata?.crm_contact_id === "ct_001" &&
    contextMetadata?.order_hint === "RH-20260311-1234"

  const summary = {
    item: "CPL-009",
    date: "2026-03-11",
    pass,
    capturedRequest,
  }

  writeEvidence("cpl-009-livechat-crm-context.json", summary)
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "cpl-009-livechat-crm-context.png"),
    fullPage: true,
  })

  expect(pass).toBeTruthy()
})
