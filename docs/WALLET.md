# NorthEDM Wallet, Promoter Commissions & Payouts — design

Status: **design + schema landed; app logic building in verified stages.**
Owner: CJ (cjblue27@gmail.com). This is a money system — correctness and security
over speed. Nothing here moves real money until the stage that adds it is tested.

## Decisions (locked)

1. **No "Add Money" top-up.** The wallet only ever fills from money a user *earned*
   (promoter commissions) or refunds. Letting users load their own money for later
   spend can legally make NorthEDM a **state-licensed money transmitter** — skipped
   on purpose. ("Use wallet at checkout" and "withdraw to bank" still ship.)
2. **Reusable promoter codes.** Each promoter has **one permanent code + QR**, reused
   forever. (One-time codes were the old "$1 each way" invite loop — retired.)
3. **Commission on paid actions only.** A code earns the promoter a % **only when the
   referred person actually pays** — a NorthEDM-brand shop order, a paid vendor
   listing, a foraging tour, a FestDash order. **No reward for a bare signup**
   (kills fake-account farming).
4. **PCI: card data never touches our servers.** All card entry goes through Stripe
   (Elements/Checkout + PaymentIntents). We store only Stripe IDs and cents amounts.
   This keeps us in PCI **SAQ-A** scope (the lightest tier).
5. **Withdrawals via Stripe Connect (Express).** Promoter connects a bank account to a
   Stripe Connect account; withdrawal = ledger debit + Stripe transfer/payout.

## The wallet is a ledger, not a number

Balance is **never** an editable field. It is the **sum of an append-only ledger**
(`wallet_ledger`). Every credit (commission, refund) and debit (checkout spend,
withdrawal) is one immutable row. This makes the balance auditable and impossible to
silently corrupt.

- `wallet_ledger(user_id, kind, amount_cents, ref_type, ref_id, memo, created_at)`
  - `kind`: `commission | refund | spend | withdrawal | adjustment`
  - amount_cents is **signed** (+credit / −debit).
- Balance = `sum(amount_cents)` for a user. Exposed via a `wallet_balance(user_id)`
  function and a per-user view. **No client can write this table** — writes happen
  only through `SECURITY DEFINER` functions that enforce invariants (never let a
  balance go negative, never double-spend).

## Reusable codes + attribution

- `promoter_codes(user_id UNIQUE, code UNIQUE, active)` — the permanent code/QR.
- `referral_attributions(referred_user_id UNIQUE, promoter_user_id, code, created_at)`
  — set once, the first time a person arrives via `?ref=<code>` (cookie) or enters a
  code. First-touch wins; a promoter can never attribute **themselves** (no
  self-referral).
- When an attributed user completes a paid action, we write a `commissions` row and
  credit the promoter's ledger.

## Commissions

- `commission_rates(source_type PK, rate_bps, active)` — admin-editable % per action
  type (`shop_order`, `vendor_listing`, `foraging_tour`, `festdash_order`). bps =
  hundredths of a percent (1000 = 10%).
- `commissions(id, promoter_user_id, referred_user_id, source_type, source_id,
  base_cents, rate_bps, amount_cents, status, created_at)`
  - Written **server-side only**, on confirmed payment (Stripe webhook / server
    confirmation), idempotent on `(source_type, source_id)` so a retried webhook
    can't double-pay.
  - On insert, credits `wallet_ledger` (kind `commission`).

### Where commissions fire (build targets)
- **NorthEDM-brand shop order paid** → commission on brand items only.
- **Vendor listing / marketplace access purchased** → commission on the fee.
- **Foraging tour request converted to paid booking** → commission on the tour price.
- **FestDash order delivered/paid** → commission on the platform's take.

## Wallet at checkout (split payment)

At checkout the buyer sees **"Use from wallet balance first:"** with a custom-amount
box (capped at min(balance, order total)).

1. `wallet_applied = min(requested, balance, total)`.
2. Remaining `= total − wallet_applied` is charged via a **Stripe PaymentIntent**
   (card entered in Stripe Elements — never on our server).
3. On Stripe's confirmed-payment webhook: atomically debit the wallet by
   `wallet_applied` (ledger `spend`) **and** mark the order paid, in one DB
   transaction. If the card fails, the wallet is **not** debited.
4. If `wallet_applied == total`, no card is needed; we still verify balance
   server-side inside the debit function (never trust the client amount).

## Withdrawals (Stripe Connect Express)

- `connect_accounts(user_id UNIQUE, stripe_account_id, payouts_enabled, created_at)`.
- Promoter clicks **Connect bank** → Stripe Connect onboarding (hosted by Stripe).
- **Withdraw** → server checks balance, writes a `withdrawal` ledger debit, creates a
  Stripe transfer to their connected account. Reversed (re-credit) if the transfer
  fails.

## Security checklist (must hold before go-live)

- [ ] `wallet_ledger`, `commissions`, `connect_accounts` have RLS **on** with **no
      client INSERT/UPDATE/DELETE**; all mutations via `SECURITY DEFINER` functions
      or the service role.
- [ ] Users can SELECT only **their own** ledger/commissions.
- [ ] Balance-affecting functions are idempotent and reject negative results.
- [ ] Card data only ever entered in Stripe Elements/Checkout (SAQ-A). Verify no card
      fields are ever POSTed to our API.
- [ ] Stripe webhooks verify the signature (`STRIPE_WEBHOOK_SECRET`) before acting.
- [ ] Commission writes idempotent on `(source_type, source_id)`.
- [ ] Self-referral blocked; attribution is first-touch and immutable.

## Rollout stages

1. **Schema + ledger primitives** (this doc's migration) + admin rate config. _No UI._
2. **Promoter wallet UI**: balance + ledger history on profile; reusable code + QR.
3. **Commission hooks**: credit on each paid action (start with brand shop orders).
4. **Wallet-at-checkout** split payment.
5. **Stripe Connect** connect-bank + withdrawal.

Each stage is its own PR, verified (build + a live test on the relevant flow) before
the next. Requires the Supabase connector up to apply migrations, and Stripe keys in
Vercel for the payment stages.
