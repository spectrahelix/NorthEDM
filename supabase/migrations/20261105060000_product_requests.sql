-- "QTY Not Listed? → request now" (owner, 2026-11-05): a signed-in shopper asks
-- a store for an item / size / quantity that isn't on sale. One request per
-- person per item size (the push guard); the store's operator sees them in
-- Edit shop and is alerted. Service role only — no end-user grant.
create table if not exists public.product_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 10000),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  unique (product_id, user_id)
);
create index if not exists product_requests_store_open on public.product_requests (store_id, status, created_at desc);
alter table public.product_requests enable row level security;
revoke all on table public.product_requests from anon, authenticated;
