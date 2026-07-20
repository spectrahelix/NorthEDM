# NorthEDM — Pricing & Business Model

_Working reference for how everything is priced and who pays for what. Numbers are
recommended defaults CJ can flex per relationship (esp. founders/early birds).
Last updated: 2026-07-19._

---

## 0. The revenue streams at a glance

NorthEDM makes money from a few distinct products. Keep them mentally separate —
they can be **bundled** for a client, but each has its own value.

| Stream | Who pays | Shape |
|---|---|---|
| **FestDash — vendor** | vendors (e.g. Frank) | monthly subscription **+** 5% per order |
| **FestDash — customer** | shoppers | per-order fees, or a monthly **FestDash Pass** |
| **Web dev** | client | one-time build **+** monthly maintenance |
| **NorthEDM listing / ad** | vendor | monthly (audience reach on NorthEDM) |
| **Promoter commissions** | funded by the sale | cash to promoters (already built) |

---

## 1. FestDash — vendor side (what Frank pays)

**Two-part pricing: a monthly subscription (access) + 5% per order (usage).** This
is the standard marketplace shape — the sub covers "being on the network," the %
scales with the vendor's own success.

**Vendor tiers (recommended):**
- **Starter — $25/mo** — one vendor, delivery access, dashboard, unlimited orders.
- **Pro — $50/mo** — priority runner assignment, featured placement in FestDash,
  multi-event support.
- **Founder rate** — comp or ~$15/mo for the first vendors (Frank qualifies).
  Lock it; grandfather them like the web-dev early birds.

**Plus the 5% platform fee per order** — see §3 for how that's charged.

> Small-vendor sanity check: $25/mo + 5% is a no-brainer for a shop that gets even
> a handful of delivery orders a week. If a vendor balks at both, offer
> subscription **or** a higher commission — not both — but default to this.

---

## 2. FestDash — customer side

- **Free to order.** Per order the customer pays: item price + **5% service fee** +
  delivery charge.
- **FestDash Pass (monthly, ~$7.99/mo)** — waives the service fee + delivery on all
  orders and unlocks **member-only FestDash deals**. (DashPass-style.)
  - Alternative: an **event/weekend pass** (flat $X for a festival) for people who
    only need it for one event.
  - The Pass is the recurring consumer revenue and the reason the 5% is
    customer-facing (§3).

---

## 3. The 5% cut — OVER list price (customer-paid service fee) ✅

**Decision: the 5% is added on top as a customer "FestDash service fee." The vendor
keeps 100% of their list price.**

- Frank lists water at **$1.00** → customer pays **$1.05** ($1.00 + $0.05 fee) →
  Frank nets **$1.00**, NorthEDM keeps **$0.05**.
- **Why over, not under:**
  1. Easy vendor recruiting — "you keep your full price."
  2. Standard + expected — every delivery app charges the customer a service fee.
  3. It makes the **FestDash Pass valuable** — the Pass "waives the service fee,"
     which only works if there *is* one.
- So **Frank prices inventory at his normal retail price** — he does **not** need to
  mark it up to cover the 5%. The 5% never touches his margin.

> ⚠️ **Code note (for when we build it):** the current FestDash order flow takes the
> 5% *out of the vendor's payout* (Stripe `application_fee` on a destination
> charge = "absorbed / under list"). To match this decision we must move the 5% to a
> **customer-facing service-fee line** (add it to the order total; vendor gets full
> price) and let the **Pass** zero out the fee + delivery. See §6.

---

## 4. Web dev — Frank's independent site

- **Build: $500** (early-bird/founder rate — first ~5 clients at $500, then raise to
  $750–$1,000). This is a catalog/store site for a general store. Custom
  features/e-commerce checkout are scoped + quoted separately (never flat-rate an
  undefined feature).
- **Payment: 50% deposit to start, 50% before launch/handoff** (don't deploy to his
  domain or hand over admin until the balance clears).
- **Monthly maintenance: $40/mo** (recurring — hosting oversight, edits, uptime,
  small updates). This is the real long-term asset; keep it recurring, not one-time.

---

## 5. NorthEDM listing / advertisement package

**Separate product from the site.** This is Frank's presence **on NorthEDM** —
marketplace listing, featured placement, and promotion to NorthEDM's audience
(community + socials). Value = *your* audience, independent of whether Frank has his
own site.

- **~$25–30/mo** for a featured NorthEDM listing + promo.
- **Does the independent site change this price? No.** They're different value (his
  site = his web presence; the NorthEDM listing = your audience reach). If anything
  they reinforce each other — the NorthEDM listing + "Order on FestDash" drive
  traffic *to* Frank; his site is where it lands. Keep the ad/listing priced on its
  own merit.

---

## The recommended "all-in" bundle for Frank

Rather than three separate monthly bills, sell **one** partner subscription:

| Component | Standalone | 
|---|---|
| Site maintenance | $40/mo |
| FestDash vendor (Starter) | $25/mo |
| NorthEDM featured listing/ad | $25/mo |
| **Separately** | **~$90/mo** |
| **Bundled "NorthEDM Partner" price** | **$75/mo** |

Plus: **one-time $500 site build**, and **5% per FestDash order (customer-paid)**.
Founder move: lock Frank at a discounted bundle (e.g. **$50/mo**) as an early bird,
same policy as the web-dev grandfathering.

---

## 6. To build later (code) — keep in memory

These are decided in principle; not yet coded:

1. **FestDash vendor subscriptions** — recurring monthly billing (Stripe
   subscription) per vendor tier; gate active-vendor status on an active sub.
2. **Move the 5% to a customer-facing service fee** (§3) — vendor keeps full list
   price; add service-fee + delivery lines to the order total.
3. **FestDash Pass** — monthly consumer subscription that zeroes the service fee +
   delivery and unlocks member deals; check pass status at checkout.
4. **Bundled partner billing** — one monthly charge combining site maintenance +
   FestDash + listing.
5. Recurring monthly **web-dev maintenance** billing (also flagged in the quotes
   feature as "Phase 2").

---

## 7. ⭐ LIKELY DIRECTION — Frank's General Store as a multi-vendor marketplace

**This is now the probable path** (as of 2026-07-20): Frank's store won't be a single
vendor — it becomes a **marketplace that hosts other vendors and sells their
products.** That reframes a lot above, so revisit §1/§3/§4/§5/the bundle once it's
confirmed.

**What changes:**
- **Frank = marketplace host/operator, not a single vendor.** His pricing tier is an
  "operator" relationship, not the $25/mo vendor sub.
- **The site is a real multi-vendor storefront** — vendor accounts, per-vendor product
  management, split payouts to each vendor. That's well beyond the $500 catalog tier;
  price it as a platform build.
- **Commission gains a layer:** NorthEDM → Frank's store → Frank's vendors. Decide how
  NorthEDM earns from *his* vendors' sales (a cut of his GMV, or a flat operator fee),
  separate from what Frank charges his own vendors.

**The big opportunity — reuse, don't rebuild:** a multi-vendor marketplace with vendor
onboarding + FestDash delivery + Stripe Connect payouts is *exactly* what NorthEDM
already is. Frank's store can likely **reuse the existing NorthEDM infrastructure**
(marketplace, vendor accounts, FestDash, escrow/Connect payouts) rather than being
built from scratch → a repeatable **"marketplace-in-a-box"** product to sell to future
clients, not a one-off site.
