const UI_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
})

// "Fri, Dec 11" - for buttons, where "December 11, 2026" overflows a phone.
const UI_DATE_SHORT_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
})

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const parsed = new Date(year, monthIndex, day)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null
  }

  return parsed
}

function parseUiDateInput(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const dateOnly = parseDateOnly(trimmed)
  if (dateOnly) {
    return dateOnly
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function formatUiDate(
  value: string | Date | number | null | undefined,
  fallback = "",
): string {
  if (value === null || value === undefined || value === "") {
    return fallback
  }

  let parsed: Date | null = null
  if (value instanceof Date) {
    parsed = Number.isNaN(value.getTime()) ? null : value
  } else if (typeof value === "number") {
    const date = new Date(value)
    parsed = Number.isNaN(date.getTime()) ? null : date
  } else {
    parsed = parseUiDateInput(value)
  }

  if (!parsed) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback
  }

  return UI_DATE_FORMATTER.format(parsed)
}

/** Short form of formatUiDate ("Fri, Dec 11") for tight spots such as a CTA button. */
export function formatUiDateShort(value: string | null | undefined, fallback = ""): string {
  const parsed = value ? parseUiDateInput(value) : null
  return parsed ? UI_DATE_SHORT_FORMATTER.format(parsed) : fallback
}
