"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { HelpCircle, X } from "lucide-react"

/**
 * A small "?" that opens a short explanation. Keeps the page itself down to
 * the essentials (price, date, CTA) and parks the fine print behind a tap.
 * 44px hit area, closes on outside tap / Escape, no layout shift while closed.
 */
export default function InfoTip({
  label,
  title,
  children,
  className,
  iconClassName,
  align = "right",
}: {
  /** Accessible name for the trigger, e.g. "What's included?" */
  label: string
  title?: string
  children: ReactNode
  className?: string
  iconClassName?: string
  align?: "left" | "right"
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <span ref={rootRef} className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={`-m-2.5 inline-flex h-11 w-11 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${iconClassName ?? "text-gray-500 hover:text-gray-800"}`}
      >
        <HelpCircle className="h-5 w-5" aria-hidden="true" />
      </button>
      {open ? (
        <span
          id={id}
          role="dialog"
          aria-label={title ?? label}
          className={`absolute top-8 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-amber-200 bg-white p-3 text-left text-[13px] leading-5 text-gray-700 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <span className="flex items-start justify-between gap-2">
            {title ? <span className="font-semibold text-gray-900">{title}</span> : <span />}
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="-m-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-gray-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
          <span className="mt-1 block">{children}</span>
        </span>
      ) : null}
    </span>
  )
}
