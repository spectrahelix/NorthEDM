-- Card payments on wallet-rail (Gambian) shops. The customer pays NorthEDM's
-- Stripe; nothing can be transferred to a Gambian shop or runner through
-- Stripe, so the shop's 80%, the coordinator's 10% and the runner's fee are
-- owed BY the owner and sent to the coordinator (Remitly) to disburse locally.
-- collected_by says which direction a sale row points:
--   coordinator  the coordinator holds the money and owes the owner his share
--   owner        the owner holds the money and owes the coordinator the rest
alter table public.coordinator_ledger
  add column if not exists collected_by text not null default 'coordinator',
  add column if not exists store_order_id uuid references public.store_orders(id) on delete set null;
-- kind = 'payout': owner → coordinator, for owner-collected sales (gross_cents
-- in the shop currency as received locally; note carries the USD sent).
create unique index if not exists coordinator_ledger_one_sale_per_store_order
  on public.coordinator_ledger (store_order_id) where kind = 'sale';
