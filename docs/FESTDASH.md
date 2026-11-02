# FestDash — Festival Delivery Network

FestDash is NorthEDM's in-festival ordering + delivery platform: a festival-goer
orders from a vendor that's set up at their festival, prepays, and a registered
driver delivers it to their campsite, guided by landmark directions and a live
GPS ping.

This document is the source of truth for the FestDash feature. Keep it updated as
the build progresses.

---

## Roles
- **Customer** — festival attendee placing an order.
- **Vendor** — a NorthEDM marketplace vendor enrolled in FestDash; receives,
  accepts/denies, and fulfills orders.
- **Driver** — a person registered & connected to FestDash who physically
  delivers; shares live GPS. (May be the vendor themselves or a separate person.)
- **Admin** — NorthEDM staff; enrolls vendors, oversees orders.

---

## End-to-end flow (target spec)
1. Customer opens the site → **FestDash** → picks their **festival** → sees the
   **vendors available at that festival**.
2. Customer opens a vendor's **marketplace menu** and builds an order.
3. **Checkout — customer provides:**
   - Name
   - **Photo of their car + license plate** (helps the driver find them)
   - **Structured campsite location:** campground name, sub-campground, row, and
     tent — e.g. *"Camp Stegosaurus, row 4, 10 tents down."*
   - **Additional notes / landmark directions** to help find them
   - Phone number (last 4 digits become the delivery confirmation code)
4. Customer **prepays**. Funds are **held in escrow** (a temporary platform
   balance) — *not* released to the vendor yet.
5. Vendor (connected to FestDash) **receives** the order → **accepts or denies**.
   - Deny → escrowed funds refunded to customer.
   - Accept → vendor sees the full order + customer info, prepares it.
6. A registered **driver** is assigned / picks up the order and heads out,
   following the customer's landmark directions **plus a live GPS ping**.
7. **Live tracking:** the driver's phone shares GPS; the customer's track page
   shows the driver's position approaching their campsite. The customer's own
   GPS may also set their campsite ping.
8. On arrival, delivery is **confirmed by a 4-digit code = the last 4 digits of
   the customer's phone number.**
9. On confirmed delivery, escrowed funds **transfer to the vendor's linked
   payout account.**

---

## Current state (skeleton already in repo)
Happy-path ordering is ~60% built:
- Pages: `app/festdash/{page,order,orders,track/[id],vendor-dashboard,driver,vendor-signup}`
- Admin: `app/admin/festdash/{page,client}.tsx`
- API: `app/api/festdash/{orders,orders/[id],vendors,menu/[vendorId],vendor-signup,admin/*}`
- Tables (`supabase/migrations/20260612000000_festdash_schema.sql`):
  `festdash_vendor_applications`, `festdash_vendors`, `festdash_orders`
- Realtime: vendor-dashboard / driver / track pages subscribe to
  `festdash_orders` via `postgres_changes`.

### What's REAL today
Vendor enrollment (apply → admin approve → `festdash_vendors`); customer order
creation; vendor menu from `products`; customer/vendor order views; campsite
photo upload to Supabase Storage; status updates (pending → accepted →
in_transit → delivered/declined); vendor-dashboard audio alert.

### What's MISSING / STUBBED vs. the target spec
| Area | Gap |
|---|---|
| **Payments / escrow / payouts** | Fully stubbed. `stripe_payment_intent`/`paid` unused; checkout says "pay the driver." No hold, no payout. |
| **Live GPS tracking** | Runner's browser shares position every ~12s while en route (`/api/festdash/orders/[id]/location`); the customer's track page updates live over realtime with distance + ETA. The map (`LiveMap`, Mapbox GL) renders once `NEXT_PUBLIC_MAPBOX_TOKEN` is set; text fallback otherwise. Customers can pin their campsite by GPS or by dropping a pin on the map. |
| **Driver registration & assignment** | `festdash_drivers` (self-registration at `/festdash/driver`, **inactive until the owner activates them in /admin/festdash**); claim = conditional update on `festdash_orders.driver_id`. |
| **Confirmation code** | Absent. No phone capture, no last-4 code, no verify-on-delivery. |
| **Car photo + license plate** | Absent (only a campsite photo exists). |
| **Structured campsite fields** | Only one free-text `campground_zone`; need campground + sub-campground + row + tent. |
| **State-machine guards** | PATCH accepts any status; no valid-transition enforcement. |
| **Realtime publication** | `festdash_orders` not confirmed in `supabase_realtime` publication. |
| **Storage policies** | `festdash-campsites` bucket policies are commented out in the migration (apply manually). |
| **Event / delivery-window config** | Hardcoded in the order page. |

