# Embedded Stores — Frank's General Store as a multi-vendor sub-marketplace

_Scope + architecture for hosting a client's multi-vendor store **inside** the
NorthEDM app (e.g. `northedm.com/franks`) instead of a separate repo/site.
"Marketplace-in-a-box" — a repeatable product. Last updated: 2026-07-20._

---

## The model
Frank's General Store becomes a **store**: a branded sub-marketplace hosted on
NorthEDM. Frank is the **operator** (host-admin of his own store); NorthEDM (CJ) is
the platform host. Frank onboards his own vendors, they sell their products through
his storefront, and money splits vendor → Frank → NorthEDM.

**Why embedded (not a separate site):** one codebase, one deploy, one DB. Frank
inherits the entire NorthEDM stack instantly (FestDash delivery, Stripe payouts,
promoters, traffic). No new git/Supabase/Vercel. Custom domain (e.g.
`franksgeneralstore.com` → the `/franks` route) can be mapped later via Vercel —
not hard, deferred.

> Note: the handoff doc's "isolated Supabase per client" rule was for *independent*
> client sites. An embedded store is a deliberately different product — shared infra,
> part of the NorthEDM ecosystem.

---

## Reuse map — the hard ~70% already exists
| Need | Reuses |
|---|---|
| Vendor accounts + onboarding | `vendors`, application flow, `profiles.vendor_id` |
| Per-vendor products/inventory | `products`, `/vendor/dashboard`, RLS, Square sync |
| Storefront/listing UI | `/marketplace`, `/marketplace/[id]`, vendor cards |
| Delivery | FestDash (orders, escrow, drivers, tracking) |
| Payments + vendor payouts | Stripe Connect onboarding, escrow capture, transfers |
| Cart / checkout / webhooks | shop patterns |
| Auth, roles, admin, storage | `user_profiles` roles, admin panel, buckets |

## New — the ~30% to build
1. **`stores`** — a store record: slug (`franks`), name, tagline, owner (operator),
   branding (accent), `operator_fee_bps` (Frank's cut), active.
2. **`store_vendors`** — which vendors sell under a store (a vendor can be in the
   global marketplace *and* a store). status = approved/pending.
3. **Operator role** — the store's `owner_user_id` (or a NorthEDM admin) can manage
   the store: branding, add/approve/remove member vendors, view store orders. Scoped,
   not full admin.
4. **Storefront route** `/[store]` (top-level, Linktree-style; unknown slug → 404;
   reserved slugs denied) — branded page rendering only that store's vendors/products.
5. **Two-layer payout** — a sale through a store splits **three ways**: selling
   vendor → **operator (Frank)** → **platform (NorthEDM)**. Extends the single-layer
   Connect flow with a second transfer for the operator cut.

---

## Pricing implication (updates PRICING.md §7)
Embedding **removes the one-time site build** — there's no separate site. Frank pays:
- a **monthly operator/host fee** (runs his store on the platform), plus
- **NorthEDM's % of his store's GMV** (platform cut on `/franks` sales), separate from
  what Frank charges his own vendors.

Pure recurring revenue that scales with Frank's success — cleaner than a one-off build.

---

## Phasing
- **Phase 1 (foundation):** `stores` + `store_vendors` tables; host-admin create-store
  + assign operator; operator dashboard (branding + member vendors); public `/[store]`
  storefront reusing marketplace UI. **← building now.**
- **Phase 2 (money):** two-layer payout — add the operator transfer to the FestDash /
  checkout Connect flow. Needs Frank's cut % set + live-key testing (money-critical).
- **Phase 3 (polish):** custom domain mapping, operator order dashboard, store-scoped
  promoters/deals.

---

## Pay-before-handover (the launch gate)

CJ's sequence: **build it privately → publish → Frank pays → he gets control and can
take orders.** Note this supersedes the "embedding removes the one-time build" line
above: CJ is charging a **setup fee** as well, because the setup work is real even
though the store is embedded rather than a separate site.

A store therefore has two independent switches:

| Switch | Controls | Who flips it |
| :-- | :-- | :-- |
| `active` (draft/live) | whether the **public** can see the storefront | CJ, from `/admin/stores` |
| `billing_status` | whether **Frank** can manage it and whether it can **take orders** | payment (Stripe), not a person |

Keeping them separate is deliberate: CJ can publish a store for people to browse
before Frank has paid, or keep a paid store private while it's being reworked.

**`billing_status`:** `unpaid → active → past_due → canceled`

- **unpaid** — CJ can build it; Frank can look but not edit; checkout is closed.
- **active** — Frank manages it and the store takes orders.
- **past_due / canceled** — orders close, storefront can stay up (read-only) so the
  store doesn't vanish over a failed card. Frank keeps read access to his data.

**What Frank pays** (numbers live in PRICING.md):
1. **One-time setup fee** — invoice via the existing `service_quotes` flow (already
   supports deposit-or-full and a promoter code).
2. **Monthly operator fee** — a Stripe **subscription**; its webhook drives
   `billing_status`, so nobody has to remember to switch anything off.
3. **Platform % of store GMV** — taken per order at checkout, not billed separately.

**Order of build:** the ordering rail (below) must exist before the gate is worth
anything — there's nothing to gate until the store can take money.

## Ordering — store cart + Stripe checkout

Decided: a real storefront cart, not FestDash's delivery flow and not
catalog-plus-contact. `/marketplace/[id]` is a **catalog** (it renders prices but has
no cart or checkout), so this is genuinely new.

- Cart lives client-side on `/[store]`; **prices and stock are re-read server-side at
  checkout** from `products` — the client cart is never trusted (same rule as
  `/api/shop/checkout`).
- One Stripe Checkout session per order; a pending `store_orders` row carries the id
  so the webhook can mark it paid and decrement stock.
- **Fee accounting at order time:** platform cut and the operator's cut
  (`stores.operator_fee_bps`) are computed and stored on the order, so what's owed is
  never re-derived later from a changed setting.
- **Payouts to vendors and the operator reuse the promoter-commission machinery**
  (`commissions`-style hold → release, see docs/WALLET.md): recorded as obligations at
  order time, paid after the refund-protection window. Same reasoning — NorthEDM never
  holds anyone's money, and a refund voids rather than claws back.

**Phasing:** collect money + record what's owed first (a store that takes orders and
tracks obligations is useful immediately); automatic vendor/operator transfers follow,
since they need connected accounts and live-key testing.
