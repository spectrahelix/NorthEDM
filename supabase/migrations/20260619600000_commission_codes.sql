-- ============================================================
-- Commission codes (vendor-issued, platform collects)
--
-- Builds on #24's festdash_promo_codes / festdash_promo_redemptions.
-- A vendor issues a code with a percentage. At FestDash checkout the
-- customer gets that % off the vendor's items, and the SAME amount is
-- booked as commission to the beneficiary. The product owner (the
-- vendor) absorbs both the discount and the commission.
--
--   beneficiary = 'platform'  → vendor's product, NorthEDM collects (live)
--   beneficiary = 'vendor'    → NorthEDM's product, vendor collects
--                               (reserved; no internal NorthEDM checkout yet)
--
-- For these codes commission == discount, so commission_bps is unused.
--
-- Idempotent: safe to re-run. APPLY IN SUPABASE before deploying.
-- ============================================================

ALTER TABLE festdash_promo_codes
  ADD COLUMN IF NOT EXISTS beneficiary text NOT NULL DEFAULT 'platform';

ALTER TABLE festdash_promo_codes
  DROP CONSTRAINT IF EXISTS festdash_promo_codes_beneficiary_check;
ALTER TABLE festdash_promo_codes
  ADD CONSTRAINT festdash_promo_codes_beneficiary_check
  CHECK (beneficiary IN ('platform', 'vendor'));

-- Helps the admin commission rollup.
CREATE INDEX IF NOT EXISTS festdash_promo_redemptions_created_idx
  ON festdash_promo_redemptions (created_at DESC);
