-- Owner asks (owner 2026-11-24): "需要我回复的时候在 App 上加个单独的响铃，平常你能自己回复的消息就不用在 App 上提醒了".
-- One row per question the desk puts to the owner in chat. While a row is open the workbench App rings its own
-- "需要你回复" channel; the desk closes it (answered_at) once the owner has answered, and an ask older than
-- OWNER_ASK_TTL_HOURS (lib/owner-asks.ts) stops ringing by itself.
create table if not exists public.owner_asks (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(btrim(question)) > 0),
  lead_id uuid null references public.leads(id) on delete set null,
  order_no text null,
  created_by text not null default 'desk',
  created_at timestamptz not null default now(),
  answered_at timestamptz null,
  answered_note text null
);

alter table public.owner_asks enable row level security;

create index if not exists owner_asks_open_idx on public.owner_asks (created_at desc) where answered_at is null;
