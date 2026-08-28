/**
 * Lightweight IP-based rate limiting for public API routes.
 *
 * Uses Upstash Redis over its REST API via plain `fetch` - NO npm dependency,
 * so it never affects the build. It is ENV-GATED: if UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN are not set, every request is allowed (fail-open),
 * so the site behaves exactly as before until an Upstash database is attached.
 * KV_REST_API_URL / KV_REST_API_TOKEN are accepted as equivalents. Any Redis/network error also fails open, so a
 * rate-limiter outage can never take the site down.
 *
 * Algorithm: fixed window. INCR a per-window counter and set its TTL on first
 * hit. Best-effort and stateless-friendly (works on Vercel serverless).
 */

// Finding the credentials is its own problem. The same Upstash REST endpoint
// arrives under different names depending on how the database was attached:
// UPSTASH_REDIS_REST_URL/TOKEN when the values are pasted in by hand,
// KV_REST_API_URL/TOKEN through the Vercel Marketplace - and the Marketplace
// dialog also offers a "Custom Prefix" that renames the pair to anything at all.
//
// A name that does not match produces no error, just a limiter that quietly
// never limits, which is indistinguishable from a working one until someone
// abuses the endpoint. So: try the two known pairs, then fall back to finding
// any prefix that carries both a URL and a token. There is one Redis here, so
// an unambiguous match is the right one.
function resolveRedisCredentials(): { url?: string; token?: string; source: string } {
  const known: Array<[string, string]> = [
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
  ]

  for (const [urlKey, tokenKey] of known) {
    const url = process.env[urlKey]?.trim()
    const token = process.env[tokenKey]?.trim()
    if (url && token) return { url, token, source: urlKey }
  }

  // Custom prefix: <PREFIX>_REST_API_URL / <PREFIX>_REST_API_TOKEN, or
  // <PREFIX>_REDIS_REST_URL / <PREFIX>_REDIS_REST_TOKEN.
  for (const suffix of ["_REST_API_URL", "_REDIS_REST_URL"]) {
    for (const key of Object.keys(process.env)) {
      if (!key.endsWith(suffix)) continue
      const url = process.env[key]?.trim()
      const tokenKey = key.slice(0, -"_URL".length) + "_TOKEN"
      const token = process.env[tokenKey]?.trim()
      // Only REST endpoints work over fetch; a redis:// connection string does not.
      if (url && token && /^https?:\/\//.test(url)) {
        return { url, token, source: key }
      }
    }
  }

  return { source: "none" }
}

const { url: REDIS_URL, token: REDIS_TOKEN, source: REDIS_CREDENTIAL_SOURCE } = resolveRedisCredentials()

// One line at cold start saying whether limiting is on, and which variable it
// came from. Without it, "configured but not working" and "not configured" look
// identical from the outside.
console.log(
  REDIS_URL && REDIS_TOKEN
    ? `[rate-limit] active, credentials from ${REDIS_CREDENTIAL_SOURCE}`
    : "[rate-limit] INACTIVE - no Upstash REST credentials found; every request is allowed",
)

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
