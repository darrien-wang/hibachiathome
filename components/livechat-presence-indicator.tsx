"use client"

import { BellRing, MessageCircleMore } from "lucide-react"
import { Button } from "@/components/ui/button"

type LiveChatPresenceIndicatorProps = {
  unreadCount: number
  onOpenChat: () => void
}

export function LiveChatPresenceIndicator({ unreadCount, onOpenChat }: LiveChatPresenceIndicatorProps) {
  if (unreadCount <= 0) {
    return null
  }

  const unreadLabel = unreadCount === 1 ? "1 unread reply" : `${unreadCount} unread replies`
  const unreadHint =
    unreadCount === 1
      ? "Support sent you a new message. Open chat to review it."
      : "Support sent multiple new messages. Open chat to review them."

  return (
    <div className="fixed bottom-24 right-4 z-[2147482990] w-[min(20rem,calc(100vw-1.5rem))]">
      <div className="rounded-2xl border border-amber-200 bg-white/95 px-3.5 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="flex items-center gap-3">
          <div
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
            aria-hidden="true"
          >
            <BellRing className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">New Support Reply</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{unreadLabel}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{unreadHint}</p>
          </div>
          <Button
            type="button"
            className="h-10 shrink-0 rounded-full bg-emerald-600 px-4 text-white hover:bg-emerald-700"
            onClick={onOpenChat}
          >
            <MessageCircleMore className="mr-2 h-4 w-4" />
            Open
          </Button>
        </div>
      </div>
    </div>
  )
}
