-- Enable Row Level Security (RLS) on all public tables holding customer data.
--
-- WHY: tables created with raw `CREATE TABLE` have RLS DISABLED by default.
-- With RLS off, anyone holding the public NEXT_PUBLIC_SUPABASE_ANON_KEY (which
-- ships inside the browser bundle) can read and write these tables directly
-- through Supabase's PostgREST API - exposing customer PII (names, emails,
-- phones, addresses) and allowing tampering.
--
-- Enabling RLS with NO policies = the anon/authenticated roles are denied by
-- default. All server-side code in this app uses the SUPABASE_SERVICE_ROLE_KEY
-- (see lib/supabase.ts -> createServerSupabaseClient), which BYPASSES RLS, so
-- the backend keeps working unchanged. Add explicit CREATE POLICY statements
-- later only if/when the browser must read specific rows.
--
-- Safe to run multiple times.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'bookings',
    'deposits',
    'leads',
    'lead_touchpoints',
    'crm_integration_outbox',
    'stripe_webhook_events'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      -- FORCE also applies RLS to the table owner, closing the gap if the
      -- owner role is ever used from a non-service context.
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
      RAISE NOTICE 'RLS enabled on public.%', t;
    ELSE
      RAISE NOTICE 'Skipped (missing): public.%', t;
    END IF;
  END LOOP;
END $$;

-- Verify afterwards in the Supabase SQL editor:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- Every table above should show rowsecurity = true.
