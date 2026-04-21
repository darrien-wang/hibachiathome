"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { MessageCircle, RefreshCw, Send, UserRound, X } from "lucide-react"
import { LiveChatPresenceIndicator } from "@/components/livechat-presence-indicator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { trackEvent } from "@/lib/tracking"
import { cn } from "@/lib/utils"

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

type LivechatSession = {
  id: string
  status: string
  assignedAdmin: string | null
  visitorName: string | null
  visitorEmail: string | null
  visitorPhone: string | null
  latestMessagePreview: string | null
  unreadForVisitorCount: number
  lastMessageAt: string | null
}

type LivechatMessage = {
  id: string
  senderRole: "visitor" | "admin" | "system"
  senderName: string | null
  body: string
  contentType: string
  createdAt: string
}

type SessionResponse = {
  ok: boolean
  error?: string
  session: LivechatSession | null
  messages: LivechatMessage[]
}

type QuickQuestion = {
  id: string
  label: string
  text: string
}

declare global {
  interface Window {
    RealHibachiLiveChat?: {
      setContext?: (context: Record<string, string>) => void
      open?: (reason?: string) => void
    }
  }
}

const STORAGE_KEY_SESSION = "rh_livechat_session_id"
const STORAGE_KEY_NAME = "rh_livechat_visitor_name"
const STORAGE_KEY_EMAIL = "rh_livechat_visitor_email"
const STORAGE_KEY_PHONE = "rh_livechat_visitor_phone"
const FALLBACK_REFRESH_MS = 30_000
const TITLE_FLASH_MS = 1200
const NOTIFICATION_REQUESTED_KEY = "rh_livechat_notifications_requested"
const LAST_ALERTED_ADMIN_REPLY_KEY = "rh_livechat_last_alerted_admin_reply"
const COMMON_QUESTION_CHIPS: QuickQuestion[] = [
  {
    id: "faq-estimate",
    label: "Can I get an estimate?",
    text: "Can I get an estimate?",
  },
  {
    id: "faq-pricing",
    label: "How much does it cost?",
    text: "How much does it cost?",
  },
  {
    id: "faq-steps",
    label: "What are the steps to book?",
    text: "What are the steps to book?",
  },
  {
    id: "faq-menu",
    label: "What proteins are available?",
    text: "What proteins are available?",
  },
  {
    id: "faq-setup",
    label: "Do you provide table/chairs?",
    text: "Do you provide table and chairs setup?",
  },
]

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

function statusLabel(status: string | null | undefined) {
  if (!status) {
    return "Ready to chat"
  }

  switch (status) {
    case "waiting_admin":
      return "Waiting for support"
    case "waiting_visitor":
      return "Support replied"
    case "closed":
      return "Conversation closed"
    case "spam":
      return "Unavailable"
    default:
      return "Open"
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function emitChatEvent(name: string, detail: ChatEventDetail) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

function clearStoredLivechatSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY_SESSION)
}

function requestBrowserNotificationPermissionOnce() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return () => undefined
  }

  if (window.sessionStorage.getItem(NOTIFICATION_REQUESTED_KEY) === "1") {
    return () => undefined
  }

  const requestPermission = () => {
    window.sessionStorage.setItem(NOTIFICATION_REQUESTED_KEY, "1")
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => undefined)
    }
  }

  window.addEventListener("pointerdown", requestPermission, { once: true })
  window.addEventListener("keydown", requestPermission, { once: true })

  return () => {
    window.removeEventListener("pointerdown", requestPermission)
    window.removeEventListener("keydown", requestPermission)
  }
}

function getTrackingBase(context: Record<string, string>) {
  return {
    chat_path: context.path ?? window.location.pathname,
    chat_intent: context.intent ?? getIntent(window.location.pathname),
    chat_page_group: context.page_group ?? getPageGroup(window.location.pathname),
    chat_crm_channel: context.crm_channel,
    chat_crm_conversation_id: context.crm_conversation_id,
    chat_crm_handoff: Boolean(context.crm_conversation_id),
  }
}

