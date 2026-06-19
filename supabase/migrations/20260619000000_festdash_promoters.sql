-- ============================================================
-- FestDash — Promoters & Promo Codes (foundation)
--
-- Adds: promoter rank + applications, promo codes (merchant %-off
-- reusable + promoter one-time, both tied to a specific vendor),
-- redemption ledger (discount + promoter commission), and the
-- order columns that record an applied code.
--
-- Money model: the VENDOR absorbs both the customer discount and the
-- promoter commission; the platform fee is unchanged. Commission is
-- recorded here and paid out when escrow releases (later phase).
--
-- Idempotent: safe to re-run. APPLY IN SUPABASE before deploying.
-- ============================================================

-- 1) Allow the new 'promoter' rank ---------------------------
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('archon','warden','merchant','promoter','wanderer','drifter'));

-- 2) Promoter applications (mirror vendor applications) -------
CREATE TABLE IF NOT EXISTS festdash_promoter_applications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name   text NOT NULL,
  email          text NOT NULL,
  phone          text,
  audience       text,           -- how/where they reach people
  promote_vendor text,           -- vendor/brand they want to promote
  why            text,           -- why they'd be a good promoter
  status         text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 3) Approved promoters --------------------------------------
CREATE TABLE IF NOT EXISTS festdash_promoters (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      text NOT NULL DEFAULT '',
  stripe_account_id text,        -- Connect account for commission payouts (later)
  commission_bps    integer NOT NULL DEFAULT 1000, -- 10% default; per-code overridable
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Which vendors a promoter is approved to promote (codes are vendor-specific)
CREATE TABLE IF NOT EXISTS festdash_promoter_vendors (
  promoter_id uuid NOT NULL REFERENCES festdash_promoters(id) ON DELETE CASCADE,
  vendor_id   bigint NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  PRIMARY KEY (promoter_id, vendor_id)
);

-- 4) Promo codes (merchant reusable + promoter one-time) ------
CREATE TABLE IF NOT EXISTS festdash_promo_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  kind            text NOT NULL DEFAULT 'merchant', -- merchant | promoter
  vendor_id       bigint NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  percent_off     integer NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  commission_bps  integer NOT NULL DEFAULT 0,        -- promoter cut (0 for merchant codes)
  max_redemptions integer,                            -- null = unlimited; 1 = one-time
  times_redeemed  integer NOT NULL DEFAULT 0,
  owner_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- creator
  promoter_id     uuid REFERENCES festdash_promoters(id) ON DELETE SET NULL,
  active          boolean NOT NULL DEFAULT true,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS festdash_promo_codes_vendor_idx ON festdash_promo_codes (vendor_id);
CREATE INDEX IF NOT EXISTS festdash_promo_codes_code_idx ON festdash_promo_codes (lower(code));

-- 5) Redemption ledger ---------------------------------------
CREATE TABLE IF NOT EXISTS festdash_promo_redemptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id         uuid NOT NULL REFERENCES festdash_promo_codes(id) ON DELETE CASCADE,
  order_id        uuid REFERENCES festdash_orders(id) ON DELETE SET NULL,
  customer_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  promoter_id     uuid REFERENCES festdash_promoters(id) ON DELETE SET NULL,
  discount_cents  integer NOT NULL DEFAULT 0,
  commission_cents integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS festdash_promo_redemptions_code_idx ON festdash_promo_redemptions (code_id);
CREATE INDEX IF NOT EXISTS festdash_promo_redemptions_promoter_idx ON festdash_promo_redemptions (promoter_id);

-- 6) Record the applied code on the order --------------------
ALTER TABLE festdash_orders
  ADD COLUMN IF NOT EXISTS promo_code       text,
  ADD COLUMN IF NOT EXISTS promo_code_id    uuid REFERENCES festdash_promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_cents   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promoter_id      uuid REFERENCES festdash_promoters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_cents integer NOT NULL DEFAULT 0;

-- 7) RLS -----------------------------------------------------
ALTER TABLE festdash_promoter_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE festdash_promoters             ENABLE ROW LEVEL SECURITY;
ALTER TABLE festdash_promoter_vendors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE festdash_promo_codes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE festdash_promo_redemptions     ENABLE ROW LEVEL SECURITY;

-- Anyone may apply to become a promoter
DROP POLICY IF EXISTS "Anyone can apply as promoter" ON festdash_promoter_applications;
CREATE POLICY "Anyone can apply as promoter"
  ON festdash_promoter_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Applicants see their own applications
DROP POLICY IF EXISTS "Users see own promoter applications" ON festdash_promoter_applications;
CREATE POLICY "Users see own promoter applications"
  ON festdash_promoter_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Promoters can read their own promoter row + their codes
DROP POLICY IF EXISTS "Promoters see own row" ON festdash_promoters;
CREATE POLICY "Promoters see own row"
  ON festdash_promoters FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners see own promo codes" ON festdash_promo_codes;
CREATE POLICY "Owners see own promo codes"
  ON festdash_promo_codes FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR vendor_id IN (SELECT vendor_id FROM profiles WHERE id = auth.uid())
  );

-- Note: code validation/redemption + promoter management run server-side
-- with the service role, which bypasses RLS. The policies above only cover
-- direct client reads of a user's own data.
