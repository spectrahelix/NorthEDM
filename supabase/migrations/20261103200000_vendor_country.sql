-- Shop's country (ISO-2), chosen on /festdash/shop-setup; it sets the shop's currency.
alter table public.vendors add column if not exists country text;
grant select (country) on public.vendors to anon, authenticated;
update public.vendors set country = 'GM' where country is null and currency = 'GMD';
