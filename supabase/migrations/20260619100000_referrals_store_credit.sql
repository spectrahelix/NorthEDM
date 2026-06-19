-- ============================================================
-- Referrals + Store Credit
--
-- Promoters get a referral code. When a new account signs up with
-- it, BOTH the referring promoter and the new user earn $1.00 in
-- NorthEDM store credit. Credit is spendable at checkout (FestDash
-- today; any future store checkout reuses the same wallet).
--
-- Idempotent: safe to re-run. APPLY IN SUPABASE before deploying.
-- ============================================================

-- 1) Store-credit wallet -------------------------------------
CREATE TABLE IF NOT EXISTS store_credit_balances (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_credit_ledger (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,   -- positive = grant, negative = spend
  reason       text NOT NULL,      -- referral_signup | referral_bonus | order_redeem | adjustment
  ref_type     text,               -- referral | festdash_order | ...
  ref_id       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_credit_ledger_user_idx ON store_credit_ledger (user_id, created_at DESC);

-- 2) Promoter referral codes ---------------------------------
ALTER TABLE festdash_promoters
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- 3) Referral attribution (one reward per new account) -------
CREATE TABLE IF NOT EXISTS referrals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code             text NOT NULL,
  reward_cents     integer NOT NULL DEFAULT 100,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_id);

-- 4) Record credit applied to an order -----------------------
ALTER TABLE festdash_orders
  ADD COLUMN IF NOT EXISTS store_credit_cents integer NOT NULL DEFAULT 0;

-- 5) Atomic credit grant/spend -------------------------------
-- Positive amount grants, negative spends. Rolls back (and raises)
-- if a spend would push the balance negative. SECURITY DEFINER so it
-- can write the wallet; execute is restricted to the service role.
CREATE OR REPLACE FUNCTION grant_store_credit(
  p_user uuid, p_amount integer, p_reason text,
  p_ref_type text DEFAULT NULL, p_ref_id text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_balance integer;
BEGIN
  INSERT INTO store_credit_balances (user_id, balance_cents, updated_at)
    VALUES (p_user, p_amount, now())
    ON CONFLICT (user_id) DO UPDATE
      SET balance_cents = store_credit_balances.balance_cents + EXCLUDED.balance_cents,
          updated_at = now()
    RETURNING balance_cents INTO new_balance;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient store credit';
  END IF;

  INSERT INTO store_credit_ledger (user_id, amount_cents, reason, ref_type, ref_id)
    VALUES (p_user, p_amount, p_reason, p_ref_type, p_ref_id);

  RETURN new_balance;
END;
$$;

-- Only the service role (server-side) may move credit.
REVOKE ALL ON FUNCTION grant_store_credit(uuid, integer, text, text, text) FROM PUBLIC;

-- 6) RLS -----------------------------------------------------
ALTER TABLE store_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_credit_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own balance" ON store_credit_balances;
CREATE POLICY "Users see own balance"
  ON store_credit_balances FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users see own ledger" ON store_credit_ledger;
CREATE POLICY "Users see own ledger"
  ON store_credit_ledger FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Referrers see own referrals" ON referrals;
CREATE POLICY "Referrers see own referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());

-- Note: granting/spending credit and writing referrals happen server-side
-- with the service role (signup + checkout routes), which bypasses RLS.
