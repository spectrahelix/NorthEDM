-- A coordinator can log two kinds of monthly fee for a shop: its FestDash
-- listing (the default) and its embedded-store subscription. Promoters also
-- earn on embedded-store sales (commission source store_order).
alter table public.vendor_subscriptions
  add column if not exists kind text not null default 'festdash' check (kind in ('festdash', 'store'));
insert into public.commission_rates (source_type, rate_bps, hold_days, active)
  values ('store_order', 1000, 30, true)
  on conflict (source_type) do nothing;
