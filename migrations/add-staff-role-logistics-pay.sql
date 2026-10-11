-- 2026-10-11: 厨师 -> 员工. Staff now has a role (chef / logistics).
-- Logistics (prep & stocking) is paid per head of every party held from
-- pay_start_date on: adults 1, paying kids 0.5, free littles 0, times
-- staff_members.per_head_cents. Settled weekly (Mon-Sun, paid Sunday).
-- staff_order_pay is the "paid once" ledger: one row per staff + order,
-- written when a logistics settlement is made, removed when it is undone.

alter table staff_members add column if not exists role text not null default 'chef';
alter table staff_members drop constraint if exists staff_members_role_check;
alter table staff_members add constraint staff_members_role_check check (role in ('chef', 'logistics'));
alter table staff_members add column if not exists pay_start_date date;

create table if not exists staff_order_pay (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references staff_members(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  settlement_id uuid references chef_settlements(id) on delete cascade,
  event_date date,
  heads numeric(8, 1) not null default 0,
  cents integer not null default 0,
  created_at timestamptz not null default now(),
  unique (staff_member_id, order_id)
);
create index if not exists staff_order_pay_settlement_idx on staff_order_pay (settlement_id);
alter table staff_order_pay enable row level security;
