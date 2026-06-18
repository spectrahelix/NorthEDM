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
| **Live GPS tracking** | None. No geolocation capture, no map, no driver position. Track page is text-only. |
| **Driver registration & assignment** | No driver role/table; no order→driver mapping. |
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
- **Phase 2 — Live GPS:** driver/customer geolocation capture → realtime
  broadcast → customer track view (coords/distance first; Mapbox map once keyed).
- **Phase 3 — Payments:** Stripe Connect — prepay/authorize → escrow hold →
  capture/transfer on confirmed delivery → refund on decline/cancel; vendor
  Connect onboarding replacing the "link Square/GoDaddy" step.

## Open decisions (owner)
1. **Payments processor** — Stripe Connect recommended (Square/GoDaddy don't fit escrow+payouts).
2. **Maps provider** — Mapbox vs Google Maps (for the live ping map).
3. Run the **realtime** + **storage policy** SQL when ready.
