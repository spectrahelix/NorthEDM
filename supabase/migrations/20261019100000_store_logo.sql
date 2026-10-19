-- A shop's own logo, shown at the top of its storefront.
alter table public.stores add column if not exists logo_url text
  check (logo_url is null or logo_url ~ '^https://');
