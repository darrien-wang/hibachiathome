-- 结算前先知道这场的尾款怎么收的。派单的时候还不知道，所以这些列一开始都是空，
-- 派对办完老板在工作台上点一下才填上，填了才进"本期结算"。
--   cash    师傅现场代收现金（cash_collected_cents 记他手上拿了多少）
--   card    客人刷卡，钱进我们 Stripe；净额超过应收尾款的部分 = 师傅的小费
--   prepaid 早就付清了 / Zelle / Venmo 之类，师傅没经手钱
--   other   其它，settlement_note 说明
alter table order_staff_assignments
  add column if not exists settlement_method text
    check (settlement_method is null or settlement_method in ('cash', 'card', 'prepaid', 'other')),
  add column if not exists settlement_at timestamptz,
  add column if not exists card_gross_cents integer,
  add column if not exists card_fee_cents integer,
  add column if not exists card_tip_cents integer,
  add column if not exists cash_tip_cents integer,
  add column if not exists settlement_ref text,
  add column if not exists settlement_note text;

comment on column order_staff_assignments.card_tip_cents is 'Stripe 实收净额 − 应收尾款；这笔钱在我们手上，结算时要给师傅';
comment on column order_staff_assignments.cash_tip_cents is '客人当场塞给师傅的现金小费，师傅自己留着，不进净额，只做记录';

-- 刷卡的小费是客人给师傅的，钱先落在我们 Stripe，结算时转给他。
-- 净额 = 工钱 + 报销 + 卡上小费 − 代收现金。
alter table chef_settlements add column if not exists tip_cents integer not null default 0;
