"use client"

// Month-view availability calendar over the real capacity data
// (/api/quote/slot-availability range mode). House rules (do not break):
// never disable a future day, never show a "full" label — scarcity is a
// display hint clamped to [1,3], and API failure degrades to a plain
// calendar, not a blocked one.
import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const SCARCITY_THRESHOLD = 3

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function AvailabilityCalendar({
  value,
  onSelect,
}: {
  /** Currently selected date, YYYY-MM-DD (or empty). */
  value: string
  onSelect: (date: string) => void
}) {
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [remainingByDate, setRemainingByDate] = useState<Record<string, number>>({})

  const monthStart = useMemo(() => new Date(viewYear, viewMonth, 1), [viewYear, viewMonth])
  const daysInMonth = useMemo(() => new Date(viewYear, viewMonth + 1, 0).getDate(), [viewYear, viewMonth])

  useEffect(() => {
    let cancelled = false
    const startKey = toKey(monthStart)
    fetch(`/api/quote/slot-availability?start=${startKey}&days=${daysInMonth}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { dates?: Array<{ date: string; remaining: number }> } | null) => {
        if (cancelled || !payload?.dates) return
        const next: Record<string, number> = {}
        for (const row of payload.dates) next[row.date] = row.remaining
        setRemainingByDate(next)
      })
      .catch(() => {
        // Plain calendar on failure — availability hints are optional.
      })
    return () => {
      cancelled = true
    }
  }, [monthStart, daysInMonth])

  const goMonth = useCallback(
    (delta: number) => {
      const next = new Date(viewYear, viewMonth + delta, 1)
      // Don't navigate into the past.
      if (next.getFullYear() < today.getFullYear() || (next.getFullYear() === today.getFullYear() && next.getMonth() < today.getMonth())) {
        return
      }
      setViewYear(next.getFullYear())
      setViewMonth(next.getMonth())
    },
    [viewYear, viewMonth, today],
  )

  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const leadingBlanks = monthStart.getDay()
  const atCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  return (
    <div className="rounded-xl border border-amber-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          disabled={atCurrentMonth}
          aria-label="Previous month"
          className="rounded-md p-1.5 text-gray-600 hover:bg-amber-50 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-gray-900">{monthLabel}</p>
        <button
          type="button"
          onClick={() => goMonth(1)}
          aria-label="Next month"
          className="rounded-md p-1.5 text-gray-600 hover:bg-amber-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 py-1">
            {day}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const cellDate = new Date(viewYear, viewMonth, day)
          const key = toKey(cellDate)
          const isPast = cellDate < today
          const isToday = cellDate.getTime() === today.getTime()
          const isSelected = value === key
          const remaining = remainingByDate[key]
          const scarce = !isPast && typeof remaining === "number" && remaining <= SCARCITY_THRESHOLD
          const scarcityShown = scarce ? Math.max(1, Math.min(SCARCITY_THRESHOLD, remaining)) : null

          return (
            <button
              key={key}
              type="button"
              disabled={isPast}
              onClick={() => onSelect(key)}
              aria-label={`Select ${key}${scarcityShown ? `, ${scarcityShown} slots left` : ""}`}
              className={[
                "relative flex h-11 flex-col items-center justify-center rounded-lg text-sm transition-colors",
                isPast ? "text-gray-300 cursor-default" : "text-gray-800 hover:bg-amber-50",
                isSelected ? "bg-amber-500 text-white font-bold hover:bg-amber-500" : "",
                !isSelected && isToday ? "ring-1 ring-inset ring-amber-400" : "",
              ].join(" ")}
            >
              <span>{day}</span>
              {scarcityShown !== null && !isSelected && (
                <span className="text-[9px] leading-none font-semibold text-orange-600">{scarcityShown} left</span>
              )}
              {scarcityShown !== null && isSelected && (
                <span className="text-[9px] leading-none font-semibold text-amber-100">{scarcityShown} left</span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        Every date is bookable — numbers show days that are filling up. Pick one and we confirm by text.
      </p>
    </div>
  )
}
