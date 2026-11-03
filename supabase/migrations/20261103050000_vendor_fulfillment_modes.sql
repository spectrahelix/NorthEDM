-- Which fulfilment a shop offers on FestDash: both (default), pickup, delivery.
-- Gee's shop starts pickup-only (owner's decision, 2026-11-03).
alter table public.vendors add column if not exists fulfillment_modes text not null default 'both';
update public.vendors set fulfillment_modes = 'pickup' where id = 35;
