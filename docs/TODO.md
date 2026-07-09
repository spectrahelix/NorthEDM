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

## ⚙️ Known incomplete / needs your input
- **Shop payments:** `STRIPE_WEBHOOK_SECRET` still needs to be set so store checkout auto-confirms orders + decrements stock via webhook.
- **FestDash:** see status section below (Stripe keys + Mapbox token + end-to-end test).

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
- Promoter program, referral codes, commission codes, store credit, promo codes.

**Remaining to be festival-ready:**
1. **Payments / escrow finish** — Connect onboarding exists, but the money movement still needs completing + **live Stripe keys**: authorize on prepay → hold in escrow → **capture/transfer to vendor on confirmed delivery** → refund on decline/cancel.
2. **Mapbox token** — the GPS data layer works keyless; the live **map render** on the track page needs a Mapbox API key (free tier).
3. **End-to-end test** at a real/staged event; review order **state-machine guards** (no illegal status jumps).
4. Confirm **realtime publication** + **storage bucket policies** SQL are applied.

_Note: this is a read from route structure; a file-by-file audit can confirm exact completion if you want one._
