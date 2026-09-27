-- 结算明细化（2026-09-27 用户定的三条规则）：
--   人头费 = 费率 × (大人 + 0.5×收费小孩)，免费小孩(3-4岁$0)不算
--   桌椅   = $4 × 带桌椅的人头（大人小孩全算）
--   路费   = 超出 50 mi 的部分 × $1/mi（客户那头免不免都照给）
-- 三项平时按发票现算；结算那一刻冻结到列里，之后改规则不改历史。
alter table order_staff_assignments
  add column if not exists tables_cents integer,
  add column if not exists travel_cents integer,
  add column if not exists comp_breakdown jsonb,
  add column if not exists has_tables_override boolean;

-- 对账单：lines 是结算那一刻的完整明细快照（师傅打开链接看的就是它），
-- token 是链接钥匙。快照不可变——这是"信任"的根：发出去的单子永远长那样。
alter table chef_settlements
  add column if not exists tables_cents integer not null default 0,
  add column if not exists travel_cents integer not null default 0,
  add column if not exists lines jsonb,
  add column if not exists token text,
  add column if not exists statement_sent_at timestamptz;
create unique index if not exists chef_settlements_token_idx on chef_settlements (token) where token is not null;