---

## External integrations & recommendations

### Payments + escrow + vendor payouts → **Stripe Connect (recommended)**
The flow ("customer prepays → platform holds → release to vendor on delivery")
is a textbook marketplace-escrow problem. **Stripe Connect** does this natively
(authorize/capture or charge-then-transfer to connected vendor accounts), and
the schema already has `stripe_payment_intent`.

> ⚠️ The spec mentions Square/GoDaddy for vendor payout. Reality:
> - **GoDaddy** has no marketplace/third-party-payout product — it can't pay out
>   to independent vendors. Not viable for this.
> - **Square** can process payments but does not offer clean Connect-style
>   marketplace payouts to arbitrary vendor accounts.
> - **Stripe Connect (Express accounts)** is the right tool: each vendor onboards
>   once via Stripe, and the platform holds funds and releases on delivery.
>
> **Decision needed from owner.** Requires a Stripe account + API keys + per-vendor
> Connect onboarding. Until provided, payments run in a clearly-marked **test/stub**
> mode behind a payment-service interface so live Stripe drops in without rework.

### Live map → **Mapbox GL JS (recommended)** or Google Maps
The GPS **data layer** (driver/customer browser geolocation → stored → realtime
to the customer) is buildable now with **no key**. The visual **map** rendering
the ping needs a maps provider API key (Mapbox has a generous free tier).
**Decision needed from owner.** Until then, tracking shows coordinates/distance
text; the map drops in when a key is added.

### Storage → Supabase Storage
Car photo + campsite photo. Bucket + RLS policies must be applied (SQL).

### Realtime → Supabase
Run once: `ALTER PUBLICATION supabase_realtime ADD TABLE festdash_orders;`
(plus any driver-location table) so live tracking/notifications work.

---

## Order state machine (target)
```
draft
  → payment_authorized        (customer prepaid; funds held in escrow)
    → awaiting_vendor
      → accepted              (vendor accepts)
        → preparing
          → out_for_delivery  (driver assigned + en route; GPS live)
            → delivered        (confirmed via last-4 phone code)
              → completed      (escrow released to vendor payout account)
      → declined              (vendor denies → escrow refunded)  [terminal]
  → canceled                  (customer cancels before accept → refund) [terminal]
```
PATCH transitions must be guarded (no skipping/illegal jumps).

---

## Data-model additions (planned)
`festdash_orders` (extend): `customer_phone`, `confirmation_code` (last-4),
`confirmed_at`, structured `campground` / `sub_campground` / `row` / `tent`,
`car_photo_url`, `license_plate`, `driver_id`, `payment_status`,
`stripe_payment_intent` (use existing), `escrow_released_at`.

New: `festdash_drivers` (driver registration), `festdash_order_locations` or
columns for live `driver_lat/lng/updated_at` (+ realtime). Vendor payout linkage
on `festdash_vendors` (e.g. `stripe_account_id`).

---

## Phased build plan
- **Phase 1 — Foundation (no external keys):** schema additions + migration;
  expanded checkout (car photo + plate, structured campsite, phone); confirmation
  code generation + verify-on-delivery; guarded state machine; driver
  registration + order assignment; realtime/storage SQL documented.
- **Phase 2 — Live GPS:** ✅ built (2026-11-01): geolocation capture → realtime
  → track view with distance/ETA, Mapbox GL map behind `NEXT_PUBLIC_MAPBOX_TOKEN`.
  Note: the site's `Permissions-Policy` header must keep `geolocation=(self)`.
