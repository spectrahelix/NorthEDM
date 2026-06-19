-- ============================================================
-- Avatar builder + accessories (store-credit sink)
--
-- Users assemble a layered avatar from parts. Free parts are usable by
-- everyone; premium accessories are unlocked by spending store credit.
--
-- The composed avatar is rendered to an SVG data-URI and saved into the
-- existing user_profiles.avatar_url (so it shows everywhere with no
-- call-site changes), while avatar_config holds the chosen layers so the
-- builder can reload them.
--
-- Item definitions (and their prices) live in code (app/avatar/catalog.ts);
-- this table only records OWNERSHIP. Purchases run server-side with the
-- service role: ownership is claimed first (unique), then credit is spent,
-- rolling back ownership if the spend fails.
--
-- Idempotent: safe to re-run. APPLY IN SUPABASE before deploying.
-- ============================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_config jsonb;

CREATE TABLE IF NOT EXISTS user_avatar_items (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE user_avatar_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own avatar items" ON user_avatar_items;
CREATE POLICY "Users see own avatar items"
  ON user_avatar_items FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Purchases (claim ownership + spend credit) run server-side with the
-- service role, which bypasses RLS.
