/**
 * Lightweight IP-based rate limiting for public API routes.
 *
 * Uses Upstash Redis over its REST API via plain `fetch` - NO npm dependency,
 * so it never affects the build. It is ENV-GATED: if UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN are not set, every request is allowed (fail-open),
 * so the site behaves exactly as before until you provision Upstash and add
 * the two env vars in Vercel. Any Redis/network error also fails open, so a
 * rate-limiter outage can never take the site down.
 *
 * Algorithm: fixed window. INCR a per-window counter and set its TTL on first
 * hit. Best-effort and stateless-friendly (works on Vercel serverless).
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL?.trim()
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

export type RateLimitResult = {
  ok: boolean
  /** true when limiting is not configured or failed open */
  bypassed: boolean
  remaining?: number
  limit?: number
}

/** Extract the best-guess client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

/**
 * Consume one token for `key` within a fixed window.
 *
 * @param key     Logical bucket, e.g. `deposit-start`. Combined with the IP.
 * @param request Incoming request (used to derive the client IP).
 * @param limit   Max requests allowed per window.
 * @param windowSeconds Window length in seconds.
 */
export async function rateLimit(
  key: string,
  request: Request,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return { ok: true, bypassed: true }
  }

  const ip = getClientIp(request)
  const window = Math.floor(Date.now() / 1000 / windowSeconds)
  const redisKey = `rl:${key}:${ip}:${window}`

  try {
    // Pipeline: INCR then set expiry only if not already set (EXPIRE ... NX).
    const response = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(windowSeconds), "NX"],
      ]),
      // Never let a slow Redis stall the request path.
      signal: AbortSignal.timeout(1500),
    })

    if (!response.ok) {
      return { ok: true, bypassed: true }
    }

    const data = (await response.json()) as Array<{ result?: unknown; error?: unknown }>
    const count = Number(data?.[0]?.result)
    if (!Number.isFinite(count)) {
      return { ok: true, bypassed: true }
    }

    const remaining = Math.max(0, limit - count)
    return { ok: count <= limit, bypassed: false, remaining, limit }
  } catch {
    // Fail open on any timeout/network/parse error.
    return { ok: true, bypassed: true }
  }
}

/** Standard 429 body for rejected requests. */
export function tooManyRequests() {
  return {
    status: 429,
    body: { success: false, error: "Too many requests. Please slow down and try again shortly." },
  }
}
