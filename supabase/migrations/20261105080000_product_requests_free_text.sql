-- "Couldn't find what you were looking for? → request here" (owner, 2026-11-05):
-- a request can name one of the shop's items OR describe anything in words.
alter table public.product_requests alter column product_id drop not null;
alter table public.product_requests add column if not exists item_text text
  check (item_text is null or char_length(item_text) between 2 and 120);
alter table public.product_requests drop constraint if exists product_requests_item_given;
alter table public.product_requests add constraint product_requests_item_given
  check (product_id is not null or item_text is not null);
-- Push guard for words too: one open-or-handled request per person per thing per shop.
create unique index if not exists product_requests_text_once
  on public.product_requests (store_id, user_id, lower(item_text)) where product_id is null;
