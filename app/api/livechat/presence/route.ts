import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PresenceResponse = {
  online: boolean
  agentName: string | null
  source: string
  checkedAt: string
  lastOperatorAt?: string | null
}

type AdminSessionsResponse = {
  ok?: boolean
  rows?: Array<{
    sessionId?: string
    updatedAt?: string
  }>
}

type AdminSessionDetailResponse = {
  ok?: boolean
  session?: {
    messages?: Array<{
      role?: string
      source?: string
      createdAt?: string
    }>
  }
}

const OPERATOR_ACTIVE_WINDOW_MINUTES = 15

function normalizeBaseUrl(raw: string | null | undefined): string {
  const normalized = raw?.trim()
  if (!normalized) return ""
  return normalized.replace(/\/+$/, "")
}

function parseForceMode(value: string | null | undefined): "auto" | "online" | "offline" {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "online") return "online"
  if (normalized === "offline") return "offline"
  return "auto"
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseOnlineFlag(payload: Record<string, unknown>): boolean | null {
  if (typeof payload.online === "boolean") return payload.online
  if (typeof payload.isOnline === "boolean") return payload.isOnline
  if (typeof payload.available === "boolean") return payload.available
  if (typeof payload.status === "string") {
    const normalized = payload.status.trim().toLowerCase()
    if (normalized === "online" || normalized === "available") return true
    if (normalized === "offline" || normalized === "away") return false
  }
  return null
}

function pickAgentName(payload: Record<string, unknown>): string | null {
  return (
    normalizeName(payload.agentName) ??
    normalizeName(payload.operatorName) ??
    normalizeName(payload.name) ??
    normalizeName(payload.displayName)
  )
}

function buildResponse(input: Partial<PresenceResponse>): PresenceResponse {
  return {
    online: Boolean(input.online),
    agentName: input.agentName ?? null,
    source: input.source ?? "fallback",
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    ...(input.lastOperatorAt !== undefined ? { lastOperatorAt: input.lastOperatorAt } : {}),
  }
}

function parsePreviewOnline(value: string | null): boolean | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "online") return true
  if (normalized === "offline") return false
  return null
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isWithinWindow(value: string | null | undefined, nowMs = Date.now()): boolean {
  const parsed = parseTimestamp(value)
  if (parsed === null) return false
  const maxAgeMs = OPERATOR_ACTIVE_WINDOW_MINUTES * 60 * 1000
  return nowMs - parsed <= maxAgeMs
}

function pickAdminToken(): string | null {
  const token =
    process.env.LIVECHAT_ADMIN_TOKEN?.trim() ??
    process.env.CRM_INTEGRATION_SHARED_SECRET?.trim() ??
    null
  return token && token.length > 0 ? token : null
}

function getRequestHeaders(token: string | null): HeadersInit {
  if (!token) return {}
  return {
    authorization: `Bearer ${token}`,
  }
}

async function requestPresenceEndpoint(
  endpoint: string,
  token: string | null,
): Promise<Partial<PresenceResponse> | null> {
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: getRequestHeaders(token),
      cache: "no-store",
    })
    if (!response.ok) {
      return null
    }

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!payload || typeof payload !== "object") {
      return null
    }

    const online = parseOnlineFlag(payload)
    if (online === null) {
      return null
    }

    return {
      online,
      agentName: online ? pickAgentName(payload) ?? null : null,
      source: "presence_endpoint",
    }
  } catch {
    return null
  }
}

