-- The flat transfer fee was replaced by remit_fee_bps (3%) in 20261105030000;
-- no code reads the old column any more (checked 2026-11-05).
alter table public.coordinator_program_settings drop column if exists remit_fee_usd_cents;
