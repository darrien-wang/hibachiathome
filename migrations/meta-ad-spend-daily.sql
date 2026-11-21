-- 2026-11-21: Meta spend below the campaign (owner: "Meta 花费现在就接进数据库吧").
--
-- ad_spend_daily carries Meta at campaign x day, which is right for the
-- channel scorecard but not for the judgments in the ads research ledger:
-- they are made per ad set (la_oc_sched vs destination_sched) and per ad, and
-- that spend was being copied out of Ads Manager by hand.
--
-- One row per ad x day, the finest grain Meta reports; ad set and campaign
-- totals are sums of it. It is a detail table next to ad_spend_daily, not a
-- second source of channel spend: nothing that totals a channel reads it, so
-- the campaign rows in ad_spend_daily are not counted twice.
--
-- Written by POST /api/admin/ad-spend?action=sync_meta (hourly pg_cron job
-- ad-spend-sync-hourly, same call that refreshes the campaign rows).
-- clicks = link clicks (comparable to Google's clicks); all_clicks = Meta's
-- "clicks (all)". platform_leads = Meta's own "lead" action count, reference
-- only - leads and orders come from our tables by utm_term / utm_content.
--
-- Server-side only: RLS on, no policies (the service role reads it).
-- Applied to production with the Supabase MCP on 2026-11-21.

create table if not exists public.meta_ad_spend_daily (
  account_id text not null,
  date date not null,
  campaign_id text not null,
  campaign_name text,
  adset_id text not null,
  adset_name text,
  ad_id text not null,
  ad_name text,
  impressions integer not null default 0,
  clicks integer not null default 0,
  all_clicks integer not null default 0,
  cost_cents integer not null default 0,
  platform_leads numeric not null default 0,
  synced_by text,
  updated_at timestamptz not null default now(),
  primary key (account_id, ad_id, date)
);

create index if not exists meta_ad_spend_daily_date_idx on public.meta_ad_spend_daily (date);

alter table public.meta_ad_spend_daily enable row level security;

comment on table public.meta_ad_spend_daily is
  'Meta spend per ad x day (2026-11-21). Detail under ad_spend_daily''s campaign rows; never add it to channel totals.';
