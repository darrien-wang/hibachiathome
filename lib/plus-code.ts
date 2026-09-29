// Plus Code（Open Location Code）—— 老板 2026-09-29 提出的解法。
//
// 起因：Caleb 那单的 "8050 Stargate, Yucca Valley" 在 OpenStreetMap 里查不到，换了
// 五种写法都查不到——不是地址写错了，是 OSM 的数据里根本没有这条街。沙漠区的度假屋
// 正是我们最赚钱的一块（Joshua Tree / Yucca Valley / Big Bear），这种地址只会越来越多。
//
// Plus Code 解决得很干净：Google 地图上任何一个点右键就能拿到，而且它**不是一个要去
// 查的名字，它本身就是坐标的另一种写法**——离线算得出来，不依赖任何服务、不用 key、
// 不会限流、不会因为哪家地图没收录这条街就失败。

const ALPHABET = "23456789CFGHJMPQRVWX"
const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125]
const SEPARATOR_POSITION = 8

/** 完整码：8 位 + "+" + 2~3 位，例如 85654G4J+24 */
const FULL_RE = /\b([23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,3})\b/i
/** 短码：4~6 位 + "+" + 2~3 位，例如 4G4J+24，必须配一个地名才知道在地球哪一边 */
const SHORT_RE = /\b([23456789CFGHJMPQRVWX]{4,6}\+[23456789CFGHJMPQRVWX]{2,3})\b/i

function encode(lat: number, lng: number): string {
  let a = lat + 90
  let b = lng + 180
  let out = ""
  for (let i = 0; i < 5; i++) {
    const la = Math.floor(a / PAIR_RESOLUTIONS[i])
    a -= la * PAIR_RESOLUTIONS[i]
    const lo = Math.floor(b / PAIR_RESOLUTIONS[i])
    b -= lo * PAIR_RESOLUTIONS[i]
    out += ALPHABET[la] + ALPHABET[lo]
    if (i === 3) out += "+"
  }
  return out
}

/** 完整码 → 格子中心点。纯计算，不联网。 */
export function decodePlusCode(code: string): { lat: number; lng: number } | null {
  const clean = code.toUpperCase().replace(/\+/g, "")
  if (clean.length < 8 || clean.length % 2 !== 0) return null
  let lat = 0
  let lng = 0
  const pairs = Math.min(clean.length / 2, PAIR_RESOLUTIONS.length)
  for (let i = 0; i < pairs; i++) {
    const la = ALPHABET.indexOf(clean[2 * i])
    const lo = ALPHABET.indexOf(clean[2 * i + 1])
    if (la < 0 || lo < 0) return null
    lat += la * PAIR_RESOLUTIONS[i]
    lng += lo * PAIR_RESOLUTIONS[i]
  }
  // 落在格子中心，不是角上——角上会让点稳定地偏向西南。
  const half = PAIR_RESOLUTIONS[pairs - 1] / 2
  return { lat: lat - 90 + half, lng: lng - 180 + half }
}

/** 短码 + 一个参考点 → 完整码。参考点给出被省掉的那几位。 */
export function recoverPlusCode(short: string, refLat: number, refLng: number): string {
  const s = short.toUpperCase()
  const pad = SEPARATOR_POSITION - s.indexOf("+")
  return encode(refLat, refLng).slice(0, pad) + s
}

/**
 * 从一段地址里认出 Plus Code。
 * `full` 直接就能解；`short` 要先拿 `rest`（"Yucca Valley, California" 这部分）定位到
 * 大概哪个区域，再补全。
 */
export function parsePlusCode(text: string): { code: string; full: boolean; rest: string } | null {
  const t = (text ?? "").trim()
  if (!t) return null
  const full = FULL_RE.exec(t)
  if (full) return { code: full[1].toUpperCase(), full: true, rest: t.replace(full[1], "").replace(/^[\s,]+|[\s,]+$/g, "") }
  const short = SHORT_RE.exec(t)
  if (short) return { code: short[1].toUpperCase(), full: false, rest: t.replace(short[1], "").replace(/^[\s,]+|[\s,]+$/g, "") }
  return null
}

/** "34.10506, -116.46969" 这种直接粘坐标的写法也认。 */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(text ?? "")
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}
