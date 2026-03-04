-- Canonical deposit state fields on bookings for Stripe-driven attribution.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2);

-- Backfill new fields from legacy deposit data where possible.
UPDATE bookings
SET
  deposit_amount = COALESCE(deposit_amount, deposit, 0),
  deposit_status = COALESCE(
    NULLIF(deposit_status, ''),
    CASE
      WHEN COALESCE(deposit, 0) > 0 THEN 'paid'
      ELSE 'pending'
    END
  )
WHERE deposit_amount IS NULL
  OR deposit_status IS NULL
  OR deposit_status = '';

DO $$
BEGIN
  ALTER TABLE bookings
    ADD CONSTRAINT bookings_deposit_status_check
    CHECK (deposit_status IN ('pending', 'paid', 'refunded'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_stripe_session_id_unique
  ON bookings(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_payment_intent_id_unique
  ON bookings(payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_deposit_status
  ON bookings(deposit_status);
