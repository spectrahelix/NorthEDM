-- ============================================================
-- Role System — run this in the Supabase SQL Editor
-- ============================================================

-- Profiles table (role per user)
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'vendor', 'user')),
  vendor_id  bigint REFERENCES vendors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed to show mod badges, vendor ownership)
CREATE POLICY "public read profiles"
  ON profiles FOR SELECT USING (true);

-- ============================================================
-- Vendors: link to auth users + self-edit
-- ============================================================

-- Add user_id column so a vendor account can own a listing
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Enable RLS on vendors (if not already)
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Public can read all public vendors
CREATE POLICY "public read vendors"
  ON vendors FOR SELECT USING (true);

-- Vendors can update their own row
CREATE POLICY "vendor update own"
  ON vendors FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any vendor row
CREATE POLICY "admin update vendors"
  ON vendors FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ============================================================
-- Forum: admin delete privileges
-- ============================================================

CREATE POLICY "admin delete threads"
  ON threads FOR DELETE
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admin delete replies"
  ON replies FOR DELETE
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Thread authors can delete their own threads
CREATE POLICY "author delete own thread"
  ON threads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Reply authors can delete their own replies
CREATE POLICY "author delete own reply"
  ON replies FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Seed: set CJ as admin
-- ============================================================

INSERT INTO profiles (id, role)
VALUES ('663ca6c7-cf74-452d-8f0e-a5b4370d6278', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
