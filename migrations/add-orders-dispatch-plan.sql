-- 2026-10-18: the order's dispatch plan - how many chefs and grills a party
-- gets, where they stand, and why (rule by paid heads / owner override /
-- a promise made to the customer in a text or email).
--
-- Eileen Heng, RH-20260919-0223 (2026-10-17): the desk had promised "two U
-- shapes, each chef at an open end" and "two stations"; the order said
-- required_staff_count = 1, the prep sheet had no notes, dispatch had one lead
-- chef and a helper. Nothing carried the promise to the day. This column does.
--
-- Shape (lib/dispatch-plan.ts in both repos):
--   { chefs, grills, stations_note?, source: "rule" | "owner" | "promise",
--     promise?: { chefs, grills, text, sid, at, via, lead_id, stations_note? },
--     heads?, set_by?, set_at? }
-- required_staff_count stays as a mirror of chefs for anything that reads it.
-- Promises themselves are lead_touchpoints rows: touchpoint_type 'promise',
-- touchpoint_source 'promise_capture', external_touchpoint_id '<sms|email>:<id>'.

alter table orders add column if not exists dispatch_plan jsonb;
comment on column orders.dispatch_plan is 'Chefs / grills / stations for this party and where the number came from (rule, owner, promise). lib/dispatch-plan.ts.';
