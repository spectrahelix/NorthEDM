# NorthEDM — Site Audit

_Living report. Regenerated weekly by `.github/workflows/weekly-audit.yml` and on demand with `node scripts/site-audit.mjs`. The weekly run also opens a dated GitHub issue labeled `weekly-audit` so nothing has to be checked by hand._

**Last run:** 2026-11-06 18:17 UTC
**Health:** 🟢 All clear (mechanical) · 🟡 judgment pass 2026-11-06: 3 real gaps found and fixed, see Findings

| Area | Result |
| :-- | :-- |
| Features (pages) | **90** routes (12 dynamic) |
| API endpoints | **136** |
| Security (npm audit) | 0 critical · 0 high · 10 moderate · 0 low |
| Wiring | ✅ consistent |
| TypeScript | ✅ clean |
| Migrations | 95 (latest: `20261106010000_festdash_customer_live.sql`) |
| Env vars referenced | 27 |
| TODO/FIXME | 0 |



---

## Findings — judgment audit 2026-11-06

Most important first. "Fixed" means applied and checked, as noted.

1. **Forum moderation was browser-only — fixed.** The composer asked
   `/api/moderate`, then inserted into `threads` / `replies` with the user's own
   session, so a direct REST call skipped the slur list and link-spam limits.
   Now a database trigger (`forum_guard`, `forum_text_problem()`) applies the
   same hard rules on every write. Checked: 5 links refused, a normal post
   accepted, "spice" / "Scunthorpe" / "do you" not flagged; the composers
   already show the database's message. Keep the trigger's list in step with
   `app/api/moderate/route.ts`.
2. **The Android app could not use location — fixed in code, needs a build.**
   `AndroidManifest.xml` only declared INTERNET, so inside the app the FestDash
   runner ping, campsite pin and customer live share would fail silently.
   Added coarse + fine location (GPS not required) and bumped to versionCode 3.
   Rebuild with Actions → Android (AAB). Screen wake lock is not supported in
   the Android WebView; a Capacitor keep-awake plugin would be needed for that.
3. **Promoter hoodie scans were orphaned — fixed.** `/h/<code>` sets the
   `ne_hoodie` cookie, but only the retired `/shop` cart read it; `/shop` now
   redirects to `/northedm`. The brand store's checkout now accepts a hoodie
   code (typed, or from the cookie when the box is empty) as its promoter's
   code. Impact so far: none — 22 active hoodies, 0 scans ever.
4. **`/admin/shop` is a dead end for new items — signposted.** Six inactive $0
   copies of the mushroom items sit in `shop_products` (2026-11-05); that store
   is unreachable. A banner now points to `/northedm` and the inventory
   dashboard. Rows left in place (store credit still spends through it).
5. **No active FestDash runners (0).** Deliveries can't happen until a runner
   registers and is switched on in /admin/festdash. Gee's shop is pickup-only,
   so nothing is broken today.
6. **Two trigger functions were callable over RPC — fixed.** Revoked EXECUTE on
   `protect_runner_activation()` / `protect_vendor_admin_fields()` from
   anon/authenticated (checked: now PGRST202 for anon; `is_site_admin` still
   answers). The other SECURITY DEFINER helpers the advisor lists are used
   inside RLS policies and must stay executable.
7. **Supabase advisor, informational.** 18 tables with RLS on and no policies —
   all read/written only with the service role (each call site checked), so
   intended. 62 tables visible in the GraphQL schema — rows still RLS-guarded
   and the site never uses GraphQL; disabling `pg_graphql` would hide them
   (needs the owner's approval prompt). Performance: 70 policies call
   `auth.uid()` per row (wrap in `(select auth.uid())`), 38 unindexed foreign
   keys, 16 unused indexes — irrelevant at 21 users, worth doing before growth.
8. **npm audit: 10 moderate, all in eslint tooling** (dev only). The suggested
   fix is a major *downgrade* of eslint-config-next — leave it. Next.js 16.4.3
   (≥ 16.4.1 floor).

**Growth & backlog:** 21 accounts (3 in 7 days, 7 in 30, latest 2026-11-03);
37 distinct visitors / 380 views in 7 days; 4 forum threads (last 2026-11-03);
0 social posts; 8 FestDash orders and 1 store order ever. `error_reports`: no
open items (11 spam sign-in-help, 2 dismissed). Events pipeline healthy: 127
upcoming live, ingested today, **16 pending review** in /admin/events.

**Migrations:** applied set matches the repo through
`20261106010000_festdash_customer_live`; today's two audit migrations applied.
Sentinel's migration is parked (needs the owner's Supabase approval).

**Env:** all high-impact keys present in Vercel production (names only
checked): Supabase, Stripe, Brevo, NTFY, cron, Mapbox, Ticketmaster.
`BREVO_API_KEY` is a readable (not "Sensitive") variable — consider switching.

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
| `BREVO_API_KEY` | server | — |
| `BREVO_SENDER_EMAIL` | server | — |
| `CRON_SECRET` | server | — |
| `GITHUB_ISSUES_REPO` | server | — |
| `GITHUB_ISSUES_TOKEN` | server | — |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | public | — |
| `NEXT_PUBLIC_SITE_URL` | public | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | — |
| `NEXT_PUBLIC_SUPABASE_URL` | public | — |
| `NEXT_PUBLIC_SW_VERSION` | public | — |
| `NODE_ENV` | server | — |
| `NTFY_SERVER` | server | — |
| `NTFY_TOPIC` | server | — |
| `OWNER_ALERT_EMAIL` | server | — |
| `PAYPAL_CLIENT_ID` | server | — |
| `PAYPAL_ENV` | server | — |
| `PAYPAL_SECRET` | server | — |
| `PDF_CHROMIUM_PATH` | server | — |
| `SEATGEEK_CLIENT_ID` | server | — |
| `SQUARE_VERSION` | server | — |
| `STRIPE_SECRET_KEY` | server | — |
| `STRIPE_WEBHOOK_SECRET` | server | — |
| `SUPABASE_SERVICE_ROLE_KEY` | server | — |
| `TICKETMASTER_API_KEY` | server | — |
| `VERCEL_ENV` | server | — |
| `WAYCHIT_API_KEY` | server | — |
| `WAYCHIT_WEBHOOK_SECRET` | server | — |

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
