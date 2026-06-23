-- ============================================================
-- NorthEDM Shop — store-owned inventory + orders
--
-- A first-party storefront (separate from the vendor `products` table /
-- marketplace). Products are owned by NorthEDM; orders are paid via Stripe
-- Checkout (wired in a later phase). Inventory decrements on paid.
--
-- Idempotent: safe to re-run. APPLY IN SUPABASE before deploying.
-- ============================================================

CREATE TABLE IF NOT EXISTS shop_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  description     text NOT NULL DEFAULT '',
  price_cents     integer NOT NULL CHECK (price_cents >= 0),
  inventory_count integer NOT NULL DEFAULT 0,
  image_urls      jsonb NOT NULL DEFAULT '[]'::jsonb,
  category        text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_products_active_idx ON shop_products (active, created_at DESC);

CREATE TABLE IF NOT EXISTS shop_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email               text,
  items               jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{product_id,name,price_cents,qty}]
  subtotal_cents      integer NOT NULL DEFAULT 0,
  shipping_cents      integer NOT NULL DEFAULT 0,
  total_cents         integer NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'pending', -- pending|paid|fulfilled|cancelled|refunded
  stripe_session_id   text,
  stripe_payment_intent text,
  ship_name           text,
  ship_address        jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_orders_created_idx ON shop_orders (created_at DESC);

ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders   ENABLE ROW LEVEL SECURITY;

-- Storefront can read active products; everything else is server-side (service role).
DROP POLICY IF EXISTS "Public read active products" ON shop_products;
CREATE POLICY "Public read active products"
  ON shop_products FOR SELECT TO anon, authenticated
  USING (active = true);

-- Customers can see their own orders.
DROP POLICY IF EXISTS "Customers read own orders" ON shop_orders;
CREATE POLICY "Customers read own orders"
  ON shop_orders FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- Atomically decrement stock (never below zero). Service-role only.
CREATE OR REPLACE FUNCTION shop_decrement_stock(p_product uuid, p_qty integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE remaining integer;
BEGIN
  UPDATE shop_products
     SET inventory_count = inventory_count - p_qty, updated_at = now()
   WHERE id = p_product AND inventory_count >= p_qty
  RETURNING inventory_count INTO remaining;
  RETURN remaining; -- NULL if insufficient stock
END;
$$;
REVOKE ALL ON FUNCTION shop_decrement_stock(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION shop_decrement_stock(uuid, integer) FROM anon, authenticated;

-- Product image storage bucket (public read; uploads happen server-side).
INSERT INTO storage.buckets (id, name, public)
  VALUES ('shop-products', 'shop-products', true)
  ON CONFLICT (id) DO NOTHING;
