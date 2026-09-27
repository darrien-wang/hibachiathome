-- 好评主档（2026-09-28，已应用）：Google/Yelp 上关于我们的每条评价存一行，
-- 手动刷新/agent 导入都进这里，(platform, external_key) 唯一 => 不会重复。
-- 记给师傅的奖励仍走 chef_review_bonuses（结算账本），两边互相指：
-- 一条评价最多挂一个 bonus => 不能重复计钱。
create table if not exists business_reviews (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('google','yelp','other')),
  external_key text not null,
  reviewer text,
  rating int,
  review_date date,
  body text,
  url text,
  has_photo boolean not null default false,
  photo_count int not null default 0,
  staff_member_id uuid references staff_members(id) on delete set null,
  bonus_id uuid references chef_review_bonuses(id) on delete set null,
  source text not null default 'manual',
  raw jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_by text,
  unique (platform, external_key)
);
create index if not exists business_reviews_date_idx on business_reviews (review_date desc);
-- 同日：chef_review_bonuses 加 review_id + url（对账单里能点开原文）
alter table chef_review_bonuses add column if not exists review_id uuid references business_reviews(id) on delete set null;
alter table chef_review_bonuses add column if not exists url text;
