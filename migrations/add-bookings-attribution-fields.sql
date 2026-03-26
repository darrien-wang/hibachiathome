-- Persist first-touch attribution on each booking so paid orders can be traced back to ad source.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS utm_source VARCHAR(120),
  ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(120),
  ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(160),
  ADD COLUMN IF NOT EXISTS utm_term VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_content VARCHAR(255),
  ADD COLUMN IF NOT EXISTS gclid VARCHAR(255),
  ADD COLUMN IF NOT EXISTS wbraid VARCHAR(255),
  ADD COLUMN IF NOT EXISTS gbraid VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_bookings_utm_source
  ON bookings(utm_source);

CREATE INDEX IF NOT EXISTS idx_bookings_utm_campaign
  ON bookings(utm_campaign);

CREATE INDEX IF NOT EXISTS idx_bookings_gclid
  ON bookings(gclid);
