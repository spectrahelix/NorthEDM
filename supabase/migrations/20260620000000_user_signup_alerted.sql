-- ============================================================
-- One-time owner alert flag for new signups
--
-- Set the first time a user's email is confirmed / they complete OAuth
-- (in the auth callback), so the owner gets a "new signup" alert exactly
-- once — never again on subsequent logins.
--
-- Idempotent: safe to re-run. APPLY IN SUPABASE before deploying.
-- ============================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS signup_alerted boolean NOT NULL DEFAULT false;
