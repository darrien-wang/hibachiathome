-- Canonical leads table + append-only touchpoint log for dedupe-safe lead counting.
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  normalized_phone VARCHAR(20),
  lead_source VARCHAR(120) NOT NULL DEFAULT 'unknown',
  lead_channel VARCHAR(80) NOT NULL DEFAULT 'unknown',
  lead_type VARCHAR(80) NOT NULL DEFAULT 'booking_inquiry',
  inquiry_reason VARCHAR(120),
  source_page VARCHAR(255),
  city_or_zip VARCHAR(120),
  guest_count INTEGER,
  first_message TEXT,
  latest_message TEXT,
  utm_source VARCHAR(120),
  utm_medium VARCHAR(120),
  utm_campaign VARCHAR(160),
  utm_term VARCHAR(255),
  utm_content VARCHAR(255),
  gclid VARCHAR(255),
  wbraid VARCHAR(255),
  gbraid VARCHAR(255),
  external_call_id VARCHAR(120),
  manual_entry_id VARCHAR(120),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  touchpoint_count INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE leads
    ADD CONSTRAINT leads_status_check
    CHECK (status IN ('new', 'qualified', 'disqualified', 'won', 'lost'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS idx_leads_last_seen_at
  ON leads(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_normalized_phone
  ON leads(normalized_phone);

CREATE INDEX IF NOT EXISTS idx_leads_email
  ON leads(email);

CREATE INDEX IF NOT EXISTS idx_leads_source_type
  ON leads(lead_source, lead_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_external_call_id_unique
  ON leads(external_call_id)
  WHERE external_call_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_manual_entry_id_unique
  ON leads(manual_entry_id)
  WHERE manual_entry_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS lead_touchpoints (
  id BIGSERIAL PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  touchpoint_type VARCHAR(80) NOT NULL DEFAULT 'contact_form',
  touchpoint_source VARCHAR(120) NOT NULL DEFAULT 'website_api',
  external_touchpoint_id VARCHAR(120),
  raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_touchpoints_lead_id
  ON lead_touchpoints(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_touchpoints_occurred_at
  ON lead_touchpoints(occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_touchpoints_source_external_unique
  ON lead_touchpoints(touchpoint_source, external_touchpoint_id)
  WHERE external_touchpoint_id IS NOT NULL;
