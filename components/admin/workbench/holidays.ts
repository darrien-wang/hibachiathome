// 美国联邦假日 + 派对旺日（南加州做 hibachi 的节奏），按规则生成，任何年份都有。
// The comp hard-coded 2026–2027; these are the same days computed from the
// calendar rules so the list never goes stale.

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}
/** nth (1-based) weekday (0=Sun) of a month; nth = -1 for the last one. */
function nthWeekday(y: number, m: number, weekday: number, nth: number): string {
  if (nth > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
    const day = 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7
    return ymd(y, m, day)
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const last = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay()
  return ymd(y, m, lastDay - ((last - weekday + 7) % 7))
}

export function holidaysForYear(y: number): Record<string, string> {
  const h: Record<string, string> = {}
  h[ymd(y, 1, 1)] = "New Year's Day"
  h[nthWeekday(y, 1, 1, 3)] = "MLK Day"
  h[ymd(y, 2, 14)] = "Valentine's"
  h[nthWeekday(y, 2, 1, 3)] = "Presidents' Day"
  h[nthWeekday(y, 5, 0, 2)] = "Mother's Day"
  h[nthWeekday(y, 5, 1, -1)] = "Memorial Day"
  h[ymd(y, 6, 19)] = "Juneteenth"
  h[nthWeekday(y, 6, 0, 3)] = "Father's Day"
  h[ymd(y, 7, 4)] = "Independence Day"
  h[nthWeekday(y, 9, 1, 1)] = "Labor Day"
  h[nthWeekday(y, 10, 1, 2)] = "Columbus Day"
  h[ymd(y, 10, 31)] = "Halloween"
  h[ymd(y, 11, 11)] = "Veterans Day"
  const tg = nthWeekday(y, 11, 4, 4)
  h[tg] = "Thanksgiving"
  const tgDate = new Date(Date.parse(`${tg}T00:00:00Z`) + 86400000)
  h[ymd(y, 11, tgDate.getUTCDate())] = "Black Friday"
  h[ymd(y, 12, 24)] = "Christmas Eve"
  h[ymd(y, 12, 25)] = "Christmas"
  h[ymd(y, 12, 31)] = "New Year's Eve"
  return h
}

const cache = new Map<number, Record<string, string>>()
export function holidayOn(date: string): string {
  const y = Number(date.slice(0, 4))
  if (!cache.has(y)) cache.set(y, holidaysForYear(y))
  return cache.get(y)![date] ?? ""
}

/** The next n holidays on/after `from` (YYYY-MM-DD). */
export function upcomingHolidays(from: string, n = 4): Array<{ date: string; name: string }> {
  const y = Number(from.slice(0, 4))
  const all = { ...holidaysForYear(y), ...holidaysForYear(y + 1) }
  return Object.keys(all)
    .filter((d) => d >= from)
    .sort()
    .slice(0, n)
    .map((d) => ({ date: d, name: all[d] }))
}
