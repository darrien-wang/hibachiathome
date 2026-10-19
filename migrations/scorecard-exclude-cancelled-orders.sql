-- 2026-10-18: cancelled orders leave the scoreboard.
--
-- channel_scorecard_daily counted every deposit_status = 'paid_verified' order
-- as a 单 (and its quoted total as revenue) by the day it was created, with no
-- look at order_status. Isabella Reyna locked Sat 11/7 (30 adults, $1,707) at
-- 16:28 and cancelled at 18:08 the same day; the board kept "10/18 · 1 单"
-- and the owner asked whether cancelled ones should come off. They should:
-- the board is "what did the money buy", and a cancelled party bought nothing.
-- Leads are untouched (she still counts as a lead). Same filter as
-- /api/admin/month-stats, which already drops order_status = 'cancelled'.
--
-- Applied to production with the Supabase MCP on 2026-10-18 (CREATE OR REPLACE
-- keeps the column list identical, so /api/admin/channels needs no change).

CREATE OR REPLACE VIEW public.channel_scorecard_daily AS
WITH spend AS (
  SELECT ad_spend_daily.date AS d,
         ad_spend_daily.channel,
         sum(ad_spend_daily.cost_cents) AS cost_cents,
         sum(ad_spend_daily.clicks) AS clicks,
         sum(ad_spend_daily.impressions) AS impressions,
         sum(ad_spend_daily.platform_conversions) AS platform_conversions
  FROM ad_spend_daily
  GROUP BY ad_spend_daily.date, ad_spend_daily.channel
), lead_rows AS (
  SELECT lead_attribution.pt_date AS d,
         lead_attribution.channel,
         count(*) FILTER (WHERE lead_attribution.counts_as_lead) AS leads,
         count(*) FILTER (WHERE lead_attribution.counts_as_lead
                            AND (lead_attribution.status::text = ANY (ARRAY['qualified'::character varying, 'won'::character varying]::text[]))) AS leads_qualified
  FROM lead_attribution
  GROUP BY lead_attribution.pt_date, lead_attribution.channel
), deposits AS (
  SELECT (orders.created_at AT TIME ZONE 'America/Los_Angeles'::text)::date AS d,
         COALESCE(orders.acquisition_channel, 'unresolved'::text) AS channel,
         count(*) AS deposits,
         sum(COALESCE(orders.quoted_total_cents, 0)) AS revenue_cents
  FROM orders
  WHERE orders.deposit_status = 'paid_verified'::text
    AND COALESCE(orders.order_status, 'active') <> 'cancelled'
  GROUP BY ((orders.created_at AT TIME ZONE 'America/Los_Angeles'::text)::date),
           (COALESCE(orders.acquisition_channel, 'unresolved'::text))
), keys AS (
  SELECT spend.d, spend.channel FROM spend
  UNION
  SELECT lead_rows.d, lead_rows.channel FROM lead_rows
  UNION
  SELECT deposits.d, deposits.channel FROM deposits
)
SELECT k.d AS date,
       k.channel,
       rh_channel_group(k.channel) AS channel_group,
       COALESCE(s.cost_cents, 0::bigint) AS cost_cents,
       COALESCE(s.clicks, 0::bigint) AS clicks,
       COALESCE(s.impressions, 0::bigint) AS impressions,
       COALESCE(s.platform_conversions, 0::numeric) AS platform_conversions,
       COALESCE(lr.leads, 0::bigint) AS leads,
       COALESCE(lr.leads_qualified, 0::bigint) AS leads_qualified,
       COALESCE(dp.deposits, 0::bigint) AS deposits,
       COALESCE(dp.revenue_cents, 0::bigint) AS revenue_cents
FROM keys k
LEFT JOIN spend s ON s.d = k.d AND s.channel = k.channel
LEFT JOIN lead_rows lr ON lr.d = k.d AND lr.channel = k.channel
LEFT JOIN deposits dp ON dp.d = k.d AND dp.channel = k.channel;
