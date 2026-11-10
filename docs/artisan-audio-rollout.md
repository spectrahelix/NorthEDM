# Artisan audio rollout

This adds a portfolio-first audio player and optional licensed digital downloads.
There is no requirement to create a shop or subscribe to a marketplace plan.
Free previews do not require a bank account. Creator sales use a separate Stripe
Express account; only the creator enters their identity and bank details at Stripe.

## Deployment gate

Keep this feature PR in draft until the database migration has been applied and
the two-account Stripe test flow below passes. A green build does not prove that
the live database has the new tables or that payouts work. Do not merge solely
because Vercel is green.

1. Apply `supabase/migrations/20261110230000_artisan_audio.sql` to the target
   Supabase project after the existing artisan and access-hardening migrations.
   It creates private sales/order/payout tables, public preview storage, and
   private immutable original storage. Validate actual live grants and storage
   policies as anon, creator, and a different signed-in user.
2. Use a staging deployment with Supabase service credentials and Stripe TEST
   credentials. Keep production and test Stripe account IDs and data separate.
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
10. After all checks pass, mark the PR ready and follow the repository's green
    exact-head merge and production verification process. Verify with a real
    production creator onboarding only when that creator completes it themselves.

## Byron account update

The requested public bio is exactly `Voice Actor/Creative Writer`. Match Byron's
actual account ID/username before editing the bio and approving any artisan tag.
Do not infer identity from a first name or insert a guessed account ID into a
migration. The NorthEDM `/portfolio` contributor listing can name Byron without
claiming his account bio was edited.

## Verification

`npm run check`, `npm run test:artisan-audio`, `npx tsc --noEmit`, and `npm run build`.
The audio tests execute the actual migration with PostgreSQL RLS, plus provider
payment validation and webhook replay checks. They do not replace live Stripe,
bank, or Supabase verification. No live charge or bank transaction is authorized
by running the tests.
