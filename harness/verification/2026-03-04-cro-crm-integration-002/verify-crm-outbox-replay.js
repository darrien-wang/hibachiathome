const fs = require('node:fs')
const http = require('node:http')

class InMemorySupabase {
  constructor() {
    this.tables = {
      crm_integration_outbox: [],
    }
    this.nextOutboxId = 1
  }

  from(table) {
    if (!this.tables[table]) {
      throw new Error(`Unknown table: ${table}`)
    }
    return new QueryBuilder(this, table)
  }

  getTable(table) {
    return this.tables[table]
  }

  nextId() {
    const id = this.nextOutboxId
    this.nextOutboxId += 1
    return id
  }

  findOutboxByEventId(eventId) {
    return this.tables.crm_integration_outbox.find((row) => row.event_id === eventId) || null
  }
}

class QueryBuilder {
  constructor(db, table) {
    this.db = db
    this.table = table
    this.operation = 'select'
    this.insertPayload = null
    this.updatePayload = null
    this.filters = []
    this.sortField = null
    this.sortAscending = true
  }

  select() {
    if (this.operation !== 'insert' && this.operation !== 'update') {
      this.operation = 'select'
    }
    return this
  }

  insert(payload) {
    this.operation = 'insert'
    this.insertPayload = payload
    return this
  }

  update(payload) {
    this.operation = 'update'
    this.updatePayload = payload
    return this
  }

  eq(field, value) {
    this.filters.push((row) => row[field] === value)
    return this
  }

  in(field, values) {
    const set = new Set(values)
    this.filters.push((row) => set.has(row[field]))
    return this
  }