function MarketingLiveChatWidget({ context }: { context: ChatContext }) {
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [contextOverride, setContextOverride] = useState<Record<string, string>>({})
  const [openReason, setOpenReason] = useState("manual")
  const [profileExpanded, setProfileExpanded] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [session, setSession] = useState<LivechatSession | null>(null)
  const [messages, setMessages] = useState<LivechatMessage[]>([])
  const [visitorName, setVisitorName] = useState("")
  const [visitorEmail, setVisitorEmail] = useState("")
  const [visitorPhone, setVisitorPhone] = useState("")
  const [messageDraft, setMessageDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const promptTrackedRef = useRef(false)
  const lastReadAckRef = useRef<string | null>(null)
  const previousSessionRef = useRef<LivechatSession | null>(null)
  const sessionInitializedRef = useRef(false)
  const initialTitleRef = useRef<string | null>(null)

  const mergedContext = useMemo(() => ({
    ...compactStringRecord(context),
    ...contextOverride,
  }), [context, contextOverride])
  const isProfileComplete = useMemo(
    () => Boolean(visitorName.trim() && visitorEmail.trim() && visitorPhone.trim()),
    [visitorEmail, visitorName, visitorPhone],
  )
  const showProfileForm = profileExpanded || !isProfileComplete
  const applyPayload = useCallback((payload: SessionResponse) => {
    setSession(payload.session)
    setMessages(payload.messages)

    if (payload.session?.id) {
      setSessionId(payload.session.id)
      window.localStorage.setItem(STORAGE_KEY_SESSION, payload.session.id)
    }

    if (payload.session?.visitorName && !visitorName) {
      setVisitorName(payload.session.visitorName)
      window.localStorage.setItem(STORAGE_KEY_NAME, payload.session.visitorName)
    }
    if (payload.session?.visitorEmail && !visitorEmail) {
      setVisitorEmail(payload.session.visitorEmail)
      window.localStorage.setItem(STORAGE_KEY_EMAIL, payload.session.visitorEmail)
    }
    if (payload.session?.visitorPhone && !visitorPhone) {
      setVisitorPhone(payload.session.visitorPhone)
      window.localStorage.setItem(STORAGE_KEY_PHONE, payload.session.visitorPhone)
    }
  }, [visitorEmail, visitorName, visitorPhone])

  const ensureVisitorCookie = useCallback(async (restart = false, strict = false) => {
    try {
      const response = await fetch("/api/livechat/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(
          restart
            ? {
                restart: true,
              }
            : {},
        ),
      })

      if (strict && !response.ok) {
        throw new Error("Failed to initialize a new livechat visitor session.")
      }
    } catch {
      if (strict) {
        throw new Error("Failed to initialize a new livechat visitor session.")
      }
      // Ignore cookie bootstrap failures. Message send will retry.
    }
  }, [])

  const loadSession = useCallback(async (targetSessionId?: string | null, silent = false) => {
    const resolvedSessionId = targetSessionId ?? sessionId
    const query = resolvedSessionId ? `?sessionId=${encodeURIComponent(resolvedSessionId)}` : ""

    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const response = await fetch(`/api/livechat/session${query}`, { cache: "no-store" })
      const payload = (await response.json()) as SessionResponse
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to load support chat.")
      }
      applyPayload(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load support chat.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [applyPayload, sessionId])

  const markSessionAsRead = useCallback(async (targetSessionId?: string | null) => {
    const resolvedSessionId = targetSessionId ?? sessionId
    if (!resolvedSessionId) {
      return
    }

    try {
      const response = await fetch("/api/livechat/session/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: resolvedSessionId,
        }),
      })

      const payload = (await response.json()) as SessionResponse
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to mark support chat as read.")
      }

      applyPayload(payload)
    } catch {
      // Keep the current unread state if the acknowledgement fails.
    }
  }, [applyPayload, sessionId])

  const openWidget = useCallback((reason = "manual") => {
    setOpenReason(reason)
    setOpen(true)

    const detail: ChatEventDetail = {
      reason,
      surface: reason === "unread_reply" ? "unread_popup" : "launcher",
      session_id: sessionId ?? undefined,
    }
    emitChatEvent("rh_chat_opened", detail)
    trackEvent("chat_widget_opened", {
      ...getTrackingBase(mergedContext),
      chat_reason: detail.reason ?? "manual",
      chat_surface: detail.surface ?? "launcher",
      chat_session_id: detail.session_id,
    })
  }, [mergedContext, sessionId])

  useEffect(() => {
    setHydrated(true)

    const storedSessionId = window.localStorage.getItem(STORAGE_KEY_SESSION)
    const storedName = window.localStorage.getItem(STORAGE_KEY_NAME)
    const storedEmail = window.localStorage.getItem(STORAGE_KEY_EMAIL)
    const storedPhone = window.localStorage.getItem(STORAGE_KEY_PHONE)

    if (storedSessionId) setSessionId(storedSessionId)
    if (storedName) setVisitorName(storedName)
    if (storedEmail) setVisitorEmail(storedEmail)
    if (storedPhone) setVisitorPhone(storedPhone)

    void ensureVisitorCookie()
  }, [ensureVisitorCookie])

  useEffect(() => requestBrowserNotificationPermissionOnce(), [])

  useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    if (!initialTitleRef.current) {
      initialTitleRef.current = document.title
    }

    const originalTitle = initialTitleRef.current
    if (!originalTitle) {
      return
    }

    const unreadCount = open ? 0 : session?.unreadForVisitorCount ?? 0
    if (unreadCount <= 0) {
      document.title = originalTitle
      return
    }

    const alertTitle = unreadCount === 1 ? "(1) Support replied - RealHibachi" : `(${unreadCount}) Support replied - RealHibachi`
    let showAlert = false
    document.title = alertTitle

    const timer = window.setInterval(() => {
      showAlert = !showAlert
      document.title = showAlert ? alertTitle : originalTitle
    }, TITLE_FLASH_MS)

    return () => {
      window.clearInterval(timer)
      document.title = originalTitle
    }
  }, [open, session])

  useEffect(() => {
    window.RealHibachiLiveChat = {
      open: (reason?: string) => openWidget(reason ?? "manual"),
      setContext: (nextContext: Record<string, string>) => {
        setContextOverride((previous) => ({
          ...previous,
          ...compactStringRecord(nextContext),
        }))
      },
    }

    return () => {
      delete window.RealHibachiLiveChat
    }
  }, [openWidget])

  useEffect(() => {
    if (!hydrated || !sessionId) return
    void loadSession(sessionId, true)
  }, [hydrated, loadSession, sessionId])

  useEffect(() => {
    if (!open || !hydrated) return
    void loadSession(sessionId)
  }, [open, hydrated, loadSession, sessionId])

  useEffect(() => {
    if (!open || promptTrackedRef.current) return
    promptTrackedRef.current = true

    const detail: ChatEventDetail = {
      reason: openReason,
      surface: "widget_panel",
      prompt_key: "common_questions",
      session_id: sessionId ?? undefined,
    }
    emitChatEvent("rh_chat_prompt_shown", detail)
    trackEvent("chat_prompt_shown", {
      ...getTrackingBase(mergedContext),
      chat_prompt_key: detail.prompt_key ?? "common_questions",
      chat_surface: detail.surface ?? "widget_panel",
      chat_session_id: detail.session_id,
    })
  }, [mergedContext, open, openReason, sessionId])

  useEffect(() => {
    if (!hydrated || !sessionId) return

    const realtimeUrl = new URL("/api/livechat/realtime", window.location.origin)
    realtimeUrl.searchParams.set("sessionId", sessionId)

    const eventSource = new EventSource(realtimeUrl.toString())
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string }
        if (payload.type === "heartbeat" || payload.type === "status") {
          return
        }
        void loadSession(sessionId, true)
      } catch {
        // Ignore invalid stream payloads.
      }
    }

    fallbackTimerRef.current = setInterval(() => {
      if (document.visibilityState === "hidden") {
        return
      }
      void loadSession(sessionId, true)
    }, FALLBACK_REFRESH_MS)

    return () => {
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [hydrated, loadSession, sessionId])

  useEffect(() => {
    if (!session) {
      previousSessionRef.current = session
      return
    }

    if (!sessionInitializedRef.current) {
      sessionInitializedRef.current = true
      previousSessionRef.current = session
      return
    }

    const previousSession = previousSessionRef.current
    previousSessionRef.current = session

    const unreadCount = open ? 0 : session.unreadForVisitorCount
    const hasNewAdminReply = Boolean(
      !open &&
        session.latestMessageSenderRole === "admin" &&
        unreadCount > 0 &&
        session.lastAdminMessageAt &&
        session.lastAdminMessageAt !== previousSession?.lastAdminMessageAt,
    )

    if (!hasNewAdminReply) {
      return
    }

    const alertKey = `${session.id}:${session.lastAdminMessageAt}`
    if (window.sessionStorage.getItem(LAST_ALERTED_ADMIN_REPLY_KEY) === alertKey) {
      return
    }

    window.sessionStorage.setItem(LAST_ALERTED_ADMIN_REPLY_KEY, alertKey)

    if ("Notification" in window && document.visibilityState === "hidden" && Notification.permission === "granted") {
      const notification = new Notification("Real Hibachi support replied", {
        body: session.latestMessagePreview || "Open the support chat to review the reply.",
        tag: `marketing-livechat-${session.id}`,
        renotify: true,
      })

      notification.onclick = () => {
        window.focus()
        openWidget("unread_reply")
        notification.close()
      }
    }
  }, [open, session, openWidget])

  useEffect(() => {
    if (!open || !sessionId || !session || session.unreadForVisitorCount <= 0) {
      return
    }

    const readAckKey = `${sessionId}:${session.lastMessageAt ?? "none"}:${session.unreadForVisitorCount}`
    if (lastReadAckRef.current === readAckKey) {
      return
    }

    lastReadAckRef.current = readAckKey
    void markSessionAsRead(sessionId)
  }, [markSessionAsRead, open, session, sessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, open])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY_NAME, visitorName)
  }, [hydrated, visitorName])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY_EMAIL, visitorEmail)
  }, [hydrated, visitorEmail])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY_PHONE, visitorPhone)
  }, [hydrated, visitorPhone])

  useEffect(() => {
    if (!hydrated) return
    if (isProfileComplete) {
      setProfileExpanded(false)
    }
  }, [hydrated, isProfileComplete])

  const handleSend = useCallback(async (messageOverride?: string) => {
    const trimmedMessage = (messageOverride ?? messageDraft).trim()
    if (!trimmedMessage) {
      setError("Please enter a message.")
      return false
    }
    if (!visitorName.trim()) {
      setError("Please tell us your name so support knows who this is.")
      return false
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/livechat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          visitorName: visitorName.trim(),
          visitorEmail: visitorEmail.trim(),
          visitorPhone: visitorPhone.trim(),
          message: trimmedMessage,
          initialPageUrl: window.location.href,
          source: "marketing_page",
          contextMetadata: mergedContext,
        }),
      })

      const payload = (await response.json()) as SessionResponse
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to send message.")
      }

      applyPayload(payload)
      setMessageDraft("")

      const trackedSessionId = payload.session?.id ?? sessionId ?? undefined
      const detail: ChatEventDetail = {
        message_length: trimmedMessage.length,
        has_email: Boolean(visitorEmail.trim()),
        has_phone: Boolean(visitorPhone.trim()),
        session_id: trackedSessionId,
      }
      emitChatEvent("rh_chat_message_sent", detail)
      trackEvent("chat_message_sent", {
        ...getTrackingBase(mergedContext),
        chat_message_length: trimmedMessage.length,
        chat_session_id: trackedSessionId,
      })

      if (visitorEmail.trim() || visitorPhone.trim()) {
        emitChatEvent("rh_chat_lead_submitted", detail)
        trackEvent("chat_lead_submitted", {
          ...getTrackingBase(mergedContext),
          chat_has_email: Boolean(visitorEmail.trim()),
          chat_has_phone: Boolean(visitorPhone.trim()),
          chat_session_id: trackedSessionId,
        })
        trackEvent("lead_submit", {
          lead_channel: "live_chat",
          lead_source: "live_chat_widget",
          quote_surface: mergedContext.page_group ?? getPageGroup(window.location.pathname),
        })
      }

      return true
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send message.")
      return false
    } finally {
      setLoading(false)
    }
  }, [applyPayload, mergedContext, messageDraft, sessionId, visitorEmail, visitorName, visitorPhone])

  const handleRestartConversation = useCallback(async () => {
    setLoading(true)
    setRefreshing(false)
    setError(null)

    try {
      await ensureVisitorCookie(true, true)

      clearStoredLivechatSession()
      setSessionId(null)
      setSession(null)
      setMessages([])
      setMessageDraft("")
      lastReadAckRef.current = null
      previousSessionRef.current = null
      sessionInitializedRef.current = false

      const detail: ChatEventDetail = {
        reason: "visitor_restart",
      }
      emitChatEvent("rh_chat_restarted", detail)
      trackEvent("chat_restarted", {
        ...getTrackingBase(mergedContext),
        chat_reason: "visitor_restart",
      })
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : "Failed to start a new conversation.")
    } finally {
      setLoading(false)
    }
  }, [ensureVisitorCookie, mergedContext])

  const handleQuickQuestion = useCallback(async (chip: QuickQuestion) => {
    const detail: ChatEventDetail = {
      cta: chip.id,
      session_id: sessionId ?? undefined,
    }
    emitChatEvent("rh_chat_cta_clicked", detail)
    trackEvent("chat_cta_clicked", {
      ...getTrackingBase(mergedContext),
      chat_cta: chip.id,
      chat_session_id: detail.session_id,
    })

    if (!visitorName.trim()) {
      setOpen(true)
      setMessageDraft(chip.text)
      setError("Enter your name first, then send the quick question.")
      return
    }

    void handleSend(chip.text)
  }, [handleSend, mergedContext, sessionId, visitorName])

  if (!hydrated) {
    return null
  }

  return (
    <>
      <LiveChatPresenceIndicator
        unreadCount={open ? 0 : session?.unreadForVisitorCount ?? 0}
        onOpenChat={() => openWidget("unread_reply")}
      />
      {open ? (
        <div
          id="rh-livechat-panel"
          className="pointer-events-auto fixed bottom-24 right-4 z-[2147483000] flex h-[min(42rem,calc(100vh-8rem))] w-[min(94vw,25rem)] flex-col overflow-hidden rounded-[28px] border border-amber-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
        >
          <div className="flex items-start justify-between gap-3 bg-[linear-gradient(135deg,#111827,#c2410c)] px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Real Hibachi Support</p>
              <p className="text-xs text-amber-100">Ask about pricing, menu, quote steps, or booking details.</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-label={showProfileForm ? "Hide profile editor" : "Edit profile"}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/90 transition hover:bg-white/15 hover:text-white"
                onClick={() => setProfileExpanded((current) => !current)}
              >
                <UserRound className="h-3.5 w-3.5" />
                <span>Profile</span>
              </button>
              <button
                type="button"
                aria-label="Close support chat"
                className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-amber-100 bg-amber-50/70 px-4 py-3">
            <div className="grid gap-2">
              {showProfileForm ? (
                <>
                  <Input
                    aria-label="Visitor name"
                    placeholder="Your name"
                    value={visitorName}
                    onChange={(event) => setVisitorName(event.target.value)}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      aria-label="Visitor email"
                      placeholder="Email"
                      value={visitorEmail}
                      onChange={(event) => setVisitorEmail(event.target.value)}
                    />
                    <Input
                      aria-label="Visitor phone"
                      placeholder="Phone"
                      value={visitorPhone}
                      onChange={(event) => setVisitorPhone(event.target.value)}
                    />
                  </div>
                </>
              ) : null}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{statusLabel(session?.status)}</span>
                <div className="flex items-center gap-3">
                  {session ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-slate-500 transition hover:text-slate-900"
                      onClick={() => void handleRestartConversation()}
                      disabled={loading}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", loading ? "animate-spin" : "")} />
                      Start new chat
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-slate-500 transition hover:text-slate-900"
                    onClick={() => void loadSession(sessionId, true)}
                    disabled={refreshing || loading}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshing ? "animate-spin" : "")} />
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-[12rem] flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fffaf0,#ffffff)] px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-dashed border-amber-200 bg-white/90 px-4 py-5 text-sm text-slate-600">
                  Start with a common question below, or type your own message. The admin desk will receive it in the shared Supabase inbox.
                </div>
                <div className="flex flex-wrap gap-2">
                  {COMMON_QUESTION_CHIPS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-300 hover:bg-amber-50"
                      onClick={() => void handleQuickQuestion(chip)}
                      disabled={loading}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  const fromVisitor = message.senderRole === "visitor"
                  return (
                    <div key={message.id} className={cn("flex", fromVisitor ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                          fromVisitor ? "bg-slate-900 text-white" : "border border-amber-200 bg-white text-slate-900",
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] opacity-70">
                          <span>{fromVisitor ? "You" : message.senderName || "Support"}</span>
                          <span className="normal-case tracking-normal">{formatTime(message.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-5">{message.body}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-amber-100 bg-white px-4 py-3">
            <div className="grid gap-2">
              <Textarea
                aria-label="Support message"
                placeholder="Ask about pricing, deposit, menu, or booking timing..."
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                className="min-h-24 resize-none"
              />
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>{session?.assignedAdmin ? `Owner: ${session.assignedAdmin}` : "No admin assigned yet"}</span>
                <Button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={loading}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  <Send className="h-4 w-4" />
                  {loading ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div id="rh-livechat-widget-root" className="pointer-events-none fixed bottom-5 right-4 z-[2147483000]">
        <Button
          type="button"
          aria-label="Open support chat"
          aria-controls="rh-livechat-panel"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openWidget("manual"))}
          className="pointer-events-auto relative h-14 rounded-full bg-slate-950 px-5 text-white shadow-xl hover:bg-slate-800"
        >
          <MessageCircle className="h-5 w-5" />
          Chat with support
          {!open && (session?.unreadForVisitorCount ?? 0) > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-600 px-1.5 text-[11px] font-semibold leading-none text-white shadow-lg">
              {Math.min(session?.unreadForVisitorCount ?? 0, 9)}
            </span>
          ) : null}
        </Button>
      </div>
    </>
  )
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
    const crmChannel = optionalParam(searchParams, "crm_channel") ?? optionalParam(searchParams, "crmChannel")
    const crmContactId = optionalParam(searchParams, "crm_contact_id") ?? optionalParam(searchParams, "crmContactId")
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

  return <MarketingLiveChatWidget context={context} />
}
