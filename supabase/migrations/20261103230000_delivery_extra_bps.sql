-- FestDash DELIVERY orders carry an extra platform share on top of the base
-- (shop keeps 80% instead of 90%) because the network pays for delivery.
-- Pickup orders and store/marketplace sales stay on the base split.
alter table public.coordinator_program_settings
  add column if not exists delivery_extra_bps integer not null default 1000
  check (delivery_extra_bps >= 0 and delivery_extra_bps <= 5000);
