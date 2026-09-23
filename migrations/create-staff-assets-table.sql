-- Company property handed to a chef: uniform (cap, coat, apron), knives, gear.
-- One row per issuance, closed out by setting returned_on. Writes come from the
-- agent (see the chef-assets skill); the workbench only displays.
create table if not exists staff_assets (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references staff_members(id) on delete cascade,
  item_key text not null,
  label text not null,
  qty integer not null default 1 check (qty > 0),
  size text,
  issued_on date not null default ((now() at time zone 'America/Los_Angeles')::date),
  returned_on date,
  condition text,
  unit_cost_cents integer check (unit_cost_cents is null or unit_cost_cents >= 0),
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_assets_staff_idx on staff_assets (staff_member_id, returned_on, issued_on desc);

-- One issuance per (chef, item, day): re-sending the same record updates it
-- instead of handing the same cap out twice.
create unique index if not exists staff_assets_one_per_day
  on staff_assets (staff_member_id, item_key, issued_on);
