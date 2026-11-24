-- 外包单结算（老板 2026-11-23）：外包单可以指派给不同的合作公司，工作台「外包」页按公司对账、结清。
-- 用的是早就建好、一直空着的两张表：partners（合作公司）和 order_partner_allocations（一单一行分账）。
-- 外包标记本身还在 orders.dispatch_plan.outsourced（lib/outsourced.ts）；这里只记「给了哪家、怎么分、结没结」。
--
-- 一单一行 role='contractor' 的分账（没作废的只能有一行）：
--   rate_bps        = 我们拿的比例（3000 = 30%，含路费，按订单总价算）
--   status          = pending（待结）→ paid（我们付给对方）/ received（对方付给我们）；改回直营 = voided
--   amount_cents / direction = 结清时实际过手的钱和方向
--   total_cents / our_cut_cents / collected_cents = 结清那一刻的快照：订单总价、我们该拿、钱在我们手上的部分

alter table public.partners add column if not exists default_rate_bps integer not null default 3000
  check (default_rate_bps between 0 and 10000);
alter table public.partners add column if not exists active boolean not null default true;

alter table public.order_partner_allocations add column if not exists total_cents integer;
alter table public.order_partner_allocations add column if not exists our_cut_cents integer;
alter table public.order_partner_allocations add column if not exists collected_cents integer;
alter table public.order_partner_allocations add column if not exists settled_at timestamptz;
alter table public.order_partner_allocations add column if not exists settled_by text;
alter table public.order_partner_allocations add column if not exists settle_method text;

create unique index if not exists order_partner_allocations_one_contractor
  on public.order_partner_allocations (order_id)
  where role = 'contractor' and status <> 'voided';

-- RLS 本来就开着（两张表都是），这里再写一遍，防止以后重建表时漏掉。
alter table public.partners enable row level security;
alter table public.order_partner_allocations enable row level security;

insert into public.partners (name, partner_type, default_rate_bps, notes)
select v.name, 'contractor', 3000, v.notes
from (values
  ('Meet Hibachi', '外包合作公司（2026-11-23 加）'),
  ('JustOne Hibachi', '外包合作公司（2026-11-23 加）')
) as v(name, notes)
where not exists (select 1 from public.partners p where lower(p.name) = lower(v.name));