async function requestAdminHeuristic(baseUrl: string, token: string): Promise<Partial<PresenceResponse> | null> {
  try {
    const sessionsResponse = await fetch(`${baseUrl}/api/admin/sessions?limit=20`, {
      method: "GET",
      headers: getRequestHeaders(token),
      cache: "no-store",
    })
    if (!sessionsResponse.ok) return null

    const sessionsPayload = (await sessionsResponse.json().catch(() => null)) as AdminSessionsResponse | null
    const rows = Array.isArray(sessionsPayload?.rows) ? sessionsPayload.rows : []
    if (rows.length === 0) {
      return {
        online: false,
        agentName: null,
        source: "admin_sessions_heuristic",
        lastOperatorAt: null,
      }
    }

    const recentRows = rows
      .filter((row) => typeof row?.sessionId === "string" && row.sessionId.length > 0)
      .sort((left, right) => {
        const leftMs = parseTimestamp(left.updatedAt) ?? 0
        const rightMs = parseTimestamp(right.updatedAt) ?? 0
        return rightMs - leftMs
      })
      .slice(0, 5)

    let latestOperatorMessageAt: string | null = null

    for (const row of recentRows) {
      const sessionId = row.sessionId as string
      const detailResponse = await fetch(`${baseUrl}/api/admin/sessions/${encodeURIComponent(sessionId)}`, {
        method: "GET",
        headers: getRequestHeaders(token),
        cache: "no-store",
      })
      if (!detailResponse.ok) {
        continue
      }
      const detailPayload = (await detailResponse.json().catch(() => null)) as AdminSessionDetailResponse | null
      const messages = Array.isArray(detailPayload?.session?.messages) ? detailPayload?.session?.messages ?? [] : []
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index]
        if (message?.role !== "assistant") continue
        if (message?.source !== "operator") continue
        latestOperatorMessageAt = message.createdAt ?? null
        break
      }
      if (latestOperatorMessageAt) break
    }

    const fallbackAgentName = normalizeName(process.env.LIVECHAT_OPERATOR_FALLBACK_NAME) ?? "Coordinator"

    return {
      online: isWithinWindow(latestOperatorMessageAt),
      agentName: isWithinWindow(latestOperatorMessageAt) ? fallbackAgentName : null,
      source: "admin_sessions_heuristic",
      lastOperatorAt: latestOperatorMessageAt,
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const checkedAt = new Date().toISOString()
  const fallbackAgentName = normalizeName(process.env.LIVECHAT_OPERATOR_FALLBACK_NAME) ?? "Coordinator"

  if (process.env.NODE_ENV !== "production") {
    const previewOnline = parsePreviewOnline(request.nextUrl.searchParams.get("preview"))
    if (previewOnline !== null) {
      const previewAgentName = normalizeName(request.nextUrl.searchParams.get("preview_agent"))
      return NextResponse.json(
        buildResponse({
          online: previewOnline,
          agentName: previewOnline ? previewAgentName ?? fallbackAgentName : null,
          source: "preview_query",
          checkedAt,
        }),
      )
    }
  }

  const forceMode = parseForceMode(process.env.LIVECHAT_PRESENCE_FORCE)
  if (forceMode === "online") {
    return NextResponse.json(
      buildResponse({
        online: true,
        agentName: fallbackAgentName,
        source: "forced_env",
        checkedAt,
      }),
    )
  }
  if (forceMode === "offline") {
    return NextResponse.json(
      buildResponse({
        online: false,
        agentName: null,
        source: "forced_env",
        checkedAt,
      }),
    )
  }

  const baseUrl = normalizeBaseUrl(
    process.env.LIVECHAT_BASE_URL ?? process.env.NEXT_PUBLIC_LIVECHAT_BASE_URL ?? process.env.LIVECHAT_WIDGET_BASE_URL,
  )
  const adminToken = pickAdminToken()
  const explicitPresenceEndpoint = process.env.LIVECHAT_PRESENCE_ENDPOINT?.trim()

  if (explicitPresenceEndpoint) {
    const endpoint = explicitPresenceEndpoint.startsWith("http")
      ? explicitPresenceEndpoint
      : baseUrl
        ? `${baseUrl}${explicitPresenceEndpoint.startsWith("/") ? "" : "/"}${explicitPresenceEndpoint}`
        : ""
    if (endpoint) {
      const fromExplicitEndpoint = await requestPresenceEndpoint(endpoint, adminToken)
      if (fromExplicitEndpoint) {
        return NextResponse.json(
          buildResponse({
            ...fromExplicitEndpoint,
            checkedAt,
          }),
        )
      }
    }
  }

  if (baseUrl) {
    const defaultPresenceEndpoint = `${baseUrl}/api/admin/presence`
    const fromDefaultEndpoint = await requestPresenceEndpoint(defaultPresenceEndpoint, adminToken)
    if (fromDefaultEndpoint) {
      return NextResponse.json(
        buildResponse({
          ...fromDefaultEndpoint,
          checkedAt,
        }),
      )
    }
  }

  if (baseUrl && adminToken) {
    const heuristicResult = await requestAdminHeuristic(baseUrl, adminToken)
    if (heuristicResult) {
      return NextResponse.json(
        buildResponse({
          ...heuristicResult,
          checkedAt,
        }),
      )
    }
  }

  return NextResponse.json(
    buildResponse({
      online: false,
      agentName: null,
      source: "fallback_offline",
      checkedAt,
    }),
  )
}
