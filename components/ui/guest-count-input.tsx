"use client"

import { useEffect, useRef, useState } from "react"

import { Input } from "@/components/ui/input"

/**
 * Select the whole value once the browser has finished placing the caret.
 *
 * setTimeout rather than requestAnimationFrame: rAF is paused while the page
 * is hidden, so a field focused just before the tab went to the background
 * would not get selected until the customer came back.
 */
function selectAll(el: HTMLInputElement) {
  setTimeout(() => {
    // The customer may have moved on before this ran.
    if (document.activeElement === el) el.select()
  }, 0)
}

/**
 * Guest-count field for the quote calculators.
 *
 * `<input type="number">` bound straight to a number is the wrong tool here,
 * and it produced a real bug: backspacing to clear the field fires onChange
 * with "", `Number("")` is 0, the 0 is written straight back into the box with
 * the caret after it, and the next keystrokes read "012". The customer has to
 * notice and fix it on the page where we quote them a price.
 *
 * So: keep a string draft while the field has focus, so it can legitimately be
 * empty mid-edit, and only normalise on blur. The input is `text` with a
 * numeric keypad rather than `type="number"` — that hands us the raw string
 * instead of the browser's own normalisation, and drops the desktop spinners
 * and scroll-wheel-changes-the-count hazard along the way.
 *
 * Focus also selects the contents, because every one of these fields ships
 * with a sensible default that most people need to replace.
 */
export default function GuestCountInput({
  value,
  onValueChange,
  min = 0,
  max = 200,
  className,
  ...rest
}: {
  value: number
  onValueChange: (next: number) => void
  min?: number
  max?: number
  className?: string
  id?: string
  "aria-label"?: string
  "data-quote-field"?: string
}) {
  // null = "show the committed value"; a string = the customer is mid-edit.
  const [draft, setDraft] = useState<string | null>(null)
  const focused = useRef(false)

  // A change from outside (a preset, a reset, a URL prefill) has to win over a
  // stale draft, but only while the customer is not typing into the field.
  useEffect(() => {
    if (!focused.current) setDraft(null)
  }, [value])

  const commit = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 4)
    // Strip leading zeros so "012" can never form, but keep a lone "0".
    const trimmed = digits.replace(/^0+(?=\d)/, "")
    setDraft(trimmed)
    if (trimmed === "") return // let the box stay empty; commit on blur
    onValueChange(Math.min(Number(trimmed), max))
  }

  return (
    <Input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      value={draft ?? String(value)}
      className={className}
      onFocus={(e) => {
        focused.current = true
        // Mobile browsers place the caret at the tap position *after* the
        // focus handler runs, so selecting synchronously here gets undone and
        // the customer ends up typing beside the old number instead of over
        // it. Defer past that, and repeat on click because a tap fires focus
        // and click in that order.
        selectAll(e.currentTarget)
      }}
      onClick={(e) => selectAll(e.currentTarget)}
      onChange={(e) => commit(e.target.value)}
      onBlur={() => {
        focused.current = false
        const parsed = draft === null || draft === "" ? value : Number(draft)
        const settled = Math.min(Math.max(Number.isFinite(parsed) ? parsed : min, min), max)
        if (settled !== value) onValueChange(settled)
        setDraft(null)
      }}
    />
  )
}
