-- 2026-11-13: the day map's three tabs each keep their own picks, and the
-- owner's final route is saved.
--
-- Owner: "这三个tab 数据之间不能串 而且要保存我最终选择的路线" /
-- "我选择师傅之后的数据不能串". Before this, picking people on a tab wrote
-- straight to order_staff_assignments, so every tab showed the same people.
-- Now picks on a tab are a draft (drafts[tab][order_id] = staff ids). Saving a
-- tab writes its draft to the orders (quietly - "通知改动" texts the chefs) and
-- marks it chosen_key; opening the day map goes back to that tab.
--
-- Applied to production with the Supabase MCP on 2026-11-13.

create table if not exists public.dispatch_day_plans (
  day date primary key,
  chosen_key text,
  drafts jsonb not null default '{}'::jsonb,
  saved_at timestamptz,
  saved_by text,
  updated_at timestamptz not null default now()
);

alter table public.dispatch_day_plans enable row level security;

comment on table public.dispatch_day_plans is
  'Day map (workbench) per-day route: chosen_key = the tab saved as final; drafts = per-tab picks not yet saved, {tab: {order_id: [staff ids]}}. Server-only (service role).';
