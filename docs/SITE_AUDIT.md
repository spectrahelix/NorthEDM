# NorthEDM — Site Audit

_Living report. Regenerated weekly by `.github/workflows/weekly-audit.yml` and on demand with `node scripts/site-audit.mjs`. The weekly run also opens a dated GitHub issue labeled `weekly-audit` so nothing has to be checked by hand._

**Last run:** 2026-11-09 18:44 UTC
**Health:** 🟢 All clear

| Area | Result |
| :-- | :-- |
| Features (pages) | **90** routes (12 dynamic) |
| API endpoints | **136** |
| Users | **21** total · 2 new (7d) · 6 new (30d) |
| Latest signup | 2026-11-03 (5d ago) |
| Open bug/feedback reports | 0 of 13 total |
| Security (npm audit) | 0 critical · 0 high · 10 moderate · 0 low |
| Wiring | ✅ consistent |
| TypeScript | ✅ clean |
| Migrations | 97 (latest: `20261106030000_revoke_trigger_fn_execute.sql`) |
| Env vars referenced | 27 |
| TODO/FIXME | 0 |


<sub>FYI (not a problem): 25 env vars aren't set in CI — expected, CI has no Vercel secrets. Full list in docs/SITE_AUDIT.md.</sub>

---

## Feature inventory (90 pages)

- `/[store]`
- `/[store]/manage`
- `/admin`
- `/admin/analytics`
- `/admin/artisans`
- `/admin/blocks`
- `/admin/bookings`
- `/admin/bug-reports`
- `/admin/codes`
- `/admin/commissions`
- `/admin/create-user`
- `/admin/events`
- `/admin/festdash`
- `/admin/festdash/coordinators`
- `/admin/festdash/promoters`
- `/admin/hoodies`
- `/admin/marketplace`
- `/admin/products`
- `/admin/promoter-payouts`
- `/admin/quotes`
- `/admin/reports`
- `/admin/requests`
- `/admin/shipping`
- `/admin/shop`
- `/admin/shop/orders`
- `/admin/social`
- `/admin/stores`
- `/admin/users`
- `/admin/vendors`
- `/apps-and-tools`
- `/apps-and-tools/astrology-hebrew-numerology`
- `/artisans`
- `/auth/finish`
- `/avatar/builder`
- `/crowdwave`
- `/crowdwave/festival/[id]`
- `/crowdwave/festival/elements-2026`
- `/crowdwave/groups`
- `/events`
- `/feed`
- `/feedback`
- `/festdash`
- `/festdash/commission-codes`
- `/festdash/driver`
- `/festdash/order`
- `/festdash/orders`
- `/festdash/pass`
- `/festdash/purse`
- `/festdash/shop-setup`
- `/festdash/track/[id]`
- `/festdash/vendor-dashboard`
- `/festdash/vendor-signup`
- `/foraging`
- `/forgot-password`
- `/forum`
- `/forum/[id]`
- `/login`
- `/marketplace`
- `/marketplace/[id]`
- `/marketplace/[id]/item/[itemId]`
- `/marketplace/apply`
- `/marketplace/country/[code]`
- `/messages`
- `/offline`
- `/orders/[kind]/[id]/[doc]`
- `/page.tsx`
- `/portfolio`
- `/privacy`
- `/profile/[id]`
- `/profile/edit`
- `/promote`
- `/promote/codes`
- `/promote/dashboard`
- `/quote/[token]`
- `/requests`
- `/reset-password`
- `/shop`
- `/shop/[slug]`
- `/shop/cart`
- `/shop/success`
- `/signin-help`
- `/signup`
- `/social`
- `/terms`
- `/vendor`
- `/vendor/dashboard`
- `/vendors`
- `/vendors/apply`
- `/verify-email`
- `/wook-world`

## API endpoints (136)

