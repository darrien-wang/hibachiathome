// 把一段粘贴进来的文字解析成「几点、在哪」的场次列表（老板 2026-09-29：排班算法分享
// 给同行用，让他们复制一批地址进来算）。
//
// 别人手上的数据来自微信聊天、Google 表格、备忘录，格式五花八门。这里只坚持一件事：
// **每一行必须认得出一个开场时间**，其余的就是地址（可选带个名字）。认不出的行照原样
// 报出来让人改，不猜。
//
// 能认的时间：5pm · 5:30 PM · 17:00 · 17：00（中文冒号）· 下午5点 · 晚上7点半 ·
// 5点30 · 5-8pm（取开始）。
// 没写上下午的（"5:00"）：1–10 点按下午算、11 和 12 点照写的算、13 点以后按 24 小时
// 算——派对多在傍晚。预览表里会写出"5:00 PM"，认错了一眼就看得出来。

export type ParsedLine = {
  lineNo: number
  raw: string
  /** 当天零点起的分钟数；null = 没认出时间 */
  startMin: number | null
  /** 预览用："5:00 PM" */
  timeLabel: string | null
  name: string | null
  address: string
  /** 这一行写了几位客人（"15人" "15 guests" "10 adults 5 kids"）；没写 = null */
  guests: number | null
  error: string | null
}

export type ParseResult = {
  lines: ParsedLine[]
  warnings: string[]
  /** 粘贴内容里认出的那一天（YYYY-MM-DD）；没写、或者写了好几天 = null */
  date: string | null
}

export const MAX_STOPS = 15

const CELL_SPLIT = /\t|\s*[|｜;；]\s*|\s+·\s+/
const GUESTS = /\b\d{1,3}\s*(?:人|位|ppl|pax|people|guests?|adults?|kids?|children)\b|\b\d{1,3}\s*(?:人|位)/gi
const GUEST_COUNT = /(\d{1,3})\s*(人|位|ppl|pax|people|guests?|adults?|kids?|children)(?![a-z])/gi
const DATE = /\b\d{4}[/.-]\d{1,2}[/.-]\d{1,2}\b|\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b|\d{1,2}\s*月\s*\d{1,2}\s*(?:日|号)/gi
const WEEKDAY = /\b(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day)?\b\.?|(?:周|星期|礼拜)[一二三四五六日天]/gi
const HEADER = /^(?:时间|地址|名字|姓名|time|address|name|when|where)(?:\s|$)/i

type TimeHit = { start: number; end: number; minutes: number }

const fmt = (m: number) => {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}

/** 没写上下午时的默认：派对多在傍晚。 */
function guessHour(h: number): number {
  if (h >= 13) return h
  if (h === 11 || h === 12) return h
  if (h === 0) return 0
  return h + 12
}

function applyMeridiem(h: number, mer: string | undefined, zh: string | undefined): number {
  const m = (mer ?? "").toLowerCase().replace(/\./g, "")
  if (m === "am") return h === 12 ? 0 : h
  if (m === "pm") return h === 12 ? 12 : h + 12
  if (zh) {
    if (/上午|早上|早/.test(zh)) return h === 12 ? 0 : h
    if (/中午/.test(zh)) return h <= 2 ? h + 12 : h
    return h === 12 ? 12 : h < 12 ? h + 12 : h // 下午 / 傍晚 / 晚上
  }
  return guessHour(h)
}

