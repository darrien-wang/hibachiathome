// 定时任务（Supabase pg_cron）调我们接口时怎么证明自己（2026-10-09）。
//
// 线索巡检那把 LEAD_WATCH_CRON_KEY（Vault 里叫 lead_watch_cron_key，2026-10-04）按设计
// "只在 lead-watch 认"。别的定时任务不直接收它，而是收它派生出来的专用钥匙：
//   HMAC-SHA256(key = LEAD_WATCH_CRON_KEY, data = 用途) 的十六进制小写
// pg_cron 发请求时用 pgcrypto 现算：
//   encode(extensions.hmac('<用途>', btrim(<vault 里那把>), 'sha256'), 'hex')
// 不用另存新密钥、不用动 Vercel 环境变量；派生钥匙漏了也只能触发这一个用途，
// 推不出原钥匙，也调不动线索巡检。

import { createHmac, timingSafeEqual } from "node:crypto"

/** 好评台账每 15 分钟从 Google 商家资料自动同步 */
export const CRON_PURPOSE_REVIEWS_SYNC = "reviews-sync"

/** 每 15 分钟把 Meta 来的客人"回话 / 锁单"回传给 Meta（D-1014-01） */
export const CRON_PURPOSE_META_CAPI = "meta-capi"

/** 每 2 分钟把 Meta 表单广告（Instant Form）的新线索拉进工作台并发报价（2026-10-21） */
export const CRON_PURPOSE_META_LEADS = "meta-leads"

/** 每 20 分钟（07–24 PT）抓一组 Reddit 版块新帖 + 每天一次 Facebook 公开帖搜索（2026-10-21 起由 pg_cron 调；桌面任务 10-04 起就没跑了） */
export const CRON_PURPOSE_REDDIT_WATCH = "reddit-watch"

/** 每周一早上的同行周报：Meta 广告库 / Google 广告透明中心 / 同行 Google 新差评（2026-10-21） */
export const CRON_PURPOSE_COMPETITOR_WATCH = "competitor-watch"

export function cronKeyFor(purpose: string, base = process.env.LEAD_WATCH_CRON_KEY): string | null {
  const k = (base ?? "").trim()
  return k ? createHmac("sha256", k).update(purpose).digest("hex") : null
}

type CronRequest = { nextUrl: { searchParams: URLSearchParams }; headers: Headers }

/** 带 ?consumer=cron、并且 x-admin-key（或 Bearer）是这个用途的派生钥匙。 */
export function isCronCall(request: CronRequest, purpose: string, base = process.env.LEAD_WATCH_CRON_KEY): boolean {
  if (request.nextUrl.searchParams.get("consumer") !== "cron") return false
  const want = cronKeyFor(purpose, base)
  if (!want) return false
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
  const provided = request.headers.get("x-admin-key")?.trim() || bearer
  const a = Buffer.from(provided)
  const b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}