- `/api/admin/artisan`
- `/api/admin/blocks`
- `/api/admin/bug-reports`
- `/api/admin/codes`
- `/api/admin/commissions`
- `/api/admin/create-user`
- `/api/admin/delete-user`
- `/api/admin/edit-user`
- `/api/admin/get-users`
- `/api/admin/hoodies`
- `/api/admin/hoodies/qr`
- `/api/admin/local-events`
- `/api/admin/marketplace`
- `/api/admin/quotes`
- `/api/admin/requests`
- `/api/admin/set-role`
- `/api/admin/shipping`
- `/api/admin/shop/orders`
- `/api/admin/shop/orders/[id]`
- `/api/admin/shop/products`
- `/api/admin/shop/products/[id]`
- `/api/admin/shop/upload`
- `/api/admin/social`
- `/api/admin/stores`
- `/api/admin/update-report`
- `/api/admin/user-details`
- `/api/admin/user-tags`
- `/api/admin/username-nudge`
- `/api/apps-tools/astrology-hebrew/calculate`
- `/api/apps-tools/astrology-hebrew/resolve-place`
- `/api/auth/forgot-password`
- `/api/auth/resend-confirmation`
- `/api/auth/signup`
- `/api/avatar/purchase`
- `/api/billing/checkout`
- `/api/billing/portal`
- `/api/billing/status`
- `/api/booking`
- `/api/cron/local-events`
- `/api/cron/release-commissions`
- `/api/cron/subscription-reminders`
- `/api/feedback`
- `/api/festdash/admin/applications`
- `/api/festdash/admin/applications/[id]`
- `/api/festdash/admin/bridge`
- `/api/festdash/admin/coordinator`
- `/api/festdash/admin/drivers`
- `/api/festdash/admin/promoter-applications`
- `/api/festdash/admin/promoter-applications/[id]`
- `/api/festdash/admin/vendors`
- `/api/festdash/admin/wallet-watch`
- `/api/festdash/driver`
- `/api/festdash/driver/orders`
- `/api/festdash/driver/stripe/connect`
- `/api/festdash/driver/stripe/status`
- `/api/festdash/menu/[vendorId]`
- `/api/festdash/orders`
- `/api/festdash/orders/[id]`
- `/api/festdash/orders/[id]/claim`
- `/api/festdash/orders/[id]/confirm-payment`
- `/api/festdash/orders/[id]/customer-location`
- `/api/festdash/orders/[id]/location`
- `/api/festdash/orders/[id]/payment-ref`
- `/api/festdash/pass`
- `/api/festdash/promo-codes`
- `/api/festdash/promo-codes/validate`
- `/api/festdash/promoter/hoodies`
- `/api/festdash/promoter/referral-code`
- `/api/festdash/promoter/stripe/connect`
- `/api/festdash/promoter/stripe/status`
- `/api/festdash/purse`
- `/api/festdash/purse/bridge`
- `/api/festdash/purse/remittance`
- `/api/festdash/purse/subscription`
- `/api/festdash/shop-setup`
- `/api/festdash/stripe/confirm`
- `/api/festdash/stripe/connect`
- `/api/festdash/stripe/status`
- `/api/festdash/stripe/webhook`
- `/api/festdash/vendor-signup`
- `/api/festdash/vendors`
- `/api/fx`
- `/api/hoodie`
- `/api/local-rules`
- `/api/marketplace/apply`
- `/api/moderate`
- `/api/profile/username`
- `/api/promote`
- `/api/promote/mint`
- `/api/promote/validate-code`
- `/api/quote/[token]/pay`
- `/api/ranks`
- `/api/referrals/generate`
- `/api/report`
- `/api/requests`
- `/api/search`
- `/api/shipping/quote`
- `/api/shop/checkout`
- `/api/shop/webhook`
- `/api/signin-help`
- `/api/social/broadcast`
- `/api/store-credit`
- `/api/store/[slug]`
- `/api/store/[slug]/checkout`
- `/api/store/[slug]/logo`
- `/api/store/[slug]/orders`
- `/api/store/[slug]/requests`
- `/api/store/orders/[id]/confirm-payment`
- `/api/store/orders/[id]/fulfill`
- `/api/store/orders/[id]/payment-ref`
- `/api/track`
- `/api/vendor/bridge`
- `/api/vendor/coordinator-book`
- `/api/vendor/me`
- `/api/vendor/metrics`
- `/api/vendor/payouts`
- `/api/vendor/photos`
- `/api/vendor/products`
- `/api/vendor/products/[id]`
- `/api/vendor/products/[id]/images`
- `/api/vendor/products/upload`
- `/api/vendor/square/connect`
- `/api/vendor/square/disconnect`
- `/api/vendor/square/status`
- `/api/vendor/square/sync`
- `/api/vendors`
- `/api/vendors/update`
- `/api/verify-email`
- `/api/vouchers/mine`
- `/api/wallet-dispute`
- `/api/waychit/admin`
- `/api/waychit/status`
- `/api/waychit/webhook`
- `/auth/callback`
- `/auth/confirm`
- `/h/[code]`