- **Phase 3 — Payments:** Stripe Connect — prepay/authorize → escrow hold →
  capture/transfer on confirmed delivery → refund on decline/cancel; vendor
  Connect onboarding replacing the "link Square/GoDaddy" step.

## Open decisions (owner)
1. **Payments processor** — ✅ **DECIDED: Stripe Connect** (Express accounts for vendors; handles escrow hold + payout).
2. **Maps provider** — ✅ **DECIDED: Mapbox** (live ping map; data layer is keyless, map needs a free key).
3. Run the **realtime** + **storage policy** + **schema** SQL when ready (see migrations).


## Gambia / coordinator model

Added 2026-11-01 for Gee (The Gambia), where the rails are mobile-money wallets
(Wave first, then QMoney and Afrimoney), cash on delivery, and ordering over
WhatsApp. Stage one is live; stage two is the only part that needs a third party.

**Roles.** A **coordinator** (purse keeper) is an approved promoter the owner
switches on in `/admin/festdash/coordinators`, with a region and wallet numbers
they maintain themselves in `/festdash/purse`. Shops the coordinator signs up are
assigned to them there too (`vendors.coordinator_user_id`, `currency`,
`whatsapp_number`).

**Money.** Shops pay a flat fee ($30/month by default) to be listed; customers
pay the coordinator's wallet or cash at handover; the coordinator keeps 10% of
each sale and 10% of each fee, pays the shop its 80%, and sends the owner the
rest by Remitly. The site never holds any of it — it books every confirmed sale,
every fee and every remittance in `coordinator_ledger`, and the owner confirms
the dollars that actually land. Percentages and the fee live in
`coordinator_program_settings`.

The same two percentages govern **US card orders** (2026-11-02). Stripe takes
owner % + coordinator % (20% by default) as the platform fee on the destination
charge when the order is delivered, the vendor's Connect account receives the
rest (80%), and the coordinator's part is booked as a held commission at
delivery (`commissions`, source `festdash_order`) and paid through Connect by
the daily release cron once the refund window closes. A vendor with no
coordinator leaves that part with NorthEDM. Which rail an order takes is
`isLocalRail()` in `utils/gambiaPay.ts`: a coordinator **and** a non-USD
currency → wallets / cash and the monthly-fee gate; anything else → card.

**Flow.** Checkout for a coordinator shop offers Wave / QMoney / Afrimoney /
cash (and a prefilled "order on WhatsApp" link). A wallet order waits in
`awaiting_confirmation`: the customer sees the wallet number and a short
reference (`FD-xxxxxx`), pays in their app, enters the transaction ref; the
coordinator matches it in their wallet and taps confirm; the order enters the
shop's queue. Cash orders go to the queue at once and settle when the runner
enters the delivery code. A shop with no current fee period is hidden from the
FestDash list and refused by the order API.

**Shop onboarding.** A shop owner scans the flyer's QR to `/festdash/shop-setup`,
creates their own account (the page passes `?next=` through signup so they come
back), and sends one application: what they sell, area, WhatsApp, the wallet
they want paid to (Wave / QMoney / Afrimoney, or cash), the coordinator's code,
and acceptance of the fee and split. The owner's Approve in /admin/vendors links
the account and enrols the shop on FestDash; the coordinator's first logged fee
makes it visible. The shop owner keeps control of their own account and wallet
and can change the wallet on the same page. Transfer-time notes for each app
are shown at checkout, on the pay screen and in setup (`utils/paymentNotes.ts`).

**Stage two.** Wave publishes a Business/Checkout API (requires a Wave Business
account in The Gambia); Afrimoney follows the GSMA merchant API (onboarding via
Africell); QMoney integrates by partnership. Gambian aggregators (Modem Pay,
Waychit) claim one API for all three. Any of them replaces the manual confirm
with a signed webhook that sets `payment_ref`/`payment_confirmed_*` — the data
model already has the columns.

**Payouts to the coordinator.** Stripe Connect's self-serve cross-border payouts
do not reach The Gambia; Stripe Global Payouts does (GMD by wire) but is a
separate integration. Until then the coordinator keeps his cut from what he
collects, which is why the ledger counts "owed to owner" rather than "owed to
coordinator".
