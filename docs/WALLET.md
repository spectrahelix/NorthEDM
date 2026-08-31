# NorthEDM Promoter Commissions & Payouts — design (LOCKED)

Status: **design locked; payment build pending (needs Stripe + Supabase connectors
up and live test transactions).** This is a money system — correctness and legal
safety over speed.

## The model (confirmed with CJ)

A promoter has **one permanent, reusable code + QR**. When a customer uses it on a
paid action:

- **Customer gets 10% off** (discount applied at checkout via a code input field).
- **Promoter earns 10% of the list price, in cash** (on a $100 sale: customer pays
  $90, promoter receives $10).
- **NorthEDM nets 80%.** (Two 10%s leave: the customer's discount and the promoter's
  cash. That's the accepted cost.)

Applies to paid actions: service invoices/quotes, NorthEDM-brand shop orders, paid
vendor listings, foraging tours, FestDash orders. Rates are per-action and
admin-editable (`commission_rates`, seeded at 1000 bps = 10%).

## Legal posture — we never hold the promoter's money

The only thing that creates money-transmitter exposure is **NorthEDM custodying
other people's funds** (a held, withdrawable balance). We avoid it entirely:

- Promoter commissions are **paid through Stripe Connect at payment time** — Stripe
  routes the promoter's cut to the promoter's connected account and pays it out to
  their bank. **Stripe is the licensed money-mover; NorthEDM only directs the split.**
- **No NorthEDM-held cash balance.** There is **no user "Add Money" / top-up** (that
  would be stored value → licensing).
- **Store credit** (the existing `$1` referral perk, `store_credit_ledger`) stays as
  a **spend-on-site-only** credit — not withdrawable cash — so it is not money
  transmission and is unaffected by this.

_Not legal advice. The Stripe Connect pass-through pattern is the standard way
platforms stay out of money-transmitter territory; confirm against Stripe's Connect
terms for the specific setup. Rule we never break: **pass through, never hold.**_

## Refund protection — commissions are HELD, not paid at sale time

A commission is **recorded as an unpaid obligation** and only transferred once a
**protection window** (default 30 days, per-action via `commission_rates.hold_days`)
has closed. This resolves what looks like a contradiction — "nobody can withdraw it
during protection" vs "I'm not ready to hold people's money":

- **Refunds can't go wrong.** During the window nothing has moved, so a refund
  simply **voids** the obligation. Clawing back a completed transfer is the fragile
  path (it fails if the promoter already withdrew), so reversal exists only as a
  backstop for the rare already-released case.
- **NorthEDM isn't holding anyone's money.** The funds are NorthEDM's **own revenue**
  from the sale; the promoter holds an unvested claim — ordinary **accounts payable**.
  That is categorically different from custodying customer funds, which is what
  raises money-transmitter exposure. This is *more* conservative than paying instantly.
- **Nobody can pull it early.** `commission_release_guard()` is a database trigger
  that rejects any attempt to mark a commission released before `payable_after`, and
  makes `released_at` immutable once set. A bug, a bad admin click, or a direct SQL
  update cannot bypass it. `/api/admin/commissions` refuses early release too.
- **One path pays.** `/api/cron/release-commissions` (daily, `CRON_SECRET`-guarded)
  is the only code that moves commission money.

**The honest limit:** the reserved amount sits in NorthEDM's own Stripe balance until
release, so it is not *technically* frozen against the owner — no app can freeze its
owner's own bank balance. It is instead made unmistakable: `/admin/promoter-payouts`
shows **"Reserved for promoters — do not spend"** with the live total. If a hard
ring-fence is ever wanted, the upgrade is to transfer at sale time into the promoter's
connected account with a payout delay longer than the refund window — at the cost of
depending on reversal, which is why it wasn't chosen here.

Lifecycle: `held → paid` (window closed, transfer sent) or `held → reversed`
(refund/dispute, nothing moved) or `paid → reversed|failed` (backstop clawback).

## Payment mechanics (can't bounce; pay only on secured funds)

- Customer pays by **card via Stripe** (Stripe Elements — card data never touches our
  servers; PCI SAQ-A). A card charge is **authorized + captured**, so funds are
  secured before anything moves. Insufficient funds → the charge fails → no sale, no
  commission.
- The promoter's cash is moved **only after `payment_intent.succeeded`** (webhook,
  signature-verified). Separate charge + transfer: charge the discounted amount on
  the platform, then `stripe.transfers.create` the commission to the promoter's
  connected account. Idempotent via `commissions UNIQUE(source_type, source_id)` so a
  retried webhook can't double-pay.
