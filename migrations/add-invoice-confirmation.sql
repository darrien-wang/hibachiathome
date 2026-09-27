-- 客户确认发票（2026-09-27）：老板总担心"订单没搞对"，根子是客户从来没有
-- 亲口对这版单子说过"对"。做法：
--   invoice_revision            invoice_data 每改一次 +1（触发器，谁写都算）
--   invoice_confirmed_revision  客户点确认那一刻的版本号
-- 两个对得上 = 已确认；发票又改过 = 自动打回"改后未确认"，工作台一眼看到。
alter table orders
  add column if not exists invoice_revision integer not null default 1,
  add column if not exists invoice_confirmed_at timestamptz,
  add column if not exists invoice_confirmed_revision integer,
  add column if not exists invoice_confirmed_by text;

create or replace function rh_bump_invoice_revision() returns trigger as $$
begin
  if new.invoice_data is distinct from old.invoice_data then
    new.invoice_revision := coalesce(old.invoice_revision, 1) + 1;
  end if;
  return new;
end
$$ language plpgsql;

drop trigger if exists trg_bump_invoice_revision on orders;
create trigger trg_bump_invoice_revision
  before update on orders
  for each row execute function rh_bump_invoice_revision();
