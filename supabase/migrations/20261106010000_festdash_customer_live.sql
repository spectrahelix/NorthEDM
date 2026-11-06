-- FestDash: a customer may choose to share their live position with the runner
-- delivering their order (owner, 2026-11-06). Kept off festdash_orders on
-- purpose: the shop can read order rows, and a customer's moving position is
-- for their runner only. Service role only — read and written by
-- /api/festdash/orders/[id]/customer-location, which checks who is asking.
-- The row is removed when sharing stops and when the order is delivered or
-- declined; the API also ignores a position older than 10 minutes.
create table if not exists public.festdash_customer_live (
  order_id uuid primary key references public.festdash_orders(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  updated_at timestamptz not null default now()
);
alter table public.festdash_customer_live enable row level security;
revoke all on public.festdash_customer_live from anon, authenticated;
