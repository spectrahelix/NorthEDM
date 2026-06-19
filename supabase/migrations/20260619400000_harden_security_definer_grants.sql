-- ============================================================
-- Harden SECURITY DEFINER functions
--
-- grant_store_credit / claim_referral_code / analytics_overview are
-- SECURITY DEFINER and must ONLY be called server-side with the service
-- role. Supabase grants EXECUTE on public functions to the anon &
-- authenticated roles by default, so the `REVOKE ... FROM PUBLIC` in the
-- creating migrations was a no-op against those roles.
--
-- Without this, a logged-in user could call grant_store_credit() over
-- the REST/RPC endpoint and mint themselves unlimited store credit.
--
-- Idempotent: safe to re-run. APPLY IN SUPABASE before deploying.
-- ============================================================

REVOKE EXECUTE ON FUNCTION grant_store_credit(uuid, integer, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION claim_referral_code(text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION analytics_overview(integer) FROM anon, authenticated;
