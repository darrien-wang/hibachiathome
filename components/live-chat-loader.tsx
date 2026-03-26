"use client"

import { useEffect, useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { trackEvent } from "@/lib/tracking"
import { LiveChatPresenceIndicator } from "@/components/livechat-presence-indicator"

type ChatIntent = "quote" | "deposit" | "general"

type ChatContext = {
  path: string
  search: string
  path_with_search: string
  intent: ChatIntent
  page_group: string
  source: string
  crm_conversation_id?: string
  crm_channel?: string
  crm_contact_id?: string
  order_hint?: string
}

type ChatEventDetail = {
  reason?: string
  surface?: string
  cta?: string
  message_length?: number
  has_email?: boolean
  has_phone?: boolean
  session_id?: string
  prompt_key?: string
}

declare global {
  interface Window {
    RealHibachiLiveChat?: {
      setContext?: (context: Record<string, string>) => void
      open?: (reason?: string) => void
    }
  }
}

const LIVECHAT_BASE_URL =
  process.env.NEXT_PUBLIC_LIVECHAT_BASE_URL?.trim() ??
  (process.env.NODE_ENV !== "production" ? "http://localhost:3300" : "")
const LIVECHAT_AVATAR_URL =
  process.env.NEXT_PUBLIC_LIVECHAT_AVATAR_URL?.trim() ??
  "https://i.pravatar.cc/88?img=47"

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "")
}

function getIntent(pathname: string): ChatIntent {
  if (pathname.startsWith("/quote")) return "quote"
  if (pathname.startsWith("/deposit")) return "deposit"
  return "general"
}

function getPageGroup(pathname: string): string {
  if (pathname === "/") return "home"
  if (pathname.startsWith("/quote")) return "quote"
  if (pathname.startsWith("/deposit")) return "deposit"
  if (pathname.startsWith("/contact")) return "contact"
  if (pathname.startsWith("/menu")) return "menu"
  return "other"
}

function readDetail(event: Event): ChatEventDetail {
  const detail = (event as CustomEvent<ChatEventDetail>).detail
  return detail && typeof detail === "object" ? detail : {}
}

function optionalParam(searchParams: URLSearchParams, key: string): string | undefined {
  const raw = searchParams.get(key)
  if (!raw) return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function compactStringRecord(input: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.length > 0) {
      out[key] = value
    }
  }
  return out
}

