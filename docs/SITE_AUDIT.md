# NorthEDM — Site Audit

_Living report. Regenerated weekly by `.github/workflows/weekly-audit.yml` and on demand with `node scripts/site-audit.mjs`. The weekly run also opens a dated GitHub issue labeled `weekly-audit` so nothing has to be checked by hand._

**Last run:** 2026-08-18 14:23 UTC
**Health:** ⚪ 3 TODO/FIXME markers

| Area | Result |
| :-- | :-- |
| Features (pages) | **77** routes (10 dynamic) |
| API endpoints | **80** |
| Security (npm audit) | 0 critical · 0 high · 0 moderate · 0 low |
| TypeScript | ✅ clean |
| Migrations | 34 (latest: `20260818000000_audit_growth_stats.sql`) |
| Env vars referenced | 19 |
| TODO/FIXME | 3 |



---

## Feature inventory (77 pages)

- `/[store]`
- `/[store]/manage`
- `/admin`
- `/admin/analytics`
- `/admin/artisans`
- `/admin/bookings`
- `/admin/bug-reports`
- `/admin/commissions`
- `/admin/create-user`
- `/admin/events`
- `/admin/festdash`
- `/admin/festdash/promoters`
- `/admin/hoodies`
- `/admin/marketplace`
- `/admin/products`
- `/admin/quotes`
- `/admin/reports`
- `/admin/requests`
- `/admin/shop`
- `/admin/shop/orders`
- `/admin/social`
- `/admin/stores`
- `/admin/users`
- `/admin/vendors`
- `/artisans`
- `/avatar/builder`
- `/crowdwave`
- `/crowdwave/festival/[id]`
- `/crowdwave/festival/elements-2026`
- `/crowdwave/forum`
- `/crowdwave/forum/[id]`
- `/crowdwave/groups`
- `/events`
- `/feed`
- `/feedback`
- `/festdash`
- `/festdash/commission-codes`
- `/festdash/driver`
- `/festdash/order`
- `/festdash/orders`
- `/festdash/promoter-dashboard`
- `/festdash/promoter-signup`
- `/festdash/referrals`
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
- `/marketplace/apply`
- `/messages`
- `/offline`
- `/page.tsx`
- `/portfolio`
- `/privacy`
- `/profile/[id]`
- `/profile/edit`
- `/quote/[token]`
- `/requests`
- `/reset-password`
- `/shop`
- `/shop/[slug]`
- `/shop/cart`
- `/shop/success`
- `/signup`
- `/social`
- `/terms`
- `/vendor`
- `/vendor/dashboard`
- `/vendors`
- `/vendors/apply`
- `/verify-email`
- `/wook-world`

## API endpoints (80)

- `/api/admin/artisan`
- `/api/admin/bug-reports`
- `/api/admin/create-user`
- `/api/admin/delete-user`
- `/api/admin/edit-user`
- `/api/admin/get-users`
- `/api/admin/hoodies`
- `/api/admin/hoodies/qr`
- `/api/admin/local-events`
- `/api/admin/marketplace`
- `/api/admin/quotes`
- `/api/admin/set-role`
- `/api/admin/shop/orders`
- `/api/admin/shop/orders/[id]`
- `/api/admin/shop/products`
- `/api/admin/shop/products/[id]`
- `/api/admin/shop/upload`
- `/api/admin/social`
- `/api/admin/stores`
- `/api/admin/update-report`
- `/api/admin/user-tags`
- `/api/auth/resend-confirmation`
- `/api/auth/signup`
- `/api/avatar/purchase`
- `/api/booking`
- `/api/cron/local-events`
- `/api/feedback`
- `/api/festdash/admin/applications`
- `/api/festdash/admin/applications/[id]`
- `/api/festdash/admin/promoter-applications`
- `/api/festdash/admin/promoter-applications/[id]`
- `/api/festdash/admin/vendors`
- `/api/festdash/driver`
- `/api/festdash/driver/orders`
- `/api/festdash/menu/[vendorId]`
- `/api/festdash/orders`
- `/api/festdash/orders/[id]`
- `/api/festdash/orders/[id]/claim`
- `/api/festdash/orders/[id]/location`
- `/api/festdash/promo-codes`
- `/api/festdash/promo-codes/validate`
- `/api/festdash/promoter-signup`
- `/api/festdash/promoter/hoodies`
- `/api/festdash/promoter/referral-code`
- `/api/festdash/promoter/stripe/connect`
- `/api/festdash/promoter/stripe/status`
- `/api/festdash/stripe/confirm`
- `/api/festdash/stripe/connect`
- `/api/festdash/stripe/status`
- `/api/festdash/stripe/webhook`
- `/api/festdash/vendor-signup`
- `/api/festdash/vendors`
- `/api/hoodie`
- `/api/marketplace/apply`
- `/api/moderate`
- `/api/products`
- `/api/quote/[token]/pay`
- `/api/referrals/generate`
- `/api/report`
- `/api/requests`
- `/api/search`
- `/api/shop/checkout`
- `/api/shop/webhook`
- `/api/social/broadcast`
- `/api/store-credit`
- `/api/store/[slug]`
- `/api/track`
- `/api/vendor/products`
- `/api/vendor/products/[id]`
- `/api/vendor/products/upload`
- `/api/vendor/square/connect`
- `/api/vendor/square/disconnect`
- `/api/vendor/square/status`
- `/api/vendor/square/sync`
- `/api/vendors`
- `/api/vendors/update`
- `/api/verify-email`
- `/auth/callback`
- `/auth/confirm`
- `/h/[code]`

## Environment variables (19 referenced)

| Variable | Scope | CI status |
| :-- | :-- | :-- |
| `BREVO_API_KEY` | server | — |
| `BREVO_SENDER_EMAIL` | server | — |
| `CRON_SECRET` | server | — |
| `GITHUB_ISSUES_REPO` | server | — |
| `GITHUB_ISSUES_TOKEN` | server | — |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | public | — |
| `NEXT_PUBLIC_OPENWEATHER_API_KEY` | public | — |
| `NEXT_PUBLIC_SITE_URL` | public | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | — |
| `NEXT_PUBLIC_SUPABASE_URL` | public | — |
| `NEXT_PUBLIC_SW_VERSION` | public | — |
| `NTFY_SERVER` | server | — |
| `NTFY_TOPIC` | server | — |
| `OWNER_ALERT_EMAIL` | server | — |
| `SQUARE_VERSION` | server | — |
| `STRIPE_SECRET_KEY` | server | — |
| `STRIPE_WEBHOOK_SECRET` | server | — |
| `SUPABASE_SERVICE_ROLE_KEY` | server | — |
| `TICKETMASTER_API_KEY` | server | — |

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
