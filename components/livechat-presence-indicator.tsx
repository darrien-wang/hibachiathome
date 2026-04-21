"use client"

import { BellRing, MessageCircleMore, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type LiveChatPresenceIndicatorProps = {
  unreadCount: number
  previewText?: string | null
  onOpenChat: () => void
  onDismiss?: () => void
}

export function LiveChatPresenceIndicator({
  unreadCount,
  previewText = null,
  onOpenChat,
  onDismiss,
}: LiveChatPresenceIndicatorProps) {
  if (unreadCount <= 0) {
    return null
  }

  const unreadLabel = unreadCount === 1 ? "1 unread reply" : `${unreadCount} unread replies`
  const unreadHint =
    unreadCount === 1
      ? "Support sent you a new message. Open chat to review it."
      : "Support sent multiple new messages. Open chat to review them."

  return (
    <div className="fixed inset-0 z-[2147482990] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Dismiss new support reply reminder"
        className="absolute inset-0 bg-slate-950/24 backdrop-blur-[2px]"
        onClick={onDismiss}
      />
      <div className="relative w-full max-w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-[28px] border border-amber-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]">
        <div className="bg-[linear-gradient(135deg,#0f172a,#166534)] px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-white"
                aria-hidden="true"
              >
                <BellRing className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">New Support Reply</p>
                <p className="mt-1 text-base font-semibold">{unreadLabel}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-white/80 hover:bg-white/10 hover:text-white"
              onClick={onDismiss}
              aria-label="Dismiss support reply reminder"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">{unreadHint}</p>
            {previewText ? (
              <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{previewText}</p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={onDismiss}
            >
              Later
            </Button>
            <Button
              type="button"
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={onOpenChat}
            >
              <MessageCircleMore className="mr-2 h-4 w-4" />
              View reply
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
