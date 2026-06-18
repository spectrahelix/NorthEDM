-- ============================================================
-- FestDash Schema v2 — Phase 1 foundation
-- Escrow payment status, last-4 confirmation codes, structured
-- campsite, car/plate ID, driver registration + assignment,
-- live driver/customer location, realtime + storage policies.
--
-- Idempotent: safe to re-run. APPLY IN SUPABASE (SQL editor or CLI)
-- before deploying the Phase 1 app code that reads these columns.
-- ============================================================

-- 1) Extend festdash_orders ----------------------------------
ALTER TABLE festdash_orders
  ADD COLUMN IF NOT EXISTS customer_phone      text,
  -- delivery confirmation: last 4 digits of the customer's phone
  ADD COLUMN IF NOT EXISTS confirmation_code   text,
  ADD COLUMN IF NOT EXISTS confirmed_at        timestamptz,
  -- structured campsite location (legacy campground_zone kept for back-compat)
  ADD COLUMN IF NOT EXISTS campground          text,
  ADD COLUMN IF NOT EXISTS sub_campground      text,
  ADD COLUMN IF NOT EXISTS campsite_row        text,
  ADD COLUMN IF NOT EXISTS tent                text,
  -- vehicle identification for the driver
  ADD COLUMN IF NOT EXISTS car_photo_url       text,
  ADD COLUMN IF NOT EXISTS license_plate       text,
  -- driver assignment + live location ping
  ADD COLUMN IF NOT EXISTS driver_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_lat          double precision,
  ADD COLUMN IF NOT EXISTS driver_lng          double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  -- customer campsite ping (optional, from their phone GPS)
  ADD COLUMN IF NOT EXISTS customer_lat        double precision,
  ADD COLUMN IF NOT EXISTS customer_lng        double precision,
  -- escrow / payment lifecycle (Stripe Connect)
  ADD COLUMN IF NOT EXISTS payment_status      text NOT NULL DEFAULT 'unpaid',
    -- unpaid | authorized | held | released | refunded
  ADD COLUMN IF NOT EXISTS escrow_released_at  timestamptz;

CREATE INDEX IF NOT EXISTS festdash_orders_driver_id_idx ON festdash_orders (driver_id);

-- 2) Registered FestDash drivers -----------------------------
CREATE TABLE IF NOT EXISTS festdash_drivers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  phone        text,
  vehicle      text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE festdash_drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers manage own profile" ON festdash_drivers;
CREATE POLICY "Drivers manage own profile" ON festdash_drivers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3) Vendor payout linkage (Stripe Connect account) ----------
ALTER TABLE festdash_vendors
  ADD COLUMN IF NOT EXISTS stripe_account_id text;

-- 4) Assigned driver can see + update their orders -----------
DROP POLICY IF EXISTS "Drivers see assigned orders" ON festdash_orders;
CREATE POLICY "Drivers see assigned orders" ON festdash_orders
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "Drivers update assigned orders" ON festdash_orders;
CREATE POLICY "Drivers update assigned orders" ON festdash_orders
  FOR UPDATE TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- 5) Realtime (live tracking + vendor/driver notifications) ---
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE festdash_orders;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- already in publication
END $$;

-- 6) Storage bucket + policies for campsite & car photos ------
INSERT INTO storage.buckets (id, name, public)
  VALUES ('festdash-campsites', 'festdash-campsites', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Auth upload festdash photos" ON storage.objects;
CREATE POLICY "Auth upload festdash photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'festdash-campsites');

DROP POLICY IF EXISTS "Public read festdash photos" ON storage.objects;
CREATE POLICY "Public read festdash photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'festdash-campsites');
