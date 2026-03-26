"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BellRing, PhoneCall } from "lucide-react"
import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"
import { trackEvent } from "@/lib/tracking"

type PresencePayload = {
  online: boolean
  agentName?: string | null
  source?: string
  checkedAt?: string
}

type PresenceState = {
  loading: boolean
  online: boolean
  agentName: string | null
  checkedAt: string | null
}

const PRESENCE_REFRESH_INTERVAL_MS = 20_000

function normalizePhoneHref(raw: string | null | undefined): string {
  const fallback = "12137707788"
  const digits = String(raw ?? fallback).replace(/[^\d+]/g, "")
  return `tel:${digits || fallback}`
}

export function LiveChatPresenceIndicator() {
  const [presence, setPresence] = useState<PresenceState>({
    loading: true,
    online: false,
    agentName: null,
    checkedAt: null,
  })

  const previewStatus = useMemo(() => {
    if (typeof window === "undefined") return null
    const raw = new URLSearchParams(window.location.search).get("livechat_preview_status")
    const normalized = raw?.trim().toLowerCase()
    return normalized === "online" || normalized === "offline" ? normalized : null
  }, [])
  const previewAgentName = useMemo(() => {
    if (typeof window === "undefined") return null
    const raw = new URLSearchParams(window.location.search).get("livechat_preview_agent")
    const trimmed = raw?.trim()
    return trimmed ? trimmed : null
  }, [])
  const callPhoneHref = useMemo(() => normalizePhoneHref(siteConfig.contact.phone), [])

  const refreshPresence = useCallback(async () => {
    try {
      const query = new URLSearchParams()
      if (previewStatus) query.set("preview", previewStatus)
      if (previewAgentName) query.set("preview_agent", previewAgentName)
      const response = await fetch(`/api/livechat/presence${query.size > 0 ? `?${query.toString()}` : ""}`, {
        method: "GET",
        cache: "no-store",
      })
      if (!response.ok) {
        throw new Error(`presence request failed (${response.status})`)
      }

      const payload = (await response.json()) as PresencePayload
      setPresence({
        loading: false,
        online: Boolean(payload.online),
        agentName: payload.agentName?.trim() || null,
        checkedAt: payload.checkedAt ?? new Date().toISOString(),
      })
    } catch {
      setPresence((previous) => ({
        loading: false,
        online: false,
        agentName: previous.agentName,
        checkedAt: new Date().toISOString(),
      }))
    }
  }, [previewAgentName, previewStatus])

  useEffect(() => {
    void refreshPresence()
    const timer = window.setInterval(() => {
      void refreshPresence()
    }, PRESENCE_REFRESH_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [refreshPresence])

  const statusLabel = presence.loading
    ? "Checking availability..."
    : presence.online
      ? `${presence.agentName ?? "Coordinator"} is online`
      : "No agent logged in"

  const statusHint = presence.online
    ? "Live support is active. Tap to start chat."
    : "Call us and we can arrange a callback right away."

  return (
    <div className="fixed bottom-24 right-4 z-[2147482990] w-[280px] max-w-[calc(100vw-1.5rem)]">
      <div className="rounded-2xl border border-amber-200 bg-white/95 p-3.5 shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              presence.online ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
            aria-hidden="true"
          >
            <BellRing className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Live Chat Desk</p>
            <p className={`mt-0.5 text-sm font-semibold ${presence.online ? "text-emerald-700" : "text-slate-900"}`}>
              {statusLabel}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{statusHint}</p>
          </div>
        </div>

        <div className="mt-3">
          {presence.online ? (
            <Button
              className="h-9 w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => window.RealHibachiLiveChat?.open?.("presence_online")}
            >
              Start Live Chat
            </Button>
          ) : (
            <Button
              asChild
              className="h-9 w-full rounded-full bg-amber-600 text-white hover:bg-amber-700"
            >
              <a
                href={callPhoneHref}
                onClick={() =>
                  trackEvent("contact_call_click", {
                    contact_surface: "livechat_presence_offline",
                    contact_action: "ring_bell_call",
                  })
                }
              >
                <PhoneCall className="mr-2 h-4 w-4" />
                Ring Customer Service
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
