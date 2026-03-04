-- Stripe webhook event dedupe ledger for idempotent processing.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  stripe_object_id VARCHAR(255),
  livemode BOOLEAN NOT NULL DEFAULT FALSE,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type_received_at
  ON stripe_webhook_events(event_type, received_at DESC);
