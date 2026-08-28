-- Enable Row Level Security (RLS) on all public tables holding customer data.
--
-- WHY: tables created with raw `CREATE TABLE` have RLS DISABLED by default.
-- With RLS off, anyone holding the public NEXT_PUBLIC_SUPABASE_ANON_KEY (which
-- ships inside the browser bundle) can read and write these tables directly
-- through Supabase's PostgREST API - exposing customer PII (names, emails,
-- phones, addresses) and allowing tampering.
--
-- Enabling RLS with NO policies = the anon/authenticated roles are denied by
-- default. Server-side code uses SUPABASE_SERVICE_ROLE_KEY (see lib/supabase.ts
-- -> createServerSupabaseClient), which BYPASSES RLS, so the backend keeps
-- working unchanged. That was not true when this file was written: the four
-- server actions in app/actions/booking.ts built their client with the ANON key,
-- so enabling RLS on bookings would have broken /deposit/pay, which reads a
-- booking through getBookingDetails. They were switched to the service role
-- first. Check for anon-key queries again before running this on a new schema. Add explicit CREATE POLICY statements
-- later only if/when the browser must read specific rows.
--
-- Safe to run multiple times.

DO $$
DECLARE
  t text;
BEGIN
  -- Every table in public, not a hand-written list. The original list named six
  -- tables; the schema actually has 29, and the ones it omitted included
  -- gmail_accounts, gmail_messages and invoice_tokens. A list has to be
  -- maintained and this one already was not, so enumerate instead.
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    -- FORCE also applies RLS to the table owner, closing the gap if the owner
    -- role is ever used from a non-service context. Roles with BYPASSRLS -
    -- which is what service_role has - are unaffected either way.
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    RAISE NOTICE 'RLS enabled on public.%', t;
  END LOOP;
END $$;

-- Verify afterwards in the Supabase SQL editor:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- Every row should show rowsecurity = true.
