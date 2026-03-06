const RH_BOOKING_NUMBER_PATTERN = /^RH-\d{8}-\d{4}$/
const RH_BOOKING_NUMBER_SOURCES = new Set(["quoteA", "quoteB", "estimation"])

function normalizeSource(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function utcDateStamp(now: Date): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  const day = String(now.getUTCDate()).padStart(2, "0")
  return `${year}${month}${day}`
}

function randomFourDigitSuffix(): string {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const values = new Uint16Array(1)
    globalThis.crypto.getRandomValues(values)
    return String(values[0] % 10000).padStart(4, "0")
  }

  return Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")
}

export function generateRhBookingNumber(now = new Date()): string {
  return `RH-${utcDateStamp(now)}-${randomFourDigitSuffix()}`
}

export function normalizeRhBookingNumber(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toUpperCase()
  if (!normalized) {
    return null
  }

  return RH_BOOKING_NUMBER_PATTERN.test(normalized) ? normalized : null
}

export function shouldUseRhBookingNumbers(source: unknown): boolean {
  const normalizedSource = normalizeSource(source)
  return normalizedSource !== null && RH_BOOKING_NUMBER_SOURCES.has(normalizedSource)
}
