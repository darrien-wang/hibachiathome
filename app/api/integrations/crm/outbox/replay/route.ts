import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { replayCrmOutboxBatch } from "@/lib/crm-outbox"

export const runtime = "nodejs"

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

function parseLimit(request: NextRequest): number {
  const value = request.nextUrl.searchParams.get("limit")
  if (!value) {
    return DEFAULT_LIMIT
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT
  }
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)))
}

function isReplayAuthorized(request: NextRequest): boolean {
  const expectedToken = process.env.CRM_INTEGRATION_REPLAY_TOKEN?.trim()
  if (!expectedToken) {
    return false
  }

  const token = request.headers.get("x-crm-replay-token")?.trim()
  if (!token) {
    return false
  }

  return token === expectedToken
}

export async function POST(request: NextRequest) {
  const replayToken = process.env.CRM_INTEGRATION_REPLAY_TOKEN?.trim()
  if (!replayToken) {
    return NextResponse.json(
      { ok: false, error: "Missing CRM_INTEGRATION_REPLAY_TOKEN configuration." },
      { status: 500 },
    )
  }

  if (!isReplayAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase server client is not configured." }, { status: 500 })
  }

  const limit = parseLimit(request)

  try {
    const { summary, rows } = await replayCrmOutboxBatch(supabase, limit)
    return NextResponse.json(
      {
        ok: true,
        summary,
        selectedEventIds: rows.map((row) => row.event_id),
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Replay failed."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
