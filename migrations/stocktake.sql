-- 师傅盘点（2026-11-26，lib/stocktake.ts）。盘完写 pantry_stock；这几张表留底：谁、什么时候、怎么数出来的。

-- 每位师傅一条长期有效的盘点链接（/tools/stock?t=…），和好评榜的 review_token 分开：那条只能看榜，这条能改库存。
alter table public.staff_members add column if not exists stock_token text;
create unique index if not exists staff_members_stock_token_key on public.staff_members (stock_token) where stock_token is not null;

-- 师傅自己加的包装规格（"毛豆 Costco 16oz/包"）。加了就能用，老板可以收起（archived_at）。
create table if not exists public.stock_specs (
  id uuid primary key default gen_random_uuid(),
  item_key text not null,
  label text not null,
  amount numeric not null check (amount > 0),
  unit text not null check (unit in ('oz', 'lb', 'piece', 'base')),
  created_by text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists stock_specs_item_idx on public.stock_specs (item_key) where archived_at is null;
alter table public.stock_specs enable row level security;

-- 一次盘点（一次提交）。
create table if not exists public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid references public.staff_members (id) on delete set null,
  counted_by text not null,
  via text not null default 'link',
  note text,
  created_at timestamptz not null default now()
);
create index if not exists stock_counts_created_idx on public.stock_counts (created_at desc);
alter table public.stock_counts enable row level security;

-- 一次盘点里的一样东西：怎么数的（lines：整包规格 × 几包 / 散的称重或个数）、合计、盘之前账上是多少。
-- 补货型（米油酱）不数量，只记 level：ok 够 / low 快没了 / out 没了。
create table if not exists public.stock_count_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.stock_counts (id) on delete cascade,
  item_key text not null,
  lines jsonb not null default '[]'::jsonb,
  base_qty numeric,
  unit text,
  prev_qty numeric,
  level text check (level is null or level in ('ok', 'low', 'out')),
  created_at timestamptz not null default now()
);
create index if not exists stock_count_items_item_idx on public.stock_count_items (item_key, created_at desc);
alter table public.stock_count_items enable row level security;
