-- 对账单先发、后结清（老板 2026-11-09："先发送对账单，然后再结清"，师傅口头确认，系统不做确认）。
-- draft = 已发给师傅、还没结清（场次不动，可以重发）；settled = 结清；void = 发过、后来作废。
-- 一个师傅同时只有一张 draft；结清时沿用那张的链接。applied 2026-11-09.
alter table public.chef_settlements add column if not exists status text not null default 'settled';
alter table public.chef_settlements add constraint chef_settlements_status_check check (status in ('draft', 'settled', 'void'));
alter table public.chef_settlements add column if not exists settled_at timestamptz;
update public.chef_settlements set settled_at = created_at where settled_at is null and status = 'settled';
create unique index if not exists chef_settlements_one_draft on public.chef_settlements (staff_member_id) where status = 'draft';
