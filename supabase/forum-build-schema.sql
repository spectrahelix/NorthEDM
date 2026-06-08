-- ============================================================
-- NorthEDM Forum Build Schema — run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- USER PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     text NOT NULL DEFAULT '',
  avatar_url       text,
  avatar_border    text NOT NULL DEFAULT 'moss',
  bio              text NOT NULL DEFAULT '',
  home_city        text NOT NULL DEFAULT '',
  role             text NOT NULL DEFAULT 'drifter'
    CHECK (role IN ('archon','warden','merchant','wanderer','drifter')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read profiles"   ON user_profiles FOR SELECT USING (true);
CREATE POLICY "own insert profile"     ON user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own update profile"     ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill profiles for any existing users
INSERT INTO user_profiles (id, display_name)
SELECT id, COALESCE(raw_user_meta_data->>'display_name', split_part(email,'@',1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- FORUM CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS forum_categories (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  icon        text NOT NULL DEFAULT '🌿',
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read categories"  ON forum_categories FOR SELECT USING (true);
CREATE POLICY "auth create category"    ON forum_categories FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO forum_categories (name, description, icon, is_default) VALUES
  ('Lineups & Artists',         'Who is playing where and when',                      '🎶', true),
  ('Camping & Gear',            'Tents, tarps, prep, and loadout tips',               '🏕️', true),
  ('Carpool & Rides',           'Find a ride or offer one',                           '🚗', true),
  ('Weather & Trail Conditions','Real-time conditions, forecasts, and field reports',  '🌧️', true),
  ('Vendors & Mushrooms',       'Find vendors, reviews, and product talk',             '🍄', true),
  ('Foraging Reports',          'What is out there and where to look',                 '🌿', true),
  ('Trades & Tickets',          'Buy, sell, and trade tickets',                        '🎟️', true),
  ('Wook World',                'Quests, collectibles, and the digital universe',      '🔮', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- THREADS — add category_id if not present
-- ============================================================
ALTER TABLE threads ADD COLUMN IF NOT EXISTS category_id bigint REFERENCES forum_categories(id) ON DELETE SET NULL;

-- ============================================================
-- DIRECT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS direct_messages (
  id           bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  sender_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject      text NOT NULL DEFAULT '(no subject)',
  body         text NOT NULL,
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm access"    ON direct_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "dm send"      ON direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "dm mark read" ON direct_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id               bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  reporter_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id        bigint REFERENCES threads(id) ON DELETE SET NULL,
  reply_id         bigint REFERENCES replies(id) ON DELETE SET NULL,
  reason           text NOT NULL CHECK (reason IN ('harassment','hate_speech','spam','misinformation','other')),
  details          text,
  status           text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','resolved','dismissed')),
  reviewed_by      uuid REFERENCES auth.users(id),
  resolution_notes text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submit report"  ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "own reports"    ON reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

CREATE POLICY "admin read all reports"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('archon', 'warden')
    )
  );

CREATE POLICY "admin update reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('archon', 'warden')
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  message    text NOT NULL,
  link       text,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own mark read"     ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "system insert"     ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- THREAD HEARTS
-- ============================================================
CREATE TABLE IF NOT EXISTS thread_hearts (
  id        bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  thread_id bigint NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (thread_id, user_id)
);

ALTER TABLE thread_hearts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read hearts"  ON thread_hearts FOR SELECT USING (true);
CREATE POLICY "auth heart"          ON thread_hearts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth unheart"        ON thread_hearts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- REPLY COUNT TRIGGER (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_thread_reply_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE threads SET reply_count = reply_count + 1 WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_reply_insert ON replies;
CREATE TRIGGER on_reply_insert
  AFTER INSERT ON replies
  FOR EACH ROW EXECUTE FUNCTION increment_thread_reply_count();

-- ============================================================
-- THREAD NOTIFICATIONS TRIGGER (reply to your thread)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_thread_author_on_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_thread_author uuid;
  v_thread_title  text;
BEGIN
  SELECT user_id, title INTO v_thread_author, v_thread_title
  FROM threads WHERE id = NEW.thread_id;

  IF v_thread_author IS NOT NULL AND v_thread_author <> NEW.user_id THEN
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (
      v_thread_author,
      'reply',
      'Someone replied to your thread: ' || v_thread_title,
      '/forum/' || NEW.thread_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_reply_notify ON replies;
CREATE TRIGGER on_reply_notify
  AFTER INSERT ON replies
  FOR EACH ROW EXECUTE FUNCTION notify_thread_author_on_reply();

-- ============================================================
-- STORAGE BUCKET NOTE
-- ============================================================
-- In Supabase Dashboard → Storage → New Bucket:
--   Name: avatars
--   Public: ON
-- Then add storage policy:
--   authenticated users can INSERT/UPDATE to avatars bucket
