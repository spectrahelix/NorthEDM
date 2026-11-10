# FestDash — secure handoff and payment flow

NorthEDM's festival pickup/delivery flow uses payment-provider authorization,
then captures only after both sides confirm physical handover. It is not a
customer deposit account or a separately licensed escrow product.

## Current implementation (owner decision, 2026-11-10)

1. A signed-in customer orders. New FestDash orders use card or a card-backed
   wallet through Stripe, with `capture_method: manual`. Direct mobile-wallet
   transfers and Waychit are not offered for this flow because they cannot
   provide the same hold/cancel/refund behavior. Shop subscriptions and store
   orders have their own payment paths; their rails are not changed here.
2. The provider confirms an authorization before the order reaches the shop.
   A late checkout cannot revive a canceled order; its payment is canceled or
   refunded. A US independent shop must have a payout account before checkout.
3. The shop accepts; a different, active Dasher claims and begins delivery.
   Pickup uses an authorized shop operator instead of a Dasher.
4. `festdash_handoffs` stores two different, cryptographically random four-digit
   codes. RLS plus revoked grants keep the table and RPC inaccessible to ordinary
   sessions. Codes are absent from order rows, the open runner pool and realtime.
   The authenticated handoff endpoint returns **only the caller's own code**.
5. At physical handover the customer enters the Dasher/shop code in their own
   account; the Dasher/shop enters the customer's code in theirs. Phone digits
   never confirm handover. One account cannot supply both confirmations.
6. `festdash_handoff()` locks the order then its handoff row. Failed guesses are
   persisted; ten wrong attempts lock that party. Either participant can report
   a problem, which pauses release. Only both confirmations mark physical
   fulfillment delivered. A DB trigger blocks stale routes from marking delivered
   or releasing payment without the two confirmations.
7. The settlement helper independently rechecks the two confirmations before
   capture. Conditional claims and stable provider idempotency keys protect
   retries. Stripe's actual payment state is retrieved after ambiguous timeouts.
   Capture and provider payouts are separate from physical handover status.
8. An unaccepted order can be canceled by its customer. A shop or assigned
   Dasher can mark an unfulfilled order unable to complete. A conditional status
   update prevents cancellation from racing a finished handoff. Uncaptured holds
   are canceled; captured payments are refunded to the original payment method,
   reversing a destination transfer/application fee when appropriate.
9. Pending or failed refunds are never displayed as successful. Refund IDs,
   settlement markers and private errors support reconciliation. The existing
   commissions cron also retries unsettled terminal FestDash orders. Authorization
   expiry/failure webhooks close unfulfilled orders. Do not automatically renew
   an expired authorization or charge another card without fresh authorization.
10. Regional card orders still book the shop/runner shares for the owner's
    approved manual Remitly settlement. This change does **not** make Gambian
    bank/wallet payouts automatic. Existing unsupported manual-payment orders
    need owner/provider review; the app cannot claw back an off-platform transfer.

## Source paths

- Order creation: `app/api/festdash/orders/route.ts`.
- Private codes and confirmation: `utils/festdashHandoff.ts`,
  `app/api/festdash/orders/[id]/handoff/route.ts`, migration below.
- Provider settlement: `utils/festdashPaymentCore.ts`,
  `utils/festdashSettlement.ts`; webhook plus authenticated authorization fallback.
- Shared UI: `app/components/festdash/HandoffConfirmation.tsx` on the customer
  tracker, Dasher console and pickup shop dashboard.
- Existing payout helpers remain authoritative for fees/commission rates.
- Customer terms `/terms#festdash`; Dasher terms `/festdash/driver/terms`;
  promoter/coordinator terms `/promote/terms`.

## Required rollout and checks

**Apply `supabase/migrations/20261110220000_festdash_two_party_handoff.sql` before
merging/deploying this feature.** It creates the private table/RPC, guards release,
and retires unfinished phone-derived codes. Missing schema fails closed: no new
checkout is started and no handoff can release payment. Keep the PR in draft
until the migration and its live grants are verified. Do not remove the release
trigger to make an older client work; update the client or fix forward.

Run `npm run test:festdash`, `npm run check`, TypeScript and the production build.
The handoff suite uses embedded PostgreSQL (PGlite) to execute the actual migration
and RPC: role privacy, two accounts, both confirmations, guessing limits,
problem pause, cancellation ordering, pickup access and release guards. Provider
fixtures test capture/cancel/refund, mismatched amounts, pending and failed
refunds, idempotency and timeout recovery without moving real money.

Before claiming live money movement verified, use Stripe test mode and two test
accounts to verify: no capture after one confirmation; capture after both in
either order; decline/cancel releases an authorization; a captured failed-payment
fixture refunds; expired and mismatched payments never pay out; both callers
receive only their own code. Do not run an unrequested real charge for testing.

The following coordinator history documents regional subscriptions and settlement;
its earlier direct-wallet FestDash order descriptions are superseded by the
secure card flow above. Regional provider onboarding restrictions still apply.

