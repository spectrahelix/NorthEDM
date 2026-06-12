-- ============================================================
-- FestDash Schema
-- Festival delivery network — orders, vendor enrollment, drivers
-- ============================================================

-- Vendor applications / enrollment
CREATE TABLE IF NOT EXISTS festdash_vendor_applications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      bigint REFERENCES vendors(id) ON DELETE SET NULL,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name  text NOT NULL,
  contact_name   text NOT NULL,
  email          text NOT NULL,
  phone          text,
  product_types  text NOT NULL,
  typical_events text,
  has_tablet     text,
  notes          text,
  status         text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Approved FestDash vendors
CREATE TABLE IF NOT EXISTS festdash_vendors (
  id          bigserial PRIMARY KEY,
  vendor_id   bigint NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active   boolean NOT NULL DEFAULT true,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id)
);

-- Orders placed by festival-goers
CREATE TABLE IF NOT EXISTS festdash_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           bigint NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  customer_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name       text NOT NULL,
  customer_email      text,
  -- Location info
  event_name          text NOT NULL,
  campground_zone     text NOT NULL,
  campsite_notes      text,
  campsite_photo_url  text,
  -- Timing
  delivery_window     text NOT NULL,
  -- Items stored as JSONB: [{name, qty, price_cents}]
  items               jsonb NOT NULL DEFAULT '[]',
  total_cents         integer NOT NULL DEFAULT 0,
  -- Status lifecycle
  status              text NOT NULL DEFAULT 'pending',
    -- pending | accepted | in_transit | delivered | declined
  -- Payment
  stripe_payment_intent text,
  paid                boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE festdash_vendor_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE festdash_vendors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE festdash_orders              ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a vendor application
CREATE POLICY "Anyone can apply to FestDash"
  ON festdash_vendor_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Applicants can view their own applications
CREATE POLICY "Users see own applications"
  ON festdash_vendor_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- FestDash vendor list is public (so order page can show active vendors)
CREATE POLICY "Public read FestDash vendors"
  ON festdash_vendors FOR SELECT
  USING (is_active = true);

-- Customers can place orders
CREATE POLICY "Authenticated users can place orders"
  ON festdash_orders FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Customers can view their own orders
CREATE POLICY "Customers see own orders"
  ON festdash_orders FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Vendors can view orders assigned to them
-- (resolved via vendor_id which maps to profiles.vendor_id)
CREATE POLICY "Vendors see their orders"
  ON festdash_orders FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Vendors can update status of their own orders
CREATE POLICY "Vendors update their order status"
  ON festdash_orders FOR UPDATE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Index for fast vendor order lookups
CREATE INDEX IF NOT EXISTS festdash_orders_vendor_id_idx ON festdash_orders (vendor_id);
CREATE INDEX IF NOT EXISTS festdash_orders_customer_id_idx ON festdash_orders (customer_id);
CREATE INDEX IF NOT EXISTS festdash_orders_status_idx ON festdash_orders (status);