- **Deposits:** commission accrues on the amount actually paid (a deposit pays a
  proportional commission; the balance pays the rest on final payment).
- **Refund/chargeback:** if the customer is refunded, reverse the promoter transfer
  (`stripe.transfers.createReversal`) so we don't pay commission on undone sales.

## Promoter not yet connected

If a promoter's code drives a sale before they've connected a bank, the commission is
**recorded as pending** (`commissions.status='pending'`) and **paid via transfer as
soon as they finish Stripe onboarding**. The money waits in NorthEDM's own Stripe
balance (our revenue), not as custodied customer funds — paying an owed commission
later is normal business, not money transmission.

## Payout rails — promoter picks one (Stripe or PayPal)

A promoter chooses a **payout method**; at commission time we route their cut down
the chosen rail. Both are pass-through (we never hold their money).

**Stripe (bank account or debit card)** — default/recommended.
- Uses the existing `festdash_promoters.stripe_account_id` (Stripe Connect Express;
  onboarding route already exists: `/api/festdash/promoter/stripe/connect`).
- **"Connect Bank"** opens Stripe's **hosted** onboarding: the promoter enters/saves
  bank details and sets a default payout account **on Stripe's pages**. We never see
  or store account/routing numbers. Stripe also does the required identity/KYC.
- Payouts handled by Stripe (automatic on a schedule; instant available in their
  Express dashboard). Reaches any US bank or debit card — including Square users'
  banks.

**PayPal (PayPal Payouts API)** — optional alternative.
- Promoter provides their PayPal email; commission sent via PayPal Payouts. Needs a
  PayPal business account with Payouts enabled + its API creds. Different fee schedule.
- Store the chosen method + PayPal email on the promoter record; never store card/bank
  numbers for either rail.

**Square — NOT a payout destination.** Square only *accepts* payments (pull); it has
no API to *receive* a pushed payout from a platform (push). There is nothing to send
to. Square users are still paid via the Stripe (bank) rail — the money lands in the
same bank. Revisit only if Square ships a platform-payout product.

Offered at **promoter signup** (so they're ready to receive) and on the dashboard.
"Withdrawal" is largely automatic on both rails; an optional manual payout button can
come later.

## Attribution (who referred whom)

- `promoter_codes(user_id UNIQUE, code UNIQUE, active)` — the permanent code/QR.
- `referral_attributions(referred_user_id UNIQUE, promoter_user_id, code, created_at,
  CHECK referred<>promoter)` — first-touch, immutable, no self-referral. Set when a
  customer arrives via `?ref=<code>`/QR or enters a code.
- At a paid action, if the payer (or the entered code) maps to a promoter, we create
  a `commissions` row and the Stripe transfer.

## Data (all applied + verified; RLS on; owners read own rows only)

- `promoter_codes`, `referral_attributions`, `commission_rates`, `commissions`.
- Wallet/earnings = the existing `store_credit_*` (on-site credit only). Cash
  commissions do **not** touch store credit — they go straight through Stripe.

## Security checklist (must hold before go-live)

- [ ] Card entry only via Stripe Elements/Checkout (verify no card fields POST to our API).
- [ ] Stripe webhooks verify `STRIPE_WEBHOOK_SECRET` before acting.
- [ ] Commission transfer only after payment success; idempotent per `(source_type, source_id)`.
- [ ] Refund/chargeback reverses the transfer.
- [ ] Self-referral blocked; attribution first-touch + immutable.
- [ ] `commissions`/`promoter_codes`/`referral_attributions` RLS on; no client writes; owners read own.

## Build stages (each its own PR, verified — needs connectors up + test cards)

1. ✅ Schema (promoter_codes, referral_attributions, commission_rates, commissions).
2. **Reusable promoter code + QR** on dashboard/referrals; **attribution** at signup
   and via a checkout code field. _No money movement — safe to build/verify first._
3. **Commission on a paid action** (start with service invoices/quotes): discount at
   pay time + Stripe transfer to the promoter on payment success. _Live Stripe test._
4. Extend commission hooks to shop orders, vendor listings, foraging tours, FestDash.
5. **Connect-at-signup** + payout-method choice (Stripe or PayPal) + earnings/payout
   view. PayPal rail needs PayPal Payouts API creds (PAYPAL_CLIENT_ID / SECRET).
6. Refund/chargeback reversal handling (both rails).
