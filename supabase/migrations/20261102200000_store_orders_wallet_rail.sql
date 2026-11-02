-- Embedded-store orders on the wallet rail (a store whose operator is a
-- coordinator shop): the customer pays the coordinator's wallet, records the
-- transaction reference, and the coordinator confirms before the order is
-- treated as paid. Mirrors the FestDash wallet columns.
alter table public.store_orders
  add column if not exists payment_method text not null default 'card',
  add column if not exists payment_to text,
  add column if not exists payment_ref text,
  add column if not exists payment_confirmed_by uuid,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists currency text not null default 'USD',
  add column if not exists vendor_id bigint;
