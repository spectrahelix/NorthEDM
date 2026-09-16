# NorthEDM code audit — 2026-09-14

A full pass over the application code looking for stale, unused and abandoned
code, and checking that what's there does what it claims. Scope: 31,305 lines
across `app/` and `utils/` — 78 pages, 81 API routes, 53 tables, 42 migrations.

Method: `knip` for unused files/exports, plus hand-written cross-references of
API routes → callers and database tables → code, plus live queries against
production Supabase and live HTTP probes against northedm.com. Findings that
sounded plausible but turned out to be wrong are recorded in
[Checked and cleared](#checked-and-cleared) rather than dropped.

Anything scaffolded for a planned feature is listed under
[Not dead — leave alone](#not-dead--leave-alone) and was deliberately not
touched.

---

## 1. Critical — the promoter funnel was dead

**Nobody could become a promoter.** `/promote` is the only application form on
the site, and it POSTs to `/api/promote`, which did not exist.

The promoter program moved from `/festdash/promoter-signup` to `/promote`
site-wide. The page moved; the API route didn't. What made this invisible:

- `POST /api/promote` returned **200 with `content-type: text/html`** — the app
  shell, not a 404. Nothing looked broken from the outside.
- `const json = await res.json()` then threw a `SyntaxError` on the HTML body.
- That rejection is unhandled inside `handleSubmit`, so `setLoading(false)`
  never ran. The button stuck on "Submitting…" forever, no error was shown,
  nothing was written, nothing was logged.

Every promoter application since the move was silently discarded — and that
funnel is the single entry point to the whole commission and payout pipeline.
`festdash_promoter_applications` holds 1 row, from before the move.

**Fixed.** The original handler was still sitting orphaned at
`/api/festdash/promoter-signup` with **field names matching the form exactly**
(`displayName, email, phone, audience, promoteVendor, why`), so it was moved to
`app/api/promote/route.ts` rather than rewritten.

> Worth internalising: the page and its route were separated by a refactor, and
> nothing — not the build, not types, not tests — could catch it, because a
> missing App Router API route degrades into an HTML page response rather than
> an error. Any `fetch` to a route that moves is exposed to this.

---

## 2. Critical — two contradictory identity systems

`profiles` and `user_profiles` both exist and are both live: `profiles` in ~20
files, `user_profiles` in 81.

```
auth.users                  14
user_profiles               14   ← trigger-populated, healthy
profiles                     3   ← 11 of 14 users have NO row
```

`handle_new_user` (trigger on `auth.users`) writes **only** `user_profiles`.
`profiles` is written in a few code paths but nothing guarantees a row exists.
The newest `profiles` row dates to 2026-06-12.

Consequences, for **79% of users**:

| Feature | Reads | Result without a `profiles` row |
|---|---|---|
| Vendor product management | `profiles.vendor_id` | 403 "No vendor linked to this account" |
| Square connect / sync / status / disconnect | `profiles.vendor_id` | 403 |
| FestDash vendor dashboard | `profiles.vendor_id` | no vendor |
| FestDash promo codes, Stripe connect/status | `profiles.vendor_id` | 403 |
| Referral code generation | `profiles.vendor_id` | "Only vendors and approved promoters…" |
| Forum username claim | `profiles.username` | writes into the sparse table |

The role vocabularies are **completely disjoint** — there is no overlap at all,
so a check against the wrong table always fails closed:

```
profiles.role       admin (1), vendor (1), user (1)
user_profiles.role  archon (1), drifter (11), merchant (2)
```

### 2b. Vendor ownership is recorded in two places that disagree

- `vendors.user_id` — what **RLS** uses (`"vendor update own"`)
- `profiles.vendor_id` — what the **API routes** use

They do not agree. Vendor 5 (Frank's) has `profiles.vendor_id = 5` for its
operator but `vendors.user_id IS NULL`. Live counts: 1 vendor has `user_id`, 2
profiles have `vendor_id`.

This is the *same root cause* as the already-fixed bug where marketplace listing
edits were silently discarded for 6 of 7 listings. That fix addressed the
symptom; the split ownership model is still there and will keep producing
variants of it.

**Not fixed here** — consolidating identity is an architectural decision, not a
cleanup. Options in [Recommendations](#recommendations).

---

## 3. Removed

| Path | Lines | Why |
|---|---|---|
| `app/api/products/route.ts` | 59 | Superseded by `/api/vendor/products`, **and a permission bypass** — see below |
| `app/components/DeleteButton.tsx` | 65 | Zero references |
| `app/components/SignOutButton.tsx` | 23 | Zero references |
| `app/components/VendorActionButtons.tsx` | 96 | Zero references |

**`/api/products` was not merely dead.** It had no callers, but it accepted
`vendorId` from the request body and gated only on `vendors.user_id === user.id`
— it did **not** call `canManageInventory()`, which is what `/api/vendor/products`
uses to enforce Marketplace approval (`user_profiles.is_marketplace`).

Verified against production, not assumed:

```
vendor 6  Homestead Life  role=merchant  is_marketplace=false
          → BLOCKED by /api/vendor/products, ALLOWED by /api/products
```

A vendor who had not been approved for the Marketplace could publish inventory
by posting to the orphaned endpoint.

---

## 4. Unused exports and types

Dead weight, no behavioural risk. Worth deleting when touching these files.

**Unused exports (15):** `composeAvatarSvg` (`app/avatar/catalog.ts`),
`DEFAULT_HOLD_DAYS`, `REGION_CENTER`, `REGION_RADIUS_MILES`, `payPalConfigured`,
`COMMISSION_BPS`, `commissionCents`, `isGarbageText`, `squareBase`,
`PLATFORM_FEE_BPS`, `getUsernames`, `displayName`, `initials`, `decodeEntities`,
`localDate`.

**Unused exported types (13):** `Vendor`, `AvatarItem`, `AvatarConfig`,
`EmbedInfo`, `CommissionSource`, `IngestResult`, `ResolvedPromoter`,
`ConnectorResult`, `ConnectorInfo`, `SquareSyncResult`, `UserRole`, `Profile`,
`VenueFeed`.

Some are deliberate (`REGION_CENTER`, `localDate`, `isGarbageText` are exported
for testability and documentation value). Judgement needed per item — this is a
list, not a mandate.

**Dependencies:** `playwright` is declared but unused. `postcss` is used by
`postcss.config.mjs` but not declared — it currently resolves transitively,
which is fragile; it should be an explicit devDependency.

---

## 5. Orphaned routes still present

| Route | Status |
|---|---|
| `/api/festdash/promoter/referral-code` | **Stale.** No callers. A backfill for "promoters approved before codes existed"; admin approval now mints the code, and the only promoter already has one. Safe to delete. |
| `/api/festdash/stripe/webhook` | **Keep.** No source callers by design — Stripe calls it. |
| `/api/shop/webhook` | **Keep.** Same. |

---

## 6. Unreferenced tables

Only 2 of 53 tables have no code reference at all — the schema is tighter than
expected:

- `invoices` (0 rows) — promoter invoice pipeline, planned
- `festdash_promoter_vendors` (0 rows) — FestDash promoter↔vendor mapping, planned

Both are future scaffolding. Left alone.

---

## Checked and cleared

Things that looked like abandoned duplicates and are not. Recorded so the same
ground isn't re-covered.

**Four "competing" referral mechanisms are actually two intentional systems.**

| Store | Purpose | Verdict |
|---|---|---|
| `festdash_promoters.referral_code` | Promoter's **permanent** code → 10% discount + commission at checkout | Live, canonical for money |
| `referral_codes` + `referrals` | **Single-use signup** referral → $1 store credit each side | Live — redeemed via the `claim_referral_code()` RPC from `awardReferralReward()` on auth confirm |
| `referral_attributions` | Promoter attribution on signup | Live, via `recordPromoterAttribution()` |

Initial read was that `/promote/codes` mints codes the checkout can never
resolve. It doesn't — the two systems redeem through different, working paths.

**Square is complete, not abandoned.** It authenticates with a vendor-supplied
personal access token, so the absence of `SQUARE_APP_ID`/OAuth env vars is by
design, not a half-finished integration. 4 routes, a 257-line util, and
dashboard UI, all wired. `vendor_square_connections` is empty only because
`profiles.vendor_id` blocks 79% of users from reaching it (finding 2).

> One inaccurate comment: `app/api/vendor/square/connect/route.ts` says "the
> token never touches the browser". The vendor types it into a browser form and
> POSTs it. What's true is that it's stored server-side under the service role
> and never sent *back* to a client. Worth rewording so nobody relies on the
> stronger claim.

**`festival_events` / `festival_vendors` are not duplicates of `local_events`.**
They back CrowdWave and the feed; `local_events` backs `/events`. Different
features.

**Code hygiene is good.** 2 `console.log`/`console.debug` calls in 31k lines,
0 TODO/FIXME/HACK markers, 0 unreferenced API routes beyond those above.

---

## Not dead — leave alone

Scaffolding for features in flight. Explicitly excluded from cleanup.

- **`/shop` + `shop_products` + `/admin/shop` + `/api/shop/*`** — the merch/hoodie
  line. `shop_products` is empty, so `/shop` is currently an empty page reachable
  from the main nav, but the admin UI, checkout and webhook are all built and
  waiting on product data. See [Recommendations](#recommendations).
- **FestDash** — `festdash_drivers`, `festdash_orders`, `festdash_promo_codes`,
  `festdash_promo_redemptions` (all 0 rows), per the phased plan in
  `docs/FESTDASH.md`.
- **Commission/payout pipeline** — `commissions`, `store_credit_ledger`,
  `store_credit_balances`, `invoices` (all 0 rows).
- **`store_orders`** — store checkout exists, no orders placed yet.

---

## Recommendations

Ranked by value, not effort.

1. **Consolidate identity onto `user_profiles`.** Add `username` and `vendor_id`
   to `user_profiles`, backfill from `profiles`, repoint the ~20 call sites, then
   drop `profiles`. This retires the largest source of silent failure in the
   codebase. Do it in one pass — a half-migration is worse than either end state.
2. **Pick one vendor-ownership model.** `vendors.user_id` is the better choice:
   RLS already depends on it, so the database enforces it rather than trusting
   each route to look it up. Backfill it from `profiles.vendor_id` and reconcile
   the disagreement on vendor 5.
3. **Either seed `shop_products` or hide `/shop` from the nav.** A main-nav link
   to an empty page reads as broken to a visitor. A single "coming soon" state
   would do.
4. **Add a smoke test for form→route wiring.** Finding 1 was undetectable by
   the compiler. A test that POSTs to each API path a client `fetch`es and
   asserts a JSON content-type would have caught it, and would catch the next one.
5. Delete `/api/festdash/promoter/referral-code`; declare `postcss`; drop
   `playwright` or start using it.
