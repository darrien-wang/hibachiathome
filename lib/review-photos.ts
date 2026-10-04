// 评价里客人传的照片（2026-10-04 老板："希望能够在好评榜上显示带图的好评"）。
// 直接用平台 CDN 的地址（不转存）：客人删了照片，这里也跟着没了。
// 服务端导入和好评榜页面共用这一份，不能引任何只在服务端能用的东西。

const HOSTS = [/^lh\d\.googleusercontent\.com$/, /^[a-z0-9-]+\.googleusercontent\.com$/, /^s3-media\d\.fl\.yelpcdn\.com$/]
const isGoogle = (url: string) => /\.googleusercontent\.com\//.test(url)

/** Google 用地址末尾的 "=w…-h…" 定尺寸；存的时候去掉，用的时候要多大给多大。 */
function googleBase(url: string): string {
  const cut = url.lastIndexOf("=")
  return cut > url.indexOf(".com/") ? url.slice(0, cut) : url
}

/** 导入时清洗：只收 https、只收两家平台的图床，去尺寸、去重，最多 10 张。 */
export function cleanPhotoUrls(v: unknown, max = 10): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const x of v) {
    const s = String(x ?? "").trim()
    if (!s || s.length > 1000) continue
    let u: URL
    try {
      u = new URL(s)
    } catch {
      continue
    }
    if (u.protocol !== "https:" || !HOSTS.some((h) => h.test(u.hostname))) continue
    const base = isGoogle(u.toString()) ? googleBase(u.toString()) : u.toString()
    if (!out.includes(base)) out.push(base)
    if (out.length >= max) break
  }
  return out
}

/** 方形缩略图（Google 的图按中心裁）。Yelp 的图原样给。 */
export function photoThumb(url: string, px: number): string {
  return isGoogle(url) ? `${url}=w${px}-h${px}-p-k-no` : url
}

/** 看大图：长边不超过 px，不裁。 */
export function photoFull(url: string, px = 1600): string {
  return isGoogle(url) ? `${url}=w${px}-h${px}-k-no` : url
}
