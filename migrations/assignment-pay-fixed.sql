-- 2026-11-13: a flat pay for one shift, set on the settlement page.
--
-- The day map now dispatches by plain multi-select: no separate "helper" pick
-- (owner 2026-11-13, "不要区分helper"). Everyone on a party is a lead_chef row.
-- When someone only came along to help, the owner sets their pay on the
-- settlement page instead ("给易非 200 作为 helper 的工资").
--
-- pay_fixed_cents not null = this shift pays exactly that amount, all-in:
-- no headcount pay, no tables/chairs, no travel, no prep fee. The person also
-- drops out of the headcount split, so the other chefs keep the share they
-- would have had without them.
--
-- Applied to production with the Supabase MCP on 2026-11-13.

alter table public.order_staff_assignments
  add column if not exists pay_fixed_cents integer
  check (pay_fixed_cents is null or pay_fixed_cents >= 0);

comment on column public.order_staff_assignments.pay_fixed_cents is
  'Flat all-in pay for this shift set on the settlement page (2026-11-13). Not null = no headcount/tables/travel/prep math, and the person is left out of the headcount split.';
