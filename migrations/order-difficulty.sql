-- 2026-11-13: a 1-5 difficulty estimate per order (owner: "哪种客人可能很麻烦很挑剔").
--
-- 1 = easiest, 5 = most work: picky or comparing quotes, haggling, allergies or a
-- medical diet, show expectations, a missing address, a heavy setup. The note is
-- one short paragraph on why, shown on the order dialog (where the rarely used
-- pay-link panel used to be) and as a "难 N" tag on the day map. Score 3+ on a
-- party whose team includes a newer chef is flagged on the map.
--
-- difficulty_source: 'ai' when the desk session scored it from the chat,
-- 'owner' when the owner set or changed it. An 'owner' score is never
-- overwritten by an 'ai' one ("以你改的为准").
--
-- Internal only: never shown to the customer or the chef.
-- Applied to production with the Supabase MCP on 2026-11-13.

alter table public.orders
  add column if not exists difficulty_score smallint check (difficulty_score between 1 and 5),
  add column if not exists difficulty_note text,
  add column if not exists difficulty_source text check (difficulty_source in ('ai', 'owner')),
  add column if not exists difficulty_by text,
  add column if not exists difficulty_at timestamptz;

comment on column public.orders.difficulty_score is
  '1-5 difficulty estimate (2026-11-13). Internal: order dialog + day map only.';
comment on column public.orders.difficulty_source is
  'ai = scored by the desk session from the chat; owner = set by the owner, never overwritten by ai.';
