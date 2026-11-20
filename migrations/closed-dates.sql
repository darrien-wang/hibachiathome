-- 2026-11-19: days we take no more bookings on (owner: "12/5 号现在可以关闭了
-- 不能再接了", then "除非可以连台的").
--
-- A row closes its day: the lock page refuses a new booking for it (an
-- existing booking on the day still opens as locked), the instant quote text
-- leaves out the lock link, and the lead watch does not text "the date is
-- open" - it hands the lead to a person. A party that can chain onto one the
-- day already has is the owner's call: the desk deletes the row while that
-- customer locks, then puts it back.
--
-- Server-side only: RLS on, no policies (the service role reads it).
-- Applied to production with the Supabase MCP on 2026-11-19.

create table if not exists public.closed_dates (
  day date primary key,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.closed_dates enable row level security;

comment on table public.closed_dates is
  'Days closed to new bookings (2026-11-19). Read by /api/deposit/start, /api/landing-quote and the lead watch.';
