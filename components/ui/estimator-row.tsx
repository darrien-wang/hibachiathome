"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Minus, Plus } from "lucide-react"

/**
 * One guest-count row for the landing / occasion / menu estimators:
 * label on the left, then − [n] +.
 *
 * The number is a real field, not text. On 2026-09-08 Clarity caught a paid
 * visitor rage-clicking the "Adults · kids 5–12 half" label and another
 * tapping "+" twelve times in a row: with a plain <span> the only way to say
 * "40 guests" is to hammer the plus button. Now the number looks like an
 * input, tapping it (or the label) opens a numeric keypad, and it commits on
 * blur or Enter.
 */
export default function EstimatorRow({
  label,
  sub,
  value,
  onValueChange,
  min = 0,
  max = 200,
  "data-quote-field": dataQuoteField,
}: {
  label: string
  sub: string
  value: number
  onValueChange: (next: number) => void
  min?: number
  max?: number
  "data-quote-field"?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const id = useId()

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const set = (n: number) => onValueChange(Math.min(Math.max(Number.isFinite(n) ? n : min, min), max))
  const startEditing = () => {
    setDraft(String(value))
    setEditing(true)
  }
  const commit = () => {
    const digits = draft.replace(/\D/g, "").slice(0, 4)
    if (digits !== "") set(Number(digits))
    setEditing(false)
  }

  const step = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition disabled:opacity-35"
  const numberBox =
    "h-11 w-[52px] shrink-0 rounded-xl border border-ink/15 bg-cream text-center font-serif text-[22px] font-extrabold tabular-nums text-ink"

  return (
    <div className="flex items-center gap-2">
      {/* Tapping the label opens the field — that is where the rage clicks landed. */}
      <button type="button" onClick={startEditing} className="min-w-0 flex-1 text-left" aria-controls={id}>
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="block text-xs text-clay-600">{sub}</span>
      </button>
      <button
        type="button"
        aria-label={`Fewer ${label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => set(value - 1)}
        className={`${step} border border-ink/15`}
      >
        <Minus className="h-4 w-4" />
      </button>
      {editing ? (
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-label={label}
          data-quote-field={dataQuoteField}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") setEditing(false)
          }}
          className={`${numberBox} border-flame outline-none`}
        />
      ) : (
        <button
          type="button"
          id={id}
          aria-label={`${label}: ${value}. Tap to type a number`}
          data-quote-field={dataQuoteField}
          onClick={startEditing}
          className={numberBox}
        >
          {value}
        </button>
      )}
      <button
        type="button"
        aria-label={`More ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => set(value + 1)}
        className={`${step} bg-flame text-white`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
