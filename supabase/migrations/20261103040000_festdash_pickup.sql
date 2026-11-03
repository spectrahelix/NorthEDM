-- Pickup orders (2026-11-03): the customer collects from the shop. No runner,
-- no campsite, no runner fee; the 4-digit code is given at the counter.
alter table public.festdash_orders add column if not exists fulfillment text not null default 'delivery';
alter table public.vendors add column if not exists pickup_location text;
create index if not exists festdash_orders_fulfillment_idx on public.festdash_orders (fulfillment, status);
