import { createHash } from "node:crypto"
import { createServerSupabaseClient } from "@/lib/supabase"
import { type CrmDepositPaidEventEnvelope, sendCrmEventEnvelope } from "@/lib/crm-integration"

export type CrmOutboxStatus = "pending" | "sending" | "sent" | "failed" | "dead_letter"

type SupabaseClient = NonNullable<ReturnType<typeof createServerSupabaseClient>>

export type CrmOutboxRow = {
  id: number
  event_id: string
  event_type: string
  payload_json: Record<string, unknown>
  payload_hash: string
  status: CrmOutboxStatus
  attempt_count: number
  max_attempts: number
  last_attempt_at: string | null
  next_attempt_at: string | null
  response_status: number | null
  response_body: Record<string, unknown> | null
  last_error: string | null
  last_request_id: string | null
  created_at: string
  updated_at: string
}

type EnqueueResult =
  | {
      ok: true
      deduped: boolean
      record: CrmOutboxRow
    }
  | {
      ok: false
      conflict: boolean
      error: string
      existing?: CrmOutboxRow
    }

type DeliverResult =
  | {
      ok: true
      state: "sent" | "failed" | "dead_letter" | "skipped"
      record: CrmOutboxRow
      delivered: boolean
      requestId?: string
      reason?: string
      status?: number
      error?: string
    }
  | {
      ok: false
      error: string
    }

export type ReplaySummary = {
  selected: number
  sent: number
  failed: number
  dead_letter: number
  skipped: number
  errors: number
}

const OUTBOX_TABLE = "crm_integration_outbox"
const OUTBOX_SELECT = [
  "id",
  "event_id",
  "event_type",
  "payload_json",
  "payload_hash",
  "status",
  "attempt_count",
  "max_attempts",
  "last_attempt_at",
  "next_attempt_at",
  "response_status",
  "response_body",
  "last_error",
  "last_request_id",
  "created_at",
  "updated_at",
].join(", ")

const DEFAULT_MAX_ATTEMPTS = 10
const RETRY_SCHEDULE_SECONDS = [30, 120, 600, 1800, 3600, 7200]

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  return fallback
}

function resolveMaxAttempts(override?: number): number {
  if (typeof override === "number" && Number.isInteger(override) && override > 0) {
    return override
  }
  return toPositiveInteger(process.env.CRM_INTEGRATION_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS)
}

