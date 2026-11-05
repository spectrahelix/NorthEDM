-- Size options for one item (owner, 2026-11-05): "one picture per mushroom,
-- with weight buttons". Each size stays its own products row — its own price,
-- stock, shipping weight, cart line and receipt name — so checkout, stock and
-- shipping need no change. A size row points at the item it belongs to.
--   variant_of    → the lead row of the group (null on the lead itself)
--   variant_label → the button text, e.g. '4 oz', '3.5 g', '30 ml'
alter table public.products
  add column if not exists variant_of bigint references public.products(id) on delete set null,
  add column if not exists variant_label text;
create index if not exists products_variant_of_idx on public.products (variant_of);
-- products has a table-wide SELECT grant for anon/authenticated, so the new
-- columns are readable without a column grant (unlike vendors/user_profiles).
