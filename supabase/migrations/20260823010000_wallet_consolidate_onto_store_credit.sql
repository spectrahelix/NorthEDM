-- Consolidation: NorthEDM already had a wallet — store_credit_balances +
-- store_credit_ledger (append-only history) + grant_store_credit() (hardened
-- SECURITY DEFINER). The previous migration (20260823000000_wallet.sql) added a
-- parallel wallet_ledger/connect_accounts by mistake. Drop those duplicates
-- (empty, unreferenced) and build the promoter/commission features on the
-- existing store-credit wallet instead.
--
-- Kept from the prior migration (genuinely new, no equivalent existed):
--   promoter_codes, referral_attributions, commission_rates, commissions.
-- Commissions credit the wallet via the existing grant_store_credit() RPC;
-- promoter payouts use the existing festdash_promoters.stripe_account_id
-- (Stripe Connect), so a separate connect_accounts table is unnecessary.

drop function if exists public.wallet_apply(uuid, text, bigint, text, text, text);
drop function if exists public.my_wallet_balance();
drop table if exists public.wallet_ledger;
drop table if exists public.connect_accounts;