function parseOutboxRow(value: unknown): CrmOutboxRow | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const id = typeof row.id === "number" ? row.id : Number(row.id)
  if (!Number.isFinite(id)) return null

  const status = asString(row.status) as CrmOutboxStatus | null
  if (!status) return null

  return {
    id,
    event_id: asString(row.event_id) ?? "",
    event_type: asString(row.event_type) ?? "",
    payload_json: (row.payload_json as Record<string, unknown> | null) ?? {},
    payload_hash: asString(row.payload_hash) ?? "",
    status,
    attempt_count: Number.isFinite(Number(row.attempt_count)) ? Number(row.attempt_count) : 0,
    max_attempts: Number.isFinite(Number(row.max_attempts)) ? Number(row.max_attempts) : DEFAULT_MAX_ATTEMPTS,
    last_attempt_at: asString(row.last_attempt_at),
    next_attempt_at: asString(row.next_attempt_at),
    response_status: Number.isFinite(Number(row.response_status)) ? Number(row.response_status) : null,
    response_body: (row.response_body as Record<string, unknown> | null) ?? null,
    last_error: asString(row.last_error),
    last_request_id: asString(row.last_request_id),
    created_at: asString(row.created_at) ?? new Date(0).toISOString(),
    updated_at: asString(row.updated_at) ?? new Date(0).toISOString(),
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function toPayloadHash(payload: Record<string, unknown>): string {
  const raw = JSON.stringify(payload)
  return createHash("sha256").update(raw).digest("hex")
}

function nextRetryAtIso(attemptCount: number): string {
  const index = Math.max(0, Math.min(RETRY_SCHEDULE_SECONDS.length - 1, attemptCount - 1))
  const delaySeconds = RETRY_SCHEDULE_SECONDS[index]
  return new Date(Date.now() + delaySeconds * 1000).toISOString()
}

function isDueForDelivery(row: CrmOutboxRow): boolean {
  if (!row.next_attempt_at) return true
  const dueAt = Date.parse(row.next_attempt_at)
  if (!Number.isFinite(dueAt)) return true
  return dueAt <= Date.now()
}

async function getOutboxByEventId(supabase: SupabaseClient, eventId: string): Promise<CrmOutboxRow | null> {
  const { data, error } = await supabase.from(OUTBOX_TABLE).select(OUTBOX_SELECT).eq("event_id", eventId).maybeSingle()
  if (error) {
    console.error("[crm/outbox] Failed to query by event_id:", error)
    return null
  }
  return parseOutboxRow(data)
}

export async function enqueueCrmOutboxEvent(
  supabase: SupabaseClient,
  params: {
    eventId: string
    eventType: string
    payload: CrmDepositPaidEventEnvelope
    maxAttempts?: number
  },
): Promise<EnqueueResult> {
  const eventId = asString(params.eventId)
  const eventType = asString(params.eventType)
  if (!eventId || !eventType) {
    return {
      ok: false,
      conflict: false,
      error: "eventId and eventType are required.",
    }
  }

  const payloadHash = toPayloadHash(params.payload as unknown as Record<string, unknown>)
  const existing = await getOutboxByEventId(supabase, eventId)
  if (existing) {
    if (existing.payload_hash !== payloadHash) {
      return {
        ok: false,
        conflict: true,
        error: "event_id already exists with different payload hash.",
        existing,
      }
    }
    return {
      ok: true,
      deduped: true,
      record: existing,
    }
  }

  const current = nowIso()
  const { data, error } = await supabase
    .from(OUTBOX_TABLE)
    .insert({
      event_id: eventId,
      event_type: eventType,
      payload_json: params.payload,
      payload_hash: payloadHash,
      status: "pending",
      attempt_count: 0,
      max_attempts: resolveMaxAttempts(params.maxAttempts),
      next_attempt_at: current,
      created_at: current,
      updated_at: current,
    })
    .select(OUTBOX_SELECT)
    .single()

  if (error) {
    // Handle race condition by checking the existing record again.
    if ((error as { code?: string }).code === "23505") {
      const raceRecord = await getOutboxByEventId(supabase, eventId)
      if (raceRecord) {
        if (raceRecord.payload_hash !== payloadHash) {
          return {
            ok: false,
            conflict: true,
            error: "event_id conflict detected after insert race.",
            existing: raceRecord,
          }
        }
        return {
          ok: true,
          deduped: true,
          record: raceRecord,
        }
      }
    }

    return {
      ok: false,
      conflict: false,
      error: `Failed to insert outbox row: ${error.message}`,
    }
  }

  const record = parseOutboxRow(data)
  if (!record) {
    return {
      ok: false,
      conflict: false,
      error: "Failed to parse inserted outbox row.",
    }
  }

  return {
    ok: true,
    deduped: false,
    record,
  }
}

export async function deliverCrmOutboxRecord(supabase: SupabaseClient, row: CrmOutboxRow): Promise<DeliverResult> {
  if (row.status === "sent" || row.status === "dead_letter") {
    return {
      ok: true,
      state: "skipped",
      record: row,
      delivered: row.status === "sent",
      reason: "terminal_status",
    }
  }

  if (!isDueForDelivery(row)) {
    return {
      ok: true,
      state: "skipped",
      record: row,
      delivered: false,
      reason: "not_due_yet",
    }
  }

  const attemptCount = row.attempt_count + 1
  const claimedAt = nowIso()

  const { data: claimedData, error: claimError } = await supabase
    .from(OUTBOX_TABLE)
    .update({
      status: "sending",
      attempt_count: attemptCount,
      last_attempt_at: claimedAt,
      updated_at: claimedAt,
    })
    .eq("id", row.id)
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", claimedAt)
    .select(OUTBOX_SELECT)
    .maybeSingle()

  if (claimError) {
    return {
      ok: false,
      error: `Failed to claim outbox row for delivery: ${claimError.message}`,
    }
  }

  const claimed = parseOutboxRow(claimedData)
  if (!claimed) {
    return {
      ok: true,
      state: "skipped",
      record: row,
      delivered: false,
      reason: "already_claimed_or_not_due",
    }
  }

  const payload = claimed.payload_json as unknown as CrmDepositPaidEventEnvelope
  const delivery = await sendCrmEventEnvelope({ envelope: payload })
  const updatedAt = nowIso()

  if (delivery.attempted && delivery.delivered) {
    const { data: sentData, error: sentError } = await supabase
      .from(OUTBOX_TABLE)
      .update({
        status: "sent",
        response_status: delivery.status ?? null,
        response_body: (delivery.body as Record<string, unknown> | undefined) ?? null,
        last_error: null,
        last_request_id: delivery.requestId,
        next_attempt_at: null,
        updated_at: updatedAt,
      })
      .eq("id", claimed.id)
      .select(OUTBOX_SELECT)
      .single()

    if (sentError) {
      return {
        ok: false,
        error: `Failed to mark outbox row as sent: ${sentError.message}`,
      }
    }

    const sent = parseOutboxRow(sentData)
    if (!sent) {
      return {
        ok: false,
        error: "Failed to parse sent outbox row.",
      }
    }

    return {
      ok: true,
      state: "sent",
      record: sent,
      delivered: true,
      requestId: delivery.requestId,
      status: delivery.status,
    }
  }

  const reason = delivery.attempted
    ? delivery.error ?? `delivery_failed_status_${delivery.status ?? "unknown"}`
    : `${delivery.reason}${delivery.detail ? `: ${delivery.detail}` : ""}`

  const shouldDeadLetter = attemptCount >= claimed.max_attempts
  const newStatus: CrmOutboxStatus = shouldDeadLetter ? "dead_letter" : "failed"

  const { data: failedData, error: failedError } = await supabase
    .from(OUTBOX_TABLE)
    .update({
      status: newStatus,
      response_status: delivery.attempted ? (delivery.status ?? null) : null,
      response_body: delivery.attempted ? ((delivery.body as Record<string, unknown> | undefined) ?? null) : null,
      last_error: reason,
      last_request_id: delivery.attempted ? delivery.requestId : null,
      next_attempt_at: shouldDeadLetter ? null : nextRetryAtIso(attemptCount),
      updated_at: updatedAt,
    })
    .eq("id", claimed.id)
    .select(OUTBOX_SELECT)
    .single()

  if (failedError) {
    return {
      ok: false,
      error: `Failed to mark outbox row as ${newStatus}: ${failedError.message}`,
    }
  }

  const failed = parseOutboxRow(failedData)
  if (!failed) {
    return {
      ok: false,
      error: "Failed to parse failed outbox row.",
    }
  }

  return {
    ok: true,
    state: newStatus,
    record: failed,
    delivered: false,
    status: delivery.attempted ? delivery.status : undefined,
    requestId: delivery.attempted ? delivery.requestId : undefined,
    reason,
    error: delivery.attempted ? delivery.error : undefined,
  }
}

export async function replayCrmOutboxBatch(
  supabase: SupabaseClient,
  limit = 20,
): Promise<{
  summary: ReplaySummary
  rows: CrmOutboxRow[]
}> {
  const requestedLimit = Math.max(1, Math.min(100, Number.isFinite(limit) ? Math.floor(limit) : 20))
  const now = nowIso()

  const { data, error } = await supabase
    .from(OUTBOX_TABLE)
    .select(OUTBOX_SELECT)
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(requestedLimit)

  if (error) {
    throw new Error(`Failed to load pending CRM outbox rows: ${error.message}`)
  }

  const rows = (Array.isArray(data) ? data : [])
    .map((row) => parseOutboxRow(row))
    .filter((row): row is CrmOutboxRow => Boolean(row))

  const summary: ReplaySummary = {
    selected: rows.length,
    sent: 0,
    failed: 0,
    dead_letter: 0,
    skipped: 0,
    errors: 0,
  }

  for (const row of rows) {
    const result = await deliverCrmOutboxRecord(supabase, row)
    if (!result.ok) {
      summary.errors += 1
      continue
    }
    if (result.state === "sent") {
      summary.sent += 1
      continue
    }
    if (result.state === "failed") {
      summary.failed += 1
      continue
    }
    if (result.state === "dead_letter") {
      summary.dead_letter += 1
      continue
    }
    summary.skipped += 1
  }

  return {
    summary,
    rows,
  }
}
