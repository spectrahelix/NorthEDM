-- ============================================================
-- Homestead Life + Brandi Martenas full setup
-- Run this entire script in Supabase SQL Editor
-- No copy-pasting IDs needed — it looks everything up automatically
-- ============================================================

DO $$
DECLARE
  brandi_uid   uuid;
  hl_vendor_id bigint;
BEGIN

  -- 1. Find Brandi's auth UUID
  SELECT id INTO brandi_uid
  FROM auth.users
  WHERE email = 'brandimartenas@gmail.com'
  LIMIT 1;

  IF brandi_uid IS NULL THEN
    RAISE EXCEPTION 'Brandi account not found — create her auth account first via /admin/create-user';
  END IF;

  -- 2. Ensure Homestead Life vendor row exists
  SELECT id INTO hl_vendor_id
  FROM vendors
  WHERE name ILIKE '%homestead life%'
  LIMIT 1;

  IF hl_vendor_id IS NULL THEN
    -- Insert it if missing
    INSERT INTO vendors (name, email, category, description, vendor_type, is_founder, status, is_public, user_id)
    VALUES (
      'Homestead Life',
      'brandimartenas@gmail.com',
      'Herbal & Wellness',
      'Handcrafted herbal salves, balms, and wellness products rooted in Appalachian tradition. Founded by Brandi Martenas.',
      'listed',
      true,
      'approved',
      true,
      brandi_uid
    )
    RETURNING id INTO hl_vendor_id;

    RAISE NOTICE 'Created Homestead Life vendor with ID %', hl_vendor_id;
  ELSE
    -- Update user_id on existing row
    UPDATE vendors SET user_id = brandi_uid WHERE id = hl_vendor_id;
    RAISE NOTICE 'Found existing Homestead Life vendor ID %', hl_vendor_id;
  END IF;

  -- 3. Upsert profiles row
  INSERT INTO profiles (id, role, vendor_id, username)
  VALUES (brandi_uid, 'vendor', hl_vendor_id, 'brandi_homesteadlife')
  ON CONFLICT (id) DO UPDATE
    SET role = 'vendor',
        vendor_id = hl_vendor_id,
        username = 'brandi_homesteadlife';

  -- 4. Upsert user_profiles row
  INSERT INTO user_profiles (id, display_name, role, bio, home_city, avatar_border, avatar_url)
  VALUES (brandi_uid, 'Brandi', 'merchant', '', '', 'moss', null)
  ON CONFLICT (id) DO UPDATE
    SET display_name = 'Brandi',
        role = 'merchant';

  RAISE NOTICE 'Done — Brandi (%) linked to Homestead Life vendor ID %', brandi_uid, hl_vendor_id;

END $$;
