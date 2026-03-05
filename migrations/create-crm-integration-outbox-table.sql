-- Durable outbox for website -> CRM integration events.
CREATE TABLE IF NOT EXISTS crm_integration_outbox (
  id BIGSERIAL PRIMARY KEY,
  event_id VARCHAR(120) NOT NULL UNIQUE,
  event_type VARCHAR(80) NOT NULL,
  payload_json JSONB NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 10,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  response_status INTEGER,
  response_body JSONB,
  last_error TEXT,
  last_request_id VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_integration_outbox_status_check
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'dead_letter')),
  CONSTRAINT crm_integration_outbox_attempt_count_check
    CHECK (attempt_count >= 0),
  CONSTRAINT crm_integration_outbox_max_attempts_check
    CHECK (max_attempts > 0)
);

CREATE INDEX IF NOT EXISTS idx_crm_integration_outbox_status_next_attempt
  ON crm_integration_outbox(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_crm_integration_outbox_event_type_status
  ON crm_integration_outbox(event_type, status);

CREATE INDEX IF NOT EXISTS idx_crm_integration_outbox_created_at
  ON crm_integration_outbox(created_at DESC);

UPDATE crm_integration_outbox
SET next_attempt_at = COALESCE(next_attempt_at, NOW())
WHERE next_attempt_at IS NULL;
