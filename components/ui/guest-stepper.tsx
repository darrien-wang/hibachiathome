"use client"

import { useEffect, useRef, useState } from "react"
import { Minus, Plus } from "lucide-react"

/**
 * Guest count as a stepper: − [n] +, 44px targets, no keyboard.
 *
 * Why this exists next to GuestCountInput: on the ad landing pages the
 * 2026-09-07 Clarity tapes showed the phone keyboard covering the quote CTA
 * the moment someone tapped a number box. A stepper changes the count with a
 * thumb and never opens the keyboard. The number itself is still tappable for
 * people who want to type (e.g. 40) — that reveals a numeric field, commits on
 * blur, and goes back to the stepper.
 */
export default function GuestStepper({
  value,
  onValueChange,
  min = 0,
  max = 200,
  step = 1,
  label,
  className,
  id,
  "data-quote-field": dataQuoteField,
}: {
  value: number
  onValueChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  /** Accessible name for the group, e.g. "Number of adults". */
  label: string
  className?: string
  id?: string
  "data-quote-field"?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const clamp = (n: number) => Math.min(Math.max(Number.isFinite(n) ? n : min, min), max)
  const set = (n: number) => onValueChange(clamp(n))

  const commitDraft = () => {
    const digits = draft.replace(/\D/g, "").slice(0, 4)
    if (digits !== "") set(Number(digits))
    setEditing(false)
  }

  const btn =
    "flex h-11 w-11 shrink-0 items-center justify-center text-gray-800 transition active:bg-gray-200 disabled:opacity-35 disabled:active:bg-transparent"

  return (
    <div
      role="group"
      aria-label={label}
      id={id}
      data-quote-field={dataQuoteField}
      className={`flex h-11 items-center overflow-hidden rounded-xl border border-gray-200 bg-white ${className ?? ""}`}
    >
      <button
        type="button"
        aria-label={`Fewer: ${label}`}
        onClick={() => set(value - step)}
        disabled={value <= min}
        className={`${btn} border-r border-gray-200 bg-gray-50`}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-label={label}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitDraft()
            if (e.key === "Escape") setEditing(false)
          }}
          className="h-full min-w-0 flex-1 bg-white text-center text-lg font-bold text-gray-900 outline-none"
        />
      ) : (
        <button
          type="button"
          aria-label={`${label}: ${value}. Tap to type a number`}
          onClick={() => {
            setDraft(String(value))
            setEditing(true)
          }}
          // Underlined so it reads as editable: the 09-08 tapes caught someone
          // tapping "+" twelve times rather than typing the number.
          className="h-full min-w-0 flex-1 bg-white text-center text-lg font-bold tabular-nums text-gray-900 underline decoration-dotted decoration-gray-300 underline-offset-4"
        >
          {value}
        </button>
      )}
      <button
        type="button"
        aria-label={`More: ${label}`}
        onClick={() => set(value + step)}
        disabled={value >= max}
        className={`${btn} border-l border-gray-200 bg-gray-50`}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