export function LiveChatLoader() {
  const pathname = usePathname() ?? "/"
  const searchParams = useSearchParams()
  const search = searchParams.toString()

  const context = useMemo<ChatContext>(() => {
    const pathWithSearch = search ? `${pathname}?${search}` : pathname
    const crmConversationId =
      optionalParam(searchParams, "crm_conversation_id") ??
      optionalParam(searchParams, "crmConversationId") ??
      optionalParam(searchParams, "crm_thread_id")
    const crmChannel =
      optionalParam(searchParams, "crm_channel") ??
      optionalParam(searchParams, "crmChannel")
    const crmContactId =
      optionalParam(searchParams, "crm_contact_id") ??
      optionalParam(searchParams, "crmContactId")
    const orderHint =
      optionalParam(searchParams, "booking_id") ??
      optionalParam(searchParams, "id") ??
      optionalParam(searchParams, "order_number")

    return {
      path: pathname,
      search,
      path_with_search: pathWithSearch,
      intent: getIntent(pathname),
      page_group: getPageGroup(pathname),
      source: "realhibachi-marketing",
      crm_conversation_id: crmConversationId,
      crm_channel: crmChannel,
      crm_contact_id: crmContactId,
      order_hint: orderHint,
    }
  }, [pathname, search, searchParams])

  useEffect(() => {
    if (!LIVECHAT_BASE_URL) return

    const baseUrl = normalizeBaseUrl(LIVECHAT_BASE_URL)
    const scriptId = "rh-livechat-widget-script"
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    const expectedSrc = `${baseUrl}/widget.js`
    if (existing) {
      if (existing.src === expectedSrc) return
      existing.remove()
    }

    const script = document.createElement("script")
    script.id = scriptId
    script.async = true
    script.src = expectedSrc
    script.dataset.baseUrl = baseUrl
    script.dataset.site = "realhibachi-marketing"
    script.dataset.brand = "Real Hibachi"
    script.dataset.primaryColor = "#F1691B"
    script.dataset.avatarUrl = LIVECHAT_AVATAR_URL
    script.dataset.zIndex = "2147483000"
    script.dataset.proactive = "true"
    script.dataset.promptQuote = "Need help picking menu and guest plan for your quote?"
    script.dataset.promptDeposit = "Need help before paying deposit? We can confirm your date details."
    script.onerror = () => {
      console.error("[realhibachi-marketing] Failed to load livechat widget script:", expectedSrc)
    }
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (!LIVECHAT_BASE_URL) return

    const payload = compactStringRecord({
      path: context.path,
      search: context.search,
      path_with_search: context.path_with_search,
      intent: context.intent,
      page_group: context.page_group,
      source: context.source,
      crm_conversation_id: context.crm_conversation_id,
      crm_channel: context.crm_channel,
      crm_contact_id: context.crm_contact_id,
      order_hint: context.order_hint,
    })
    window.RealHibachiLiveChat?.setContext?.(payload)
  }, [context])

  useEffect(() => {
    if (!LIVECHAT_BASE_URL) return

    const getTrackingBase = () => ({
      chat_path: window.location.pathname,
      chat_intent: getIntent(window.location.pathname),
      chat_page_group: getPageGroup(window.location.pathname),
      chat_crm_channel: context.crm_channel,
      chat_crm_conversation_id: context.crm_conversation_id,
      chat_crm_handoff: Boolean(context.crm_conversation_id),
    })

    const onOpened = (event: Event) => {
      const detail = readDetail(event)
      trackEvent("chat_widget_opened", {
        ...getTrackingBase(),
        chat_reason: detail.reason ?? "manual",
        chat_surface: detail.surface ?? "launcher",
        chat_session_id: detail.session_id,
      })
    }

    const onPromptShown = (event: Event) => {
      const detail = readDetail(event)
      trackEvent("chat_prompt_shown", {
        ...getTrackingBase(),
        chat_prompt_key: detail.prompt_key ?? detail.reason ?? "unknown",
        chat_surface: detail.surface ?? "bubble",
      })
    }

    const onMessageSent = (event: Event) => {
      const detail = readDetail(event)
      trackEvent("chat_message_sent", {
        ...getTrackingBase(),
        chat_message_length: detail.message_length ?? 0,
        chat_session_id: detail.session_id,
      })
    }

    const onLeadSubmitted = (event: Event) => {
      const detail = readDetail(event)
      trackEvent("chat_lead_submitted", {
        ...getTrackingBase(),
        chat_has_email: Boolean(detail.has_email),
        chat_has_phone: Boolean(detail.has_phone),
        chat_session_id: detail.session_id,
      })

      // Keep lead-submit funnel compatibility for existing reporting.
      trackEvent("lead_submit", {
        lead_channel: "live_chat",
        lead_source: "live_chat_widget",
        quote_surface: getPageGroup(window.location.pathname),
      })
    }

    const onCtaClick = (event: Event) => {
      const detail = readDetail(event)
      trackEvent("chat_cta_clicked", {
        ...getTrackingBase(),
        chat_cta: detail.cta ?? "unknown",
        chat_session_id: detail.session_id,
      })
    }

    window.addEventListener("rh_chat_opened", onOpened as EventListener)
    window.addEventListener("rh_chat_prompt_shown", onPromptShown as EventListener)
    window.addEventListener("rh_chat_message_sent", onMessageSent as EventListener)
    window.addEventListener("rh_chat_lead_submitted", onLeadSubmitted as EventListener)
    window.addEventListener("rh_chat_cta_clicked", onCtaClick as EventListener)

    return () => {
      window.removeEventListener("rh_chat_opened", onOpened as EventListener)
      window.removeEventListener("rh_chat_prompt_shown", onPromptShown as EventListener)
      window.removeEventListener("rh_chat_message_sent", onMessageSent as EventListener)
      window.removeEventListener("rh_chat_lead_submitted", onLeadSubmitted as EventListener)
      window.removeEventListener("rh_chat_cta_clicked", onCtaClick as EventListener)
    }
  }, [context.crm_channel, context.crm_conversation_id])

  if (!LIVECHAT_BASE_URL) {
    return null
  }

  return <LiveChatPresenceIndicator />
}
