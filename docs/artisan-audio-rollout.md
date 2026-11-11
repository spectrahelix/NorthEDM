# Artisan audio rollout

This adds a portfolio-first audio player and optional licensed digital downloads.
There is no requirement to create a shop or subscribe to a marketplace plan.
Free previews do not require a bank account. Creator sales use a separate Stripe
Express account; only the creator enters their identity and bank details at Stripe.

## Deployment gate

Portfolio uploads and creator bank onboarding may ship once both database
migrations and the live privacy/grant checks pass. Paid offers and new orders are
blocked by `artisan_audio_config.sales_enabled = false`, including through older
preview deployments. The service role can read this setting but cannot enable
it. Do not enable paid purchases until the two-account Stripe test flow below
passes. A green build does not prove that payments or bank deposits work.

1. Apply `supabase/migrations/20261110230000_artisan_audio.sql` to the target
   Supabase project after the existing artisan and access-hardening migrations.
   Then apply `supabase/migrations/20261110233610_artisan_audio_activation_gate.sql`.
   Public profiles and the artisan directory use `PUBLIC_PROFILE_COLUMNS`,
   limited to columns already readable anonymously. Member-only username,
   application-status, and vendor-link fields are omitted for signed-out reads.
   No profile permissions were expanded; contact/address columns remain protected.
   These create private sales/order/payout tables, public preview storage,
   private immutable original storage, and a database-enforced purchase gate.
   Validate actual live grants and storage
   policies as anon, creator, and a different signed-in user.
2. Use an isolated staging deployment and database with Supabase service credentials and Stripe TEST
   credentials. Keep production and test Stripe account IDs and data separate.
   Enable `artisan_audio_config.sales_enabled` only in that test database.
   Configure the existing `/api/festdash/stripe/webhook` endpoint with
   `checkout.session.completed`, `charge.refunded`, and `charge.dispute.created`.
3. With an approved artisan TEST account, upload a public audio sample. Confirm
   that it plays publicly with no sale controls and needs no bank information.
4. Complete Stripe Express test onboarding in the creator's own account. The
   artisan editor's optional audio-sales section must report payouts ready.
   Check the actual payout schedule in Stripe; do not promise instant bank deposits.
5. Upload a different, full original. Choose a price and describe the license.
   Accept the disclosed fee and seller terms, then enable sales. Verify the
   original is inaccessible from public storage and from a second ordinary user.
6. Buy from a DIFFERENT signed-in account with a Stripe test card. Verify the
   checkout amount, destination account, platform fee, original download, and
   saved license. Refresh/replay the webhook: no duplicate purchase or transfer.
   A forged success URL, unpaid checkout, wrong amount/currency/destination, or
   unverified seller must not unlock a download.
7. Change the offer's file/license and remove the portfolio work. The previous
   buyer must retain access to the purchased version in `/audio/purchases`.
8. Issue a creator refund from the sales list. Verify Stripe reverses the
   destination transfer and application fee, and the buyer's further downloads
   stop. Retry pending refunds, replay old payment events, and open a test dispute:
   none may restore access or issue a duplicate refund. A previously issued
   signed URL expires after 60 seconds; downloaded files cannot be recalled.
9. Validate on mobile. Android currently offers audio playback and access to
   existing purchases; native digital purchase buttons are withheld until an
   applicable Google Play billing or alternative-payment program is configured.
   Web purchases use NorthEDM's Stripe checkout.
10. After all provider checks pass, enable the production purchase gate with a
    reviewed migration and verify the changed behavior. Production creator bank
    onboarding must be completed by the creator themselves.

## Byron account update

The requested public bio is exactly `Voice Actor/Creative Writer`. On November
10, the connected NorthEDM database contained one matching username, `Byron`.
His existing Artisan tag was already on; his bio was updated and verified through
the returned database row. No rank or tag was granted by this update. The public
portfolio contributor credit was merged separately in #262.

## Verification

`npm run check`, `npm run test:artisan-audio`, `npx tsc --noEmit`, and `npm run build`.
The audio tests execute the actual migration with PostgreSQL RLS, plus provider
payment validation and webhook replay checks. They do not replace live Stripe,
bank, or Supabase verification. No live charge or bank transaction is authorized
by running the tests.