---

## Gambia / coordinator model

Added 2026-11-01 for Gee (The Gambia), where the rails are mobile-money wallets
(Wave first, then QMoney and Afrimoney), cash on delivery, and ordering over
WhatsApp. Stage one is live; stage two is the only part that needs a third party.

**Roles.** A **coordinator** (purse keeper) is an approved promoter the owner
switches on in `/admin/festdash/coordinators`, with a region and wallet numbers
they maintain themselves in `/festdash/purse`. Shops the coordinator signs up are
assigned to them there too (`vendors.coordinator_user_id`, `currency`,
`whatsapp_number`).

**Money.** Shops pay a flat fee ($30/month by default) to be listed; customers
pay the coordinator's wallet (cash on delivery was removed 2026-11-02: payment
is confirmed before the shop cooks); the coordinator keeps 10% of
each sale and 10% of each fee, pays the shop its 80%, and sends the owner the
rest by Remitly. The site never holds any of it — it books every confirmed sale,
every fee and every remittance in `coordinator_ledger`, and the owner confirms
the dollars that actually land. Percentages and the fee live in
`coordinator_program_settings`.

The same two percentages govern **US card orders** (2026-11-02). Stripe takes
owner % + coordinator % (20% by default) as the platform fee on the destination
charge when the order is delivered, the vendor's Connect account receives the
rest (80%), and the coordinator's part is booked as a held commission at
delivery (`commissions`, source `festdash_order`) and paid through Connect by
the daily release cron once the refund window closes. A vendor with no
coordinator leaves that part with NorthEDM. Which rail an order takes is
`isLocalRail()` in `utils/gambiaPay.ts`: a coordinator **and** a non-USD
currency → wallets / cash and the monthly-fee gate; anything else → card.

**No store credit on vendor orders (2026-11-02).** Store credit is NorthEDM's
own liability. Spent on an independent vendor's order, the credit-covered part
never reached the vendor through Stripe, and a fully credit-covered order was
delivered and never paid for. The order route now ignores credit and the order
page no longer offers it; credit stays spendable on NorthEDM's shop and avatars.

**Nobody waits in silence (2026-11-02).** Every application alert to the owner
carries the whole application (`vendorApplicationFields`) and links to the
right admin card; **Email me this application** on /admin/vendors re-sends it.
Approve → the applicant gets an email with their next step (for a coordinator
shop: the fee, the coordinator's wallets and WhatsApp) and the coordinator gets
an email + in-app alert to collect the first fee. The coordinator logging a fee
→ the shop gets a "you're live through <date>" email. The daily
`/api/cron/subscription-reminders` job (also the **Run fee reminders now**
button in /admin/festdash/coordinators) emails shop and coordinator a week
before a period ends, on its last day, and once after it lapses, stamped per
period on `vendor_subscriptions` so each goes once. Assigning a coordinator to
an already-approved vendor now enrols it on FestDash (`enrollCoordinatorShop`).

**Flow.** Checkout for a coordinator shop offers Wave / QMoney / Afrimoney /
cash (and a prefilled "order on WhatsApp" link). A wallet order waits in
`awaiting_confirmation`: the customer sees the wallet number and a short
reference (`FD-xxxxxx`), pays in their app, enters the transaction ref; the
coordinator matches it in their wallet and taps confirm; the order enters the
shop's queue. Cash orders go to the queue at once and settle when the runner
enters the delivery code. A shop with no current fee period is hidden from the
FestDash list and refused by the order API.

**Shop onboarding.** A shop owner scans the flyer's QR to `/festdash/shop-setup`,
creates their own account (the page passes `?next=` through signup so they come
back), and sends one application: what they sell, area, WhatsApp, the wallet
they want paid to (Wave / QMoney / Afrimoney, or cash), the coordinator's code,
and acceptance of the fee and split. The owner's Approve in /admin/vendors links
the account and enrols the shop on FestDash; the coordinator's first logged fee
makes it visible. The shop owner keeps control of their own account and wallet
and can change the wallet on the same page. Transfer-time notes for each app
are shown at checkout, on the pay screen and in setup (`utils/paymentNotes.ts`).

**Stage two.** Wave publishes a Business/Checkout API (requires a Wave Business
account in The Gambia); Afrimoney follows the GSMA merchant API (onboarding via
Africell); QMoney integrates by partnership. Gambian aggregators (Modem Pay,
Waychit) claim one API for all three. Any of them replaces the manual confirm
with a signed webhook that sets `payment_ref`/`payment_confirmed_*` — the data
model already has the columns.

**Payouts to the coordinator.** Stripe Connect's self-serve cross-border payouts
do not reach The Gambia; Stripe Global Payouts does (GMD by wire) but is a
separate integration. Until then the coordinator keeps his cut from what he
collects, which is why the ledger counts "owed to owner" rather than "owed to
coordinator".
