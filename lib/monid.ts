// Monid (monid.ai): one key, pay-per-call access to third-party data endpoints
// (owner 2026-10-21, "开始做吧"). The key is MONID_API_KEY on Vercel; without it
// every call says so and the caller keeps its old path, so nothing here is
// load-bearing.
//
// Costs are per call or per result: a Reddit listing $0.0008, a Facebook post
// search about $0.03 for 10 results, a Google reviews page $0.00015. Callers
// keep their own cadence low; the budget cap on app.monid.ai is the backstop.
//
// Request shape (from `monid inspect`): POST /v1/run { provider, endpoint,
// input: { body?, queryParams?, pathParams? } }. A quick endpoint answers with
// the output; a slow one answers 202 with a run id that is polled at
// GET /v1/runs/:id until it settles.

const BASE = "https://api.monid.ai"
const TERMINAL = new Set(["COMPLETED", "FAILED", "BLOCKED", "STOPPED", "TIMED_OUT"])

export type MonidInput = {
  body?: Record<string, unknown>
  queryParams?: Record<string, string | number | boolean>
  pathParams?: Record<string, string>
}

export type MonidOk<T> = { ok: true; output: T; cost: number | null; runId: string | null }
export type MonidErr = { ok: false; error: string; runId: string | null }
export type MonidResult<T = unknown> = MonidOk<T> | MonidErr

type RunBody = {
  runId?: string
  status?: string
  output?: unknown
  cost?: { value?: number } | null
  reason?: string
  message?: string
  error?: string
}

export type MonidOptions = {
  apiKey?: string
  fetchImpl?: typeof fetch
  /** Give up polling after this long (default 45 s; routes run under maxDuration 60). */
  timeoutMs?: number
  pollMs?: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export function monidEnabled(apiKey: string | undefined = process.env.MONID_API_KEY): boolean {
  return Boolean(apiKey?.trim())
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Execute one endpoint and return its output. Never throws: every failure is
 * { ok: false, error }, so a caller can log it and carry on.
 */
export async function monidRun<T = unknown>(provider: string, endpoint: string, input: MonidInput, opts: MonidOptions = {}): Promise<MonidResult<T>> {
  const key = (opts.apiKey ?? process.env.MONID_API_KEY ?? "").trim()
  if (!key) return { ok: false, error: "MONID_API_KEY not set", runId: null }
  const fetchImpl = opts.fetchImpl ?? fetch
  const now = opts.now ?? Date.now
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const timeoutMs = opts.timeoutMs ?? 45_000
  const auth = { authorization: `Bearer ${key}` }
  const started = now()

  let body: RunBody
  let status: number
  try {
    const res = await fetchImpl(`${BASE}/v1/run`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ provider, endpoint, input }),
      cache: "no-store",
    })
    status = res.status
    body = (await res.json().catch(() => ({}))) as RunBody
  } catch (e) {
    return { ok: false, error: `monid network: ${msg(e)}`, runId: null }
  }
  const runId = body.runId ?? null
  if (status >= 400) return { ok: false, error: `monid ${status}: ${body.message ?? body.error ?? body.reason ?? "request failed"}`, runId }

  // Settled = a terminal status, or (for a provider that answers without one)
  // an output. Anything else carries READY/RUNNING and a run id to poll.
  const settled = (b: RunBody) => (b.status ? TERMINAL.has(b.status) : b.output !== undefined)
  while (!settled(body)) {
    if (!runId) return { ok: false, error: "monid: no output and no run id to poll", runId: null }
    if (now() - started > timeoutMs) return { ok: false, error: `monid: run ${runId} still ${body.status ?? "pending"} after ${timeoutMs} ms`, runId }
    await sleep(opts.pollMs ?? 2500)
    try {
      const r = await fetchImpl(`${BASE}/v1/runs/${runId}`, { headers: auth, cache: "no-store" })
      if (!r.ok) return { ok: false, error: `monid ${r.status} while polling ${runId}`, runId }
      body = (await r.json().catch(() => ({}))) as RunBody
    } catch (e) {
      return { ok: false, error: `monid network: ${msg(e)}`, runId }
    }
  }
  if (body.status && body.status !== "COMPLETED") return { ok: false, error: `monid: run ${body.status}${body.reason ? ` (${body.reason})` : ""}`, runId }
  return { ok: true, output: body.output as T, cost: typeof body.cost?.value === "number" ? body.cost.value : null, runId }
}

/** anyapi answers { found: false, data: null, reason } when the upstream has nothing; that is an empty result, not an error. */
export function monidFound(output: unknown): boolean {
  return !(typeof output === "object" && output !== null && (output as { found?: unknown }).found === false)
}

/**
 * The list of rows inside a provider's output. anyapi wraps them as
 * { found, data: { posts | ads | items: [...] } }, litescrape as
 * { reviews: [...] }, dataforseo as [{ items: [...] }]. `preferred` names the
 * keys to look for first; otherwise the first array of objects found wins.
 */
export function monidList<T = Record<string, unknown>>(output: unknown, ...preferred: string[]): T[] {
  const isRows = (v: unknown): v is T[] => Array.isArray(v) && (v.length === 0 || (typeof v[0] === "object" && v[0] !== null))
  const hasPreferred = (row: unknown) => typeof row === "object" && row !== null && preferred.some((k) => isRows((row as Record<string, unknown>)[k]))
  const seen = new Set<unknown>()
  const walk = (o: unknown, depth: number): T[] | null => {
    if (depth > 4 || o === null || typeof o !== "object" || seen.has(o)) return null
    seen.add(o)
    if (Array.isArray(o)) {
      if (isRows(o) && o.length && !(o.length === 1 && hasPreferred(o[0]))) return o
      for (const v of o) {
        const r = walk(v, depth + 1)
        if (r) return r
      }
      return null
    }
    const rec = o as Record<string, unknown>
    for (const k of preferred) if (isRows(rec[k])) return rec[k] as T[]
    for (const v of Object.values(rec)) {
      const r = walk(v, depth + 1)
      if (r) return r
    }
    return null
  }
  return walk(output, 0) ?? []
}