/** 在一段文字里找第一个认得出的开场时间。 */
export function findTime(text: string): TimeHit | null {
  const hits: TimeHit[] = []
  const push = (start: number, end: number, h: number, mm: number) => {
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return
    hits.push({ start, end, minutes: h * 60 + mm })
  }

  // 时间段 "5-8pm" "5:30~8:30 PM" "下午5点-8点"：取开始，上下午跟着结尾走
  const range = /(上午|早上|中午|下午|傍晚|晚上)?\s*(\d{1,2})(?:\s*[:：点]\s*(\d{2}|半))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|—|~|～|至|到)\s*(\d{1,2})(?:\s*[:：点]\s*(\d{2}|半))?\s*(am|pm|a\.m\.|p\.m\.)?/gi
  for (const m of text.matchAll(range)) {
    const h = Number(m[2])
    if (h > 23) continue
    const mm = m[3] === "半" ? 30 : m[3] ? Number(m[3]) : 0
    const hasMarker = !!(m[1] || m[3] || m[4] || m[7] || /点/.test(m[0]))
    if (!hasMarker) continue
    push(m.index!, m.index! + m[0].length, applyMeridiem(h, m[4] ?? m[7], m[1]), mm)
  }

  // 中文："下午5点" "晚上7点半" "5点30" "5点 30分"
  // 分钟必须紧贴着"点"，或者后面带"分"——否则 "晚上7点 12 Main St" 会被读成 7:12，
  // "晚上7点 8050 Joshua Ln" 会把门牌号的前两位当成分钟。
  for (const m of text.matchAll(/(上午|早上|中午|下午|傍晚|晚上)?\s*(\d{1,2})\s*点(?:(半)|\s*(\d{1,2})\s*分|(\d{1,2})(?!\d))?/g)) {
    const h = Number(m[2])
    const mm = m[3] ? 30 : m[4] ? Number(m[4]) : m[5] ? Number(m[5]) : 0
    push(m.index!, m.index! + m[0].length, applyMeridiem(h, undefined, m[1]), mm)
  }

  // 带上下午："5pm" "5:30 PM" "5:30p.m."，前面可以有中文时段
  for (const m of text.matchAll(/(上午|早上|中午|下午|傍晚|晚上)?\s*\b(\d{1,2})(?:\s*[:：]\s*(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?![a-z])/gi)) {
    push(m.index!, m.index! + m[0].length, applyMeridiem(Number(m[2]), m[4], m[1]), m[3] ? Number(m[3]) : 0)
  }

  // 只有冒号："17:00" "5:30" "17：00"，前面可以有中文时段
  for (const m of text.matchAll(/(上午|早上|中午|下午|傍晚|晚上)?\s*\b(\d{1,2})\s*[:：]\s*(\d{2})\b(?!\s*(?:am|pm|a\.m\.|p\.m\.))/gi)) {
    push(m.index!, m.index! + m[0].length, applyMeridiem(Number(m[2]), undefined, m[1]), Number(m[3]))
  }

  if (hits.length === 0) return null
  // 最靠前的那个；同一位置取最长的（"5:30 PM" 赢过 "5:30"）
  hits.sort((a, b) => a.start - b.start || b.end - a.end)
  return hits[0]
}

const tidy = (s: string) =>
  s
    .replace(GUESTS, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,，。:：\-–—·]+|[\s,，。:：\-–—·]+$/g, "")
    .trim()

/** 地址像不像：有门牌号、有逗号、或者有常见街道词。 */
function addressScore(s: string): number {
  let n = 0
  if (/^\s*\d{1,6}\s+\S/.test(s)) n += 3
  if (/,/.test(s)) n += 2
  if (/\b(?:st|street|ave|avenue|rd|road|dr|drive|blvd|ln|lane|ct|court|way|pl|place|pkwy|hwy|trl|trail|cir|circle)\b\.?/i.test(s)) n += 2
  if (/\b\d{5}\b/.test(s)) n += 2
  if (/\b[A-Z]{2}\b/.test(s)) n += 1
  if (/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i.test(s.trim())) n += 5
  if (/^-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(s.trim())) n += 5
  return n + Math.min(s.length, 60) / 60
}

/**
 * "Tony Chen 100 Universal City Plaza, Universal City" → 名字 "Tony Chen"、地址从门牌号开始。
 * 只在前面是 1–4 个不含数字的词、后面紧跟门牌号时才拆，拿不准就不拆。
 */
function splitLeadingName(s: string): { name: string | null; address: string } {
  const m = /^([^\d,]{1,40}?)\s+(\d{1,6}\s+\S.*)$/.exec(s)
  if (!m) return { name: null, address: s }
  const words = m[1].trim().split(/\s+/)
  if (words.length > 4) return { name: null, address: s }
  return { name: m[1].trim(), address: m[2].trim() }
}

