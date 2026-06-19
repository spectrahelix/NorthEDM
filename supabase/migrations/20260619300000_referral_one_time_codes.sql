-- ============================================================
-- One-time referral codes
--
-- Replaces #25's permanent per-promoter referral LINK with single-use
-- codes that an issuer pulls on demand and hands to a new user. On
-- redemption (new user confirms email) BOTH the issuer and the new user
-- get $1.00 store credit.
--
-- Issuers:
--   * vendors   (profiles.vendor_id IS NOT NULL)
--   * promoters (active festdash_promoters row)
-- Both can issue referral codes; only vendors get commission codes (PR C).
--
-- Idempotent: safe to re-run. APPLY IN SUPABASE before deploying.
-- ============================================================

CREATE TABLE IF NOT EXISTS referral_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  issuer_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issuer_kind  text NOT NULL CHECK (issuer_kind IN ('vendor', 'promoter')),
  reward_cents integer NOT NULL DEFAULT 100,
  redeemed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_codes_issuer_idx ON referral_codes (issuer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_codes_code_lower_idx ON referral_codes (lower(code));

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Issuers can read (and thus list/share) their own codes.
DROP POLICY IF EXISTS "Issuers read own referral codes" ON referral_codes;
CREATE POLICY "Issuers read own referral codes"
  ON referral_codes FOR SELECT
  TO authenticated
  USING (issuer_id = auth.uid());

-- Minting and redemption run server-side with the service role (bypasses RLS).

-- Atomically claim a one-time code for a redeemer. Returns the row only if it
-- was unredeemed (and not self-redeemed); NULL otherwise. Prevents double use.
CREATE OR REPLACE FUNCTION claim_referral_code(p_code text, p_redeemer uuid)
RETURNS referral_codes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed referral_codes;
BEGIN
  UPDATE referral_codes
     SET redeemed_by = p_redeemer, redeemed_at = now()
   WHERE lower(code) = lower(p_code)
     AND redeemed_by IS NULL
     AND issuer_id <> p_redeemer
  RETURNING * INTO claimed;
  RETURN claimed; -- NULL if no row matched
END;
$$;

REVOKE ALL ON FUNCTION claim_referral_code(text, uuid) FROM PUBLIC;
