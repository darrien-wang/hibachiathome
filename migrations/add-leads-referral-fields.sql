-- Referral/BD attribution foundation (2026-09-01).
--
-- Adds first-class referral columns to `leads` so partner commissions can be
-- reconciled with a query instead of digging through raw_payload_json.
-- The website only writes these when a value is present, so run this BEFORE
-- deploying the quote-form change: an insert that carries referral_code while
-- the column is missing fails the whole lead upsert (email fallback catches
-- it, but the lead loses its attribution).
--
-- Apply in the Supabase SQL editor (service role bypasses RLS; no policy
-- changes needed — see enable-row-level-security.sql).

ALTER TABLE leads ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hear_about_us text;

COMMENT ON COLUMN leads.referral_code IS 'Referral/partner promo code entered at intake (uppercased, first touch wins — later submissions never overwrite it).';
COMMENT ON COLUMN leads.hear_about_us IS 'Self-reported discovery channel from the quote form (friend_family, vendor, host_planner, past_party, google, ...). Backstop when the code was forgotten.';

-- Commission reconciliation runs "which leads carry code X" — index only the
-- rows that have one.
CREATE INDEX IF NOT EXISTS idx_leads_referral_code
  ON leads (referral_code)
  WHERE referral_code IS NOT NULL;
