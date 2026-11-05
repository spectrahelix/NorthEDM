-- Interim rules for Gambian (wallet-rail) shops (owner, 2026-11-05): card /
-- Google Pay only, plus a transfer fee covering the owner's Remitly cost.
-- utils/localRules.ts.
alter table public.coordinator_program_settings
  add column if not exists local_wallets_enabled boolean not null default false,
  add column if not exists remit_fee_usd_cents integer not null default 399 check (remit_fee_usd_cents between 0 and 5000);
alter table public.festdash_orders add column if not exists remit_fee_cents integer not null default 0;
alter table public.store_orders add column if not exists remit_fee_cents integer not null default 0;
-- coordinator_program_settings uses column-level grants; settings are public.
grant select (local_wallets_enabled, remit_fee_usd_cents) on public.coordinator_program_settings to anon, authenticated;
