-- Manual lead merge, for the case automatic dedupe cannot reach.
--
-- WHY this cannot be solved by better matching: dedupe keys off a shared field
-- (external_call_id, manual_entry_id, normalized_phone, email). An inbound call
-- carries only a phone number; an email inquiry carries only an email. When the
-- same person uses both, the two rows share nothing, so no rule can link them.
-- A human recognises them; the database cannot. Hence a manual merge.
--
-- WHY mark instead of delete: the merged-away row still holds the original
-- touchpoint history and first-touch attribution. Marking keeps the merge
-- reversible (clear merged_into and the row returns), which matters because a
-- wrong merge on real customer data is otherwise unrecoverable.
--
-- Safe to run multiple times.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES leads (id) ON DELETE SET NULL;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMP WITH TIME ZONE;

-- The workbench lists only unmerged leads, so this is the hot path for the
-- list query: a partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_leads_unmerged
  ON leads (created_at DESC)
  WHERE merged_into IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_merged_into
  ON leads (merged_into)
  WHERE merged_into IS NOT NULL;
