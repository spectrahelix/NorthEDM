# NorthEDM — To-Do & Status

_Living reference of open work. Last updated: 2026-07-08._

---

## 🔴 Paused / pick back up

### 1. Google Workspace email — `cj@northedm.com`
- **Where we stopped:** signing up at workspace.google.com, on the **"Create a username"** screen. Use username **`cj`** → `cj@northedm.com`.
- **Next:** finish signup → Google shows a **TXT (verification)** + **MX** record → add them in **Wix → Domains → northedm.com → Edit DNS** → back in Google click **Verify / Activate**.
- Cost ~$7/mo (14-day free trial). DNS **stays on Wix** (no migration).
- Until this is done, `cj@northedm.com` cannot receive mail.

### 2. Play Store — publish the closed-testing release (tester link is broken until this is done)
- Download v2 AAB: `https://github.com/spectrahelix/NorthEDM/releases/download/android-latest/app-release.aab`
- Play Console → **Test & release → Testing → Closed testing → Alpha → Create new release** → upload the AAB (it's **versionCode 2**, uploads clean).
- **Countries/regions** tab → add **United States**. **Testers** tab → select your email list.
- **Save and publish** → Start rollout. First release goes through **Google review** (hours–2 days); the join link works once approved.
- Tester join link: `https://play.google.com/apps/testing/com.northedm.app`

### 3. Recruit 20 testers (gates public launch)
- Need **20 real Google accounts opted in for 14 continuous days** before you can apply for production.
- "Become a Tester" homepage banner + FB/IG posts are live. Push the join link.

### 4. Print collateral (ready when you are)
- **Sticker** — blended square is finalized & downloadable (`design/stickers/sticker-blended.png`). Round die-cut also available.
- **Business cards** — Design A finalized (`design/business-cards/card-A-front.png` + `-back.png`). ⚠️ Card shows `cj@northedm.com`; ideally wait until Workspace (#1) is live so the address works, or print with `northedm1@gmail.com` only.

---

## 🏗️ Vendor / FestDash / Profile feature (in progress)
Big multi-part build. Status:
- ✅ **Approval tag chips** — Founder (magenta, admin-granted, vendor-only), Vendor (green), FestDash Vendor (orange), Promoter (yellow), Artisan (gold). Show on profile/forum/hover; forum tags user-toggleable. Approvals light them up. **Done (#60).**
- ✅ **Extra tags** — Driver (teal), Forager/Guide (green), Verified (checkmark). Add as admin-grantable flags.
- ✅ **Admin "take the wheel"** — from admin view, open any user's profile + an Edit button to manually fix account fields.
- ✅ **Email change w/ verification** — when admin changes a user's email, send a verification email; only hard-save after they confirm.
- ✅ **3 profile CTA buttons** (on your own profile): Vendor apply / FestDash apply (gated on being a vendor) / Promoter apply — conditional clickable vs "you're already X, thank you" states (+ pending).
- ✅ **Personal info on profile** → auto-fills checkout (shop + FestDash) screens.
- ✅ **Vendor Profile + Upcoming Shows** — add shows manually or via CSV → editable "Upcoming Shows" array + "hide from listings" toggle. Current/next show shows on marketplace + FestDash listings.
- ✅ **FestDash page: list Active FestDash Vendors** with their current/next show + location; "🟢 Live now" badge; filter to the customer's chosen festival.

## 📅 Local Events aggregator (NEW — auto-updating, like the weather feature)
This is the "why didn't it collect Briggs Farm?" answer: there was **no** event
collector before — Upcoming Shows is vendor-entered. Now there's a real one.
- **What it does:** a nightly job refreshes a **curated seed list** of NE-PA
  festivals (Briggs Farm, Elements, Peach, Camp Bisco, Musikfest, NEPA Bluegrass,
  Susquehanna Breakdown — all seeded & live now) and, if a discovery key is set,
  pulls new nearby music events into a **pending queue** for your review.
- **Public page:** `/events` ("Upcoming Local Events") — each event shows its
  forecast via the same weather strip as the feed. Linked in the top nav.
- **Admin:** `/admin` → **Local Events** → review/approve/hide/delete + **↻ Refresh now**.
- **To turn on auto-discovery (optional):** set **`TICKETMASTER_API_KEY`** (free
  key from developer.ticketmaster.com) in Vercel env. Without it, only the
  curated seeds run — Briggs Farm & friends still show regardless.
- **To secure the nightly cron:** set **`CRON_SECRET`** in Vercel env (any random
  string). Vercel Cron sends it automatically; the schedule is in `vercel.json`
  (08:00 UTC nightly). Curated dates are approximate — **edit them on the admin
  screen** to lock in real 2026 dates as they're announced.

## ⚙️ Known incomplete / needs your input
- **Shop payments:** `STRIPE_WEBHOOK_SECRET` still needs to be set so store checkout auto-confirms orders + decrements stock via webhook. (The same secret serves the FestDash webhook.)
- **FestDash escrow is now built** — remaining is config only: live Stripe keys + webhook secret + Mapbox token, then an end-to-end test. See FestDash status section below.

---

## 🟡 Decisions / notes
- **Domain:** registered **and locked at Wix** (`clientTransferProhibited`). **Not** migrating to Cloudflare — not needed; email runs on Wix DNS via Workspace.
- **LLC:** confirmed official → "NorthEDM LLC" is live in footer, Privacy, Terms, and on cards.
- **Vercel/Brevo/ntfy are NOT inboxes:** Brevo = outbound send only; ntfy = phone push. Receiving mail needs Workspace (#1).

---

## 🟢 Done recently
- Artisans feature — public `/artisans` directory, verified Artisan tag in profiles/forum, expanded profile editor + portfolio, admin approval. **Live.**
- NorthEDM LLC footer + legal pages.
- Business card Design A + signup QR.
- Sticker (blended square + round die-cut) + homepage QR.
- Android build pipeline fixed (self-healing signing; v2 signed AAB).
- `/feedback` page + "Become a Tester" homepage banner.

---

## 🎪 FestDash status (as of this update)

FestDash is **well past** the old `docs/FESTDASH.md` "~60%" note — a lot shipped in `festdash_v2` + `festdash_promoters`. Read from current routes:

**Built & real:**
- Vendor enrollment (apply → admin approve → `festdash_vendors`).
- Customer ordering + vendor menu from `products`; order + track + vendor-dashboard + driver pages with realtime updates.
- Structured campsite fields, car/campsite photo upload, phone capture, **last-4 confirmation code**.
- **Driver flow:** claim orders + **live GPS location capture** (`orders/[id]/location`).
- **Stripe Connect vendor onboarding** — real Express-account creation + account links + payout status (`stripe/connect`, `stripe/status`); `stripe_account_id` on vendors.
- **✅ ESCROW PAYMENTS (built this session).** Checkout with **manual capture**:
  card is authorized + **held in escrow** at order → order stays hidden
  (`awaiting_payment`) until the hold confirms → **captured on confirmed
  delivery** (funds transfer to vendor, minus 5% fee via Connect destination
  charge) → **hold released** (canceled) on decline. Webhook
  (`stripe/webhook`) promotes orders + a `stripe/confirm` fallback covers the
  success redirect even before the webhook secret is set. Store-credit-covered
  orders skip payment. Files: `api/festdash/orders`, `orders/[id]`,
  `stripe/webhook`, `stripe/confirm`; migration `20260710100000_festdash_escrow`.
- Promoter program, referral codes, commission codes, store credit, promo codes.

**Remaining to be festival-ready (now just config + a test — no code):**
1. **Set live Stripe env vars in Vercel:** `STRIPE_SECRET_KEY` (sk_live),
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_live), and `STRIPE_WEBHOOK_SECRET`
   (whsec) after adding a webhook endpoint at
   `/api/festdash/stripe/webhook` for events `payment_intent.succeeded`,
   `payment_intent.payment_failed`, `payment_intent.canceled`,
   `checkout.session.completed`.
2. **`NEXT_PUBLIC_MAPBOX_TOKEN`** — the track page already renders a Mapbox
   static map; just needs the free-tier token to light up.
3. **End-to-end test** at a real/staged event (place → pay/hold → accept →
   deliver + code → capture → verify vendor payout in Stripe).
4. Confirm **realtime publication** + **storage bucket policies** SQL are applied.

_Note: escrow verified by file-by-file audit + typecheck + production build; the
`profiles.vendor_id` linkage was checked and is a real column (not a bug)._