## Environment variables (27 referenced)

| Variable | Scope | CI status |
| :-- | :-- | :-- |
| `BREVO_API_KEY` | server | ❌ missing |
| `BREVO_SENDER_EMAIL` | server | ❌ missing |
| `CRON_SECRET` | server | ❌ missing |
| `GITHUB_ISSUES_REPO` | server | ❌ missing |
| `GITHUB_ISSUES_TOKEN` | server | ❌ missing |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | public | ❌ missing |
| `NEXT_PUBLIC_SITE_URL` | public | ❌ missing |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | ❌ missing |
| `NEXT_PUBLIC_SUPABASE_URL` | public | ✅ set |
| `NEXT_PUBLIC_SW_VERSION` | public | ❌ missing |
| `NODE_ENV` | server | ❌ missing |
| `NTFY_SERVER` | server | ❌ missing |
| `NTFY_TOPIC` | server | ❌ missing |
| `OWNER_ALERT_EMAIL` | server | ❌ missing |
| `PAYPAL_CLIENT_ID` | server | ❌ missing |
| `PAYPAL_ENV` | server | ❌ missing |
| `PAYPAL_SECRET` | server | ❌ missing |
| `PDF_CHROMIUM_PATH` | server | ❌ missing |
| `SEATGEEK_CLIENT_ID` | server | ❌ missing |
| `SQUARE_VERSION` | server | ❌ missing |
| `STRIPE_SECRET_KEY` | server | ❌ missing |
| `STRIPE_WEBHOOK_SECRET` | server | ❌ missing |
| `SUPABASE_SERVICE_ROLE_KEY` | server | ✅ set |
| `TICKETMASTER_API_KEY` | server | ❌ missing |
| `VERCEL_ENV` | server | ❌ missing |
| `WAYCHIT_API_KEY` | server | ❌ missing |
| `WAYCHIT_WEBHOOK_SECRET` | server | ❌ missing |

_CI status is blank when run locally. Missing server secrets in CI is normal — what matters is they're set in **Vercel** (Production) and, for the audit's own growth stats, as **GitHub Actions secrets**._

## How to read this

- **Features** — every page/route that exists. If something you expect is missing, it wasn't shipped or was removed.
- **Security** — `npm audit`. Criticals/highs are worth a look; `npm audit fix` handles most.
- **TypeScript** — a non-zero count means the production build is probably broken.
- **Env vars** — anything the code reads. A missing one in Vercel silently disables that feature (e.g. no `BREVO_API_KEY` → no owner emails).

## Deeper, judgment-based audits

Basic growth (users, recent signups, open reports) is included automatically when
the Supabase Actions secrets are set. For the deeper read — RLS-policy gaps, dead
notification paths, funnel analysis, and which features are actually *working*
(not just present) — run the Claude playbook: **`/site-audit`** in a Claude Code
session.
