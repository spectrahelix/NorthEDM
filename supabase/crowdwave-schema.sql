-- ============================================================
-- CrowdWave Tables — run this in the Supabase SQL Editor
-- ============================================================

-- Festival Events
CREATE TABLE IF NOT EXISTS festival_events (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name          text NOT NULL,
  location      text NOT NULL,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  ticket_status text NOT NULL DEFAULT 'available', -- available | limited | sold_out
  badge         text,                               -- hot | new | soon | null
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Festival Vendors (separate from NorthEDM vendor directory)
CREATE TABLE IF NOT EXISTS festival_vendors (
  id                   bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name                 text NOT NULL,
  category             text NOT NULL,
  emoji                text NOT NULL DEFAULT '🎪',
  upcoming_shows_count integer NOT NULL DEFAULT 0,
  growth_percent       integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Forum Threads
CREATE TABLE IF NOT EXISTS threads (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    text NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL,
  reply_count integer NOT NULL DEFAULT 0,
  heart_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Thread Replies
CREATE TABLE IF NOT EXISTS replies (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  thread_id  bigint NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Community Groups
CREATE TABLE IF NOT EXISTS community_groups (
  id           bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  emoji        text NOT NULL DEFAULT '👥',
  name         text NOT NULL,
  category     text NOT NULL,
  member_count integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Group Memberships
CREATE TABLE IF NOT EXISTS group_members (
  id        bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  group_id  bigint NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE festival_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_vendors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members     ENABLE ROW LEVEL SECURITY;

-- Public read on all CrowdWave tables
CREATE POLICY "public read festival_events"  ON festival_events  FOR SELECT USING (true);
CREATE POLICY "public read festival_vendors" ON festival_vendors FOR SELECT USING (true);
CREATE POLICY "public read threads"          ON threads          FOR SELECT USING (true);
CREATE POLICY "public read replies"          ON replies          FOR SELECT USING (true);
CREATE POLICY "public read community_groups" ON community_groups FOR SELECT USING (true);
CREATE POLICY "public read group_members"    ON group_members    FOR SELECT USING (true);

-- Authenticated users can post threads
CREATE POLICY "auth insert threads"
  ON threads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can post replies
CREATE POLICY "auth insert replies"
  ON replies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can join groups
CREATE POLICY "auth insert group_members"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can leave groups (delete their own row)
CREATE POLICY "auth delete own group_members"
  ON group_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated users can update community_groups member_count
CREATE POLICY "auth update community_groups"
  ON community_groups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Foraging Conditions (admin-editable)
-- ============================================================

CREATE TABLE IF NOT EXISTS foraging_conditions (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  region     text NOT NULL,
  condition  text NOT NULL CHECK (condition IN ('good', 'fair', 'poor')),
  notes      text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE foraging_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read foraging_conditions"
  ON foraging_conditions FOR SELECT USING (true);

-- ============================================================
-- Reply Count Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION increment_thread_reply_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE threads SET reply_count = reply_count + 1 WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_reply_insert
  AFTER INSERT ON replies
  FOR EACH ROW EXECUTE FUNCTION increment_thread_reply_count();

-- ============================================================
-- Seed Data
-- ============================================================

INSERT INTO festival_events (name, location, start_date, end_date, lat, lng, ticket_status, badge) VALUES
  ('Electric Forest 2026', 'Rothbury, MI',       '2026-06-25', '2026-06-28', 43.55, -85.47, 'available', 'hot'),
  ('Bonnaroo 2026',        'Manchester, TN',      '2026-06-12', '2026-06-15', 35.49, -86.09, 'limited',   'soon'),
  ('Desert Dusk Fest',     'Joshua Tree, CA',     '2026-07-11', '2026-07-13', 34.13, -116.31,'available', 'new');

INSERT INTO festival_vendors (name, category, emoji, upcoming_shows_count, growth_percent) VALUES
  ('Desert Fire Tacos',  'Food',              '🌮', 6, 34),
  ('Roots & Remedy',     'Wellness',          '🌿', 4, 21),
  ('Neon Kin Studio',    'Art',               '🎨', 5, 18),
  ('Crystal Compass',    'Crystals/Readings', '🔮', 3, 15);

INSERT INTO community_groups (emoji, name, category, member_count) VALUES
  ('🚐', 'Philly Caravan Crew',       'Carpool',     0),
  ('🏕️', 'First-Timers Camp',          'Camping',     0),
  ('🪱', 'Mud Warriors',               'Camping',     0),
  ('🌙', 'Late Night Stage Gang',      'Music',       0),
  ('🌵', 'Desert Fest Collective',     'Community',   0),
  ('🙋', 'Solo Festies Connect',       'Community',   0),
  ('📸', 'Festival Photography',       'Art',         0),
  ('♻️', 'Eco-Conscious Crew',         'Environment', 0);