/** "15人" → 15；"10 adults 5 kids" → 15；写了总人数就以总人数为准。 */
function guestsOf(line: string): number | null {
  let total: number | null = null
  let parts = 0
  for (const m of line.matchAll(GUEST_COUNT)) {
    const n = Number(m[1])
    if (!n) continue
    if (/^(?:adults?|kids?|children)$/i.test(m[2])) parts += n
    else if (total === null) total = n
  }
  const n = total ?? (parts || null)
  return n !== null && n >= 1 && n <= 999 ? n : null
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const pad2 = (n: number) => String(n).padStart(2, "0")

/**
 * "10/3" "10-03-26" "2026-10-03" "Oct 3rd" "10月3日" → "2026-10-03"。
 * 没写年份：取离今天最近的那一年（最多往回 60 天，往后不超过 10 个月）。
 */
export function dateTokenToISO(token: string, today = new Date()): string | null {
  const t = token.toLowerCase().trim()
  let y: number | null = null
  let mo = 0
  let d = 0
  let r: RegExpExecArray | null
  if ((r = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(t))) {
    y = Number(r[1])
    mo = Number(r[2])
    d = Number(r[3])
  } else if ((r = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(t))) {
    mo = Number(r[1])
    d = Number(r[2])
    if (r[3]) y = r[3].length === 2 ? 2000 + Number(r[3]) : Number(r[3])
  } else if ((r = /^([a-z]+)\.?\s+(\d{1,2})/.exec(t))) {
    mo = MONTHS.indexOf(r[1].slice(0, 3)) + 1
    d = Number(r[2])
  } else if ((r = /^(\d{1,2})\s*月\s*(\d{1,2})/.exec(t))) {
    mo = Number(r[1])
    d = Number(r[2])
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  if (y === null) {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    y = today.getFullYear()
    const diff = (new Date(y, mo - 1, d).getTime() - start) / 86_400_000
    if (diff < -60) y += 1
    else if (diff > 305) y -= 1
  }
  const dt = new Date(y, mo - 1, d)
  if (dt.getMonth() !== mo - 1) return null // 2/30 这种
  return `${y}-${pad2(mo)}-${pad2(d)}`
}

export function parseScheduleText(text: string): ParseResult {
  const warnings: string[] = []
  const dates = new Set<string>()
  const lines: ParsedLine[] = []

  const rawLines = (text ?? "").replace(/\r\n?/g, "\n").split("\n")
  rawLines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return

    const hit = findTime(line)
    // 日期在去掉时间之后再找：不然 "5-8 pm" 里的 "5-8" 会被当成 5 月 8 日
    const noTime = hit ? line.slice(0, hit.start) + " " + line.slice(hit.end) : line
    const lineDates = noTime.match(DATE) ?? []
    for (const d of lineDates) {
      const iso = dateTokenToISO(d)
      if (iso) dates.add(iso)
    }

    if (!hit) {
      // 表头（"时间 地址"）、单独一行的日期（"10/3 周六"）直接跳过，别的照实报错
      if (HEADER.test(line)) return
      if (lineDates.length && !/\d/.test(tidy(line.replace(DATE, " ").replace(WEEKDAY, " ")))) return
      lines.push({ lineNo: i + 1, raw, startMin: null, timeLabel: null, name: null, address: tidy(line), guests: null, error: "没认出开场时间" })
      return
    }

    const rest = noTime.replace(DATE, " ").replace(WEEKDAY, " ")
    let name: string | null = null
    let address = ""

    const cells = rest
      .split(CELL_SPLIT)
      .map((c) => tidy(c))
      .filter((c) => c && !/^\d{1,3}$/.test(c))
    if (cells.length >= 2) {
      // 分了栏（Tab / | / ·）：最像地址的那栏是地址，最短的另一栏当名字
      const ranked = [...cells].sort((a, b) => addressScore(b) - addressScore(a))
      address = ranked[0]
      const others = cells.filter((c) => c !== address)
      name = others.length ? others.sort((a, b) => a.length - b.length)[0] : null
    } else {
      const one = tidy(cells[0] ?? "")
      const split = splitLeadingName(one)
      name = split.name
      address = split.address
    }

    lines.push({
      lineNo: i + 1,
      raw,
      startMin: hit.minutes,
      timeLabel: fmt(hit.minutes),
      name,
      address,
      guests: guestsOf(noTime),
      error: address ? null : "有时间，但没有地址",
    })
  })

  if (dates.size > 1) warnings.push(`看起来是好几天的场次（${Array.from(dates).slice(0, 4).map((d) => d.slice(5).replace("-", "/")).join("、")}）——一次只算一天，其他日子分开粘`)
  const ok = lines.filter((l) => !l.error)
  if (ok.length > MAX_STOPS) warnings.push(`一次最多 ${MAX_STOPS} 场，现在有 ${ok.length} 场——算法把所有排法都试一遍，再多会算不完`)
  return { lines, warnings, date: dates.size === 1 ? Array.from(dates)[0] : null }
}

export const formatClock = fmt
