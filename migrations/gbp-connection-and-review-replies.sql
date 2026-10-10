-- Google 商家资料 API 接进好评台账（2026-10-09，已应用：supabase migration gbp_connection_and_review_replies）
-- 只加不改：老代码不读这些列，先上库再上代码。

-- 1) 台账每行记住它在商家资料里的评价 id（回复靠它，以后同步也靠它精确对）+ 回复状态
alter table business_reviews add column if not exists gbp_review_id text;
create unique index if not exists business_reviews_gbp_review_id_key on business_reviews (gbp_review_id) where gbp_review_id is not null;
alter table business_reviews add column if not exists reply_comment text;
alter table business_reviews add column if not exists reply_updated_at timestamptz;
-- Google 的 reviewReplyState：APPROVED / PENDING（审核中）/ REJECTED
alter table business_reviews add column if not exists reply_state text;
-- 从工作台发的回复记谁发的；同步时看到 Google 上的回复变了（比如在商家后台直接回的）就清空
alter table business_reviews add column if not exists reply_by text;

-- 2) 连接信息：只有一行。refresh token 是应用层加密后的密文（lib/gbp.ts sealToken），
--    表开 RLS、不给 anon/authenticated 任何权限 —— 只有服务端（service role）读得到。
create table if not exists gbp_connection (
  id text primary key default 'default' check (id = 'default'),
  google_email text,
  account_name text,
  location_name text,
  location_title text,
  place_id text,
  maps_uri text,
  locations jsonb not null default '[]'::jsonb,
  refresh_token_enc text,
  scopes text,
  connected_at timestamptz,
  connected_by text,
  pending_state text,
  pending_verifier_enc text,
  pending_expires_at timestamptz,
  pending_by text,
  last_sync_at timestamptz,
  last_sync jsonb,
  last_error text,
  last_error_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table gbp_connection enable row level security;
revoke all on table gbp_connection from anon, authenticated;
