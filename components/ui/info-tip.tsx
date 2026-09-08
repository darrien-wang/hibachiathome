"use client"

import { useEffect, useId, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { HelpCircle, X } from "lucide-react"

/**
 * A small "?" that opens a short explanation. Keeps the page itself down to
 * the essentials (price, date, CTA) and parks the fine print behind a tap.
 *
 * The panel is portaled to <body> as a bottom sheet (centered card on wider
 * screens): an absolutely-positioned bubble got clipped by the /quote hero's
 * overflow-hidden and by backdrop-blur containing blocks on 2026-09-07.
 */
export default function InfoTip({
  label,
  title,
  children,
  className,
  iconClassName,
}: {
  /** Accessible name for the trigger, e.g. "What's included?" */
  label: string
  title?: string
  children: ReactNode
  className?: string
  iconClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <span className={`inline-flex ${className ?? ""}`}>
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
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[120]" role="presentation">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute inset-0 h-full w-full cursor-default bg-black/35"
              />
              <div
                id={id}
                role="dialog"
                aria-modal="true"
                aria-label={title ?? label}
                className="absolute inset-x-3 bottom-3 rounded-2xl bg-white p-4 text-left text-[14px] leading-6 text-gray-700 shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[22rem] sm:-translate-x-1/2 sm:-translate-y-1/2"
              >
                <div className="flex items-start justify-between gap-2">
                  {title ? <p className="text-base font-semibold text-gray-900">{title}</p> : <span />}
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                    className="-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-2">{children}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </span>
  )
}