  lte(field, value) {
    this.filters.push((row) => {
      const left = row[field]
      if (left === null || left === undefined) return false
      if (typeof left === 'number' && typeof value === 'number') return left <= value

      const leftDate = Date.parse(String(left))
      const rightDate = Date.parse(String(value))
      if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
        return leftDate <= rightDate
      }

      return String(left) <= String(value)
    })
    return this
  }

  order(field, { ascending }) {
    this.sortField = field
    this.sortAscending = Boolean(ascending)
    return this
  }

  async limit(count) {
    const rows = this.executeSelectRows()
    return {
      data: rows.slice(0, count).map((row) => ({ ...row })),
      error: null,
    }
  }

  async maybeSingle() {
    return this.executeSingle({ requireOne: false })
  }

  async single() {
    return this.executeSingle({ requireOne: true })
  }

  executeSingle({ requireOne }) {
    if (this.operation === 'insert') {
      const result = this.executeInsert()
      if (result.error) return { data: null, error: result.error }
      return { data: { ...result.row }, error: null }
    }

    if (this.operation === 'update') {
      const rows = this.executeUpdateRows()
      if (rows.length === 0) {
        if (requireOne) {
          return { data: null, error: { message: 'No rows found for single() update.' } }
        }
        return { data: null, error: null }
      }
      return { data: { ...rows[0] }, error: null }
    }

    const rows = this.executeSelectRows()
    if (rows.length === 0) {
      if (requireOne) {
        return { data: null, error: { message: 'No rows found for single() select.' } }
      }
      return { data: null, error: null }
    }
    if (rows.length > 1 && requireOne) {
      return { data: null, error: { message: 'Multiple rows found for single() select.' } }
    }
    return { data: { ...rows[0] }, error: null }
  }

  executeSelectRows() {
    let rows = this.db.getTable(this.table).filter((row) => this.filters.every((fn) => fn(row)))

    if (this.sortField) {
      const field = this.sortField
      const direction = this.sortAscending ? 1 : -1
      rows = [...rows].sort((a, b) => {
        const left = a[field]
        const right = b[field]
        if (left === right) return 0
        return left > right ? direction : -direction
      })
    }

    return rows
  }

  executeInsert() {
    const payload = this.insertPayload
    if (!payload || typeof payload !== 'object') {
      return {
        error: { message: 'Invalid insert payload.' },
      }
    }

    if (this.table === 'crm_integration_outbox') {
      const existing = this.db.getTable(this.table).find((row) => row.event_id === payload.event_id)
      if (existing) {
        return {
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint "crm_integration_outbox_event_id_key"',
          },
        }
      }
    }

    const now = new Date().toISOString()
    const row = {
      id: this.db.nextId(),
      event_id: payload.event_id,
      event_type: payload.event_type,
      payload_json: payload.payload_json,
      payload_hash: payload.payload_hash,
      status: payload.status || 'pending',
      attempt_count: Number.isFinite(Number(payload.attempt_count)) ? Number(payload.attempt_count) : 0,
      max_attempts: Number.isFinite(Number(payload.max_attempts)) ? Number(payload.max_attempts) : 10,
      last_attempt_at: payload.last_attempt_at ?? null,
      next_attempt_at: payload.next_attempt_at ?? now,
      response_status: payload.response_status ?? null,
      response_body: payload.response_body ?? null,
      last_error: payload.last_error ?? null,
      last_request_id: payload.last_request_id ?? null,
      created_at: payload.created_at ?? now,
      updated_at: payload.updated_at ?? now,
    }

    this.db.getTable(this.table).push(row)
    return { row }
  }

  executeUpdateRows() {
    if (!this.updatePayload || typeof this.updatePayload !== 'object') {
      return []
    }
    const rows = this.db.getTable(this.table)
    const matched = rows.filter((row) => this.filters.every((fn) => fn(row)))
    for (const row of matched) {
      Object.assign(row, this.updatePayload)
    }
    return matched
  }
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function startMockCrmServer() {
  const requests = []
  let attempt = 0

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/api/integrations/v1/events') {
      res.statusCode = 404
      res.end(JSON.stringify({ ok: false, error: 'not_found' }))
      return
    }

    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8')
      let parsed = null
      try {
        parsed = JSON.parse(bodyRaw)
      } catch {
        parsed = null
      }

      const record = {
        attempt: attempt + 1,
        headers: {
          'x-partner-id': req.headers['x-partner-id'] || null,
          'x-timestamp': req.headers['x-timestamp'] || null,
          'x-signature': req.headers['x-signature'] || null,
          'x-request-id': req.headers['x-request-id'] || null,
        },
        body: parsed,
      }
      requests.push(record)
      attempt += 1

      res.setHeader('content-type', 'application/json; charset=utf-8')
      if (attempt === 1) {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: 'bad_request_forced_once' }))
        return
      }

      res.statusCode = 200
      res.end(JSON.stringify({ ok: true, accepted: true, crm_id: `crm_evt_${attempt}` }))
    })
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to allocate mock CRM server port.')
  }

  return {
    port: address.port,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

async function main() {
  const outputPath = process.argv[2]
  if (!outputPath) {
    throw new Error('Usage: node verify-crm-outbox-replay.js <output-json-path>')
  }

  const crmOutbox = require('/tmp/realhibachi-crm002-dist/crm-outbox.js')
  const crmIntegration = require('/tmp/realhibachi-crm002-dist/crm-integration.js')

  const mockServer = await startMockCrmServer()
  process.env.CRM_INTEGRATION_BASE_URL = `http://127.0.0.1:${mockServer.port}`
  process.env.CRM_INTEGRATION_SHARED_SECRET = 'crm_shared_secret_test'
  process.env.CRM_INTEGRATION_PARTNER_ID = 'official_website'
  process.env.CRM_INTEGRATION_SOURCE = 'official_website'
  process.env.CRM_INTEGRATION_MAX_ATTEMPTS = '4'

  const db = new InMemorySupabase()

  const built = crmIntegration.buildDepositPaidEventEnvelope({
    stripeEventId: 'evt_test_crm002_1',
    session: {
      id: 'cs_test_crm002_1',
      livemode: false,
      created: 1762550400,
      amount_total: 15000,
      metadata: {
        booking_id: 'booking-crm-002',
        customer_name: 'Darrien Wang',
        event_date: '2026-03-15',
        event_time: '7:30 PM',
        location: 'Los Angeles, CA',
      },
      customer_details: {
        email: 'darrien.wang@gmail.com',
      },
    },
    booking: {
      id: 'booking-crm-002',
      full_name: 'Darrien Wang',
      phone: '+1-310-555-1212',
      email: 'darrien.wang@gmail.com',
      event_date: '2026-03-15',
      event_time: '7:30 PM',
      address: '123 Main St, Los Angeles, CA',
      guest_adults: 10,
      guest_kids: 2,
      total_cost: 900,
      travel_fee: 50,
      special_requests: 'No onion',
      deposit_amount: 150,
    },
    paymentIntentId: 'pi_test_crm002_1',
    depositAmount: 150,
  })

  ensure(built.ok, 'Failed to build CRM envelope for outbox verification.')
  const envelope = built.envelope

  const enqueueInitial = await crmOutbox.enqueueCrmOutboxEvent(db, {
    eventId: envelope.event_id,
    eventType: envelope.event_type,
    payload: envelope,
    maxAttempts: 4,
  })

  ensure(enqueueInitial.ok && !enqueueInitial.deduped, 'Initial enqueue should create a pending outbox row.')

  const enqueueDeduped = await crmOutbox.enqueueCrmOutboxEvent(db, {
    eventId: envelope.event_id,
    eventType: envelope.event_type,
    payload: envelope,
    maxAttempts: 4,
  })

  ensure(enqueueDeduped.ok && enqueueDeduped.deduped, 'Second enqueue with same payload should dedupe.')

  const envelopeConflict = JSON.parse(JSON.stringify(envelope))
  envelopeConflict.payment.amount_cents = envelope.payment.amount_cents + 1

  const enqueueConflict = await crmOutbox.enqueueCrmOutboxEvent(db, {
    eventId: envelope.event_id,
    eventType: envelope.event_type,
    payload: envelopeConflict,
    maxAttempts: 4,
  })

  ensure(!enqueueConflict.ok && enqueueConflict.conflict, 'Conflicting payload hash should be rejected.')

  const firstDelivery = await crmOutbox.deliverCrmOutboxRecord(db, enqueueInitial.record)
  ensure(firstDelivery.ok, 'First delivery should execute and return a result.')
  ensure(firstDelivery.state === 'failed', 'First delivery should fail and set failed status.')

  const failedRow = db.findOutboxByEventId(envelope.event_id)
  ensure(Boolean(failedRow), 'Failed outbox row should be persisted.')
  const failedSnapshot = failedRow
    ? {
        attempt_count: failedRow.attempt_count,
        last_attempt_at: failedRow.last_attempt_at,
        last_error: failedRow.last_error,
        status: failedRow.status,
      }
    : null
  failedRow.next_attempt_at = new Date(Date.now() - 5_000).toISOString()

  const replayResult = await crmOutbox.replayCrmOutboxBatch(db, 20)
  const finalRow = db.findOutboxByEventId(envelope.event_id)

  ensure(replayResult.summary.sent === 1, 'Replay should send one failed event.')
  ensure(finalRow && finalRow.status === 'sent', 'Final outbox row should be sent.')

  const assertions = {
    initial_enqueue_pending: enqueueInitial.ok && enqueueInitial.record.status === 'pending',
    dedupe_same_event_id: enqueueDeduped.ok && enqueueDeduped.deduped,
    conflict_on_hash_mismatch: !enqueueConflict.ok && enqueueConflict.conflict,
    first_delivery_failed_state: firstDelivery.ok && firstDelivery.state === 'failed',
    failed_row_has_operational_fields: Boolean(
      failedSnapshot &&
        failedSnapshot.status === 'failed' &&
        failedSnapshot.attempt_count === 1 &&
        failedSnapshot.last_attempt_at &&
        failedSnapshot.last_error,
    ),
    replay_transitions_to_sent: replayResult.summary.sent === 1,
    final_row_sent_with_metrics: Boolean(finalRow && finalRow.status === 'sent' && finalRow.attempt_count === 2 && finalRow.response_status === 200 && finalRow.last_request_id),
  }

  const response = {
    ok: Object.values(assertions).every(Boolean),
    assertions,
    outbox_event_id: envelope.event_id,
    first_delivery_state: firstDelivery.ok ? firstDelivery.state : 'error',
    replay_summary: replayResult.summary,
    failed_snapshot: failedSnapshot,
    final_row: finalRow,
    crm_request_count: mockServer.requests.length,
    crm_requests: mockServer.requests.map((req) => ({
      attempt: req.attempt,
      status_expected: req.attempt === 1 ? 400 : 200,
      request_id: req.headers['x-request-id'],
      signature_present: typeof req.headers['x-signature'] === 'string' && req.headers['x-signature'].startsWith('v1='),
      event_id: req.body?.event_id,
      event_type: req.body?.event_type,
    })),
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(response, null, 2)}\n`, 'utf8')
  await mockServer.close()

  if (!response.ok) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  const outputPath = process.argv[2]
  if (outputPath) {
    const failure = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    }
    fs.writeFileSync(outputPath, `${JSON.stringify(failure, null, 2)}\n`, 'utf8')
  }
  process.exit(1)
})
