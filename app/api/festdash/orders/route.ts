import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe, platformFeeCents } from "@/utils/stripe";

import { isLocalMethod, isLocalRail, isWalletMethod, minRunnerFeeCents, platformShareBps, walletNumberFor } from "@/utils/gambiaPay";
import { activeSubscription, coordinatorFor, loadSplitSettings } from "@/utils/coordinator";
import { festdashListingActive } from "@/utils/billing";
// Stripe's minimum chargeable amount (USD). Below this we can't run a card.
const STRIPE_MIN_CENTS = 50;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    vendorId, eventName, campgroundZone, campsiteNotes,
    campsitePhotoUrl, deliveryWindow, items, customerName,
    customerPhone, campground, subCampground, campsiteRow, tent,
    licensePlate, carPhotoUrl, customerLat, customerLng,
    promoCode, paymentMethod, runnerFeeCents,
  } = body;

  if (!vendorId || !eventName || !campgroundZone || !deliveryWindow || !items?.length) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // The vendor must be live on FestDash and visible to the public. The order
  // page only lists such vendors, but a crafted request could name a hidden
  // ("lights out") one — this is the check that actually enforces it.
  const vid = Number(vendorId);
  const [{ data: vendorRow }, { data: fdRow }] = await Promise.all([
    admin.from("vendors").select("id, status, is_public, suspended_at, coordinator_user_id, currency").eq("id", vid).maybeSingle(),
    admin.from("festdash_vendors").select("vendor_id").eq("vendor_id", vid).eq("is_active", true).maybeSingle(),
  ]);
  if (!vendorRow || vendorRow.status !== "approved" || !vendorRow.is_public || vendorRow.suspended_at || !fdRow) {
    return NextResponse.json({ error: "This vendor isn't taking FestDash orders right now." }, { status: 403 });
  }

  // A shop on the local rail (a coordinator AND a non-USD currency — see
  // isLocalRail) is paid through its purse keeper's mobile wallet or in cash on
  // delivery — never a card — and is open only while its monthly fee is
  // current. A USD vendor with a coordinator stays on card checkout. The wallet
  // number is snapshotted onto the order so the customer always sees the number
  // that was current when they ordered.
  const local = isLocalRail(vendorRow);
  const currency = String(vendorRow.currency || "USD");
  // A card on a local-rail shop (2026-11-03): charged in the shop's currency
  // to NorthEDM's Stripe, held until delivery like any card order. Stripe can't
  // pay a Gambian shop or runner, so at delivery the shop's share, the
  // coordinator's share and the runner fee are booked as owed BY the owner and
  // sent to the coordinator to disburse (collected_by = 'owner').
  const localCard = local && paymentMethod === "card";
  let payTo: string | null = null;
  if (local) {
    // Cash on delivery was removed on 2026-11-02 (owner's decision): an order
    // reaches the shop only after its payment is confirmed, and cash skipped
    // that gate. Old cash orders keep their status values for history.
    if (!isWalletMethod(paymentMethod) && !localCard) {
      return NextResponse.json({ error: "Choose how you'll pay: Wave, QMoney, Afrimoney or card." }, { status: 400 });
    }
    const sub = await activeSubscription(admin, vid);
    if (!sub) return NextResponse.json({ error: "This shop's FestDash listing isn't active right now." }, { status: 403 });
    if (isWalletMethod(paymentMethod)) {
      const purse = await coordinatorFor(admin, vendorRow.coordinator_user_id as string);
      payTo = walletNumberFor(purse, paymentMethod);
      if (!payTo) {
        return NextResponse.json({ error: `${paymentMethod} isn't set up for this shop yet — pick another way to pay.` }, { status: 400 });
      }
    }
  } else {
    if (paymentMethod && paymentMethod !== "card") {
      return NextResponse.json({ error: "This vendor takes card payments only." }, { status: 400 });
    }
    // Card-rail vendors must hold an active monthly FestDash listing.
    const listed = await festdashListingActive(admin, [vid]);
    if (!listed.has(vid)) return NextResponse.json({ error: "This vendor's FestDash listing isn't active right now." }, { status: 403 });
  }

  // Re-price every line from the database. The browser's prices and total are
  // ignored — they used to be trusted, so an edited request could have bought
  // an $85 item for a cent. Lines are matched by product_id (what the order
  // page sends now) or, for a page loaded before that change, by name within
  // this vendor's menu. The stored line carries product_id so the payment
  // webhook can take the stock down, which it was silently failing to do.
  const { data: menu } = await admin
    .from("products")
    .select("id, name, price, inventory_count")
    .eq("vendor_id", vid)
    .eq("is_public", true)
    .eq("status", "published");
  const byId = new Map((menu ?? []).map((m) => [Number(m.id), m]));
  const byName = new Map((menu ?? []).map((m) => [String(m.name ?? "").trim().toLowerCase(), m]));
  const lines: { product_id: number; name: string; qty: number; price: number }[] = [];
  for (const raw of items as { product_id?: unknown; id?: unknown; name?: unknown; qty?: unknown }[]) {
    const qty = Math.floor(Number(raw?.qty) || 0);
    if (qty < 1) return NextResponse.json({ error: "Each item needs a quantity of at least 1." }, { status: 400 });
    const m = byId.get(Number(raw.product_id ?? raw.id)) ?? byName.get(String(raw.name ?? "").trim().toLowerCase());
    if (!m) {
      return NextResponse.json(
        { error: `“${String(raw.name ?? "An item")}” isn't on this vendor's menu any more — please refresh and try again.` },
        { status: 400 }
      );
    }
    if ((m.inventory_count ?? 0) < qty) {
      return NextResponse.json({ error: `Only ${m.inventory_count ?? 0} of “${m.name}” left.` }, { status: 400 });
    }
    lines.push({ product_id: Number(m.id), name: String(m.name), qty, price: Math.round(Number(m.price) * 100) });
  }
  const grossCents = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  if (grossCents <= 0) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });

  // Apply a commission code if supplied. The customer gets percent_off the
  // vendor's items; the same amount is booked as commission to NorthEDM (the
  // vendor absorbs both). Re-validated here server-side — the client preview
  // is not trusted. The code's redemption count is claimed with an optimistic
  // update so it can't exceed max_redemptions under concurrency.
  let discountCents = 0;
  let commissionCents = 0;
  let promoCodeId: string | null = null;
  let claimedTimes = 0;
  const promo = typeof promoCode === "string" ? promoCode.trim() : "";
  if (promo) {
    const { data: pc } = await admin
      .from("festdash_promo_codes")
      .select("id, percent_off, vendor_id, active, expires_at, max_redemptions, times_redeemed")
      .ilike("code", promo)
      .maybeSingle();

    const invalid =
      !pc || !pc.active || pc.vendor_id !== Number(vendorId) ||
      (pc.expires_at && new Date(pc.expires_at) < new Date()) ||
      (pc.max_redemptions != null && pc.times_redeemed >= pc.max_redemptions);
    if (invalid) {
      return NextResponse.json({ error: "Promo code is not valid." }, { status: 400 });
    }

    const { data: claimed } = await admin
      .from("festdash_promo_codes")
      .update({ times_redeemed: pc!.times_redeemed + 1 })
      .eq("id", pc!.id)
      .eq("times_redeemed", pc!.times_redeemed) // optimistic lock
      .select("id, times_redeemed")
      .maybeSingle();
    if (!claimed) {
      return NextResponse.json({ error: "Promo code just became unavailable — try again." }, { status: 409 });
    }

    discountCents = Math.floor((grossCents * pc!.percent_off) / 100);
    commissionCents = discountCents;
    promoCodeId = pc!.id;
    claimedTimes = claimed.times_redeemed;
  }

  // Store credit is NOT accepted on FestDash orders (owner's decision,
  // 2026-11-02). Credit is NorthEDM's own liability; on an independent vendor's
  // order the credit-covered part never reached the vendor through Stripe, so a
  // credit-paid order was delivered and never paid for, with nothing recording
  // the debt. Credit stays spendable on NorthEDM's own shop and avatar items.
  // A `useCredit` flag from an older client is ignored; the columns stay so old
  // orders still read correctly.
  const discountedCents = grossCents - discountCents;
  const creditCents = 0;
  // Runner fee: the customer's pick, never below 10% of the items. It rides on
  // top of the items and goes to the runner in full (utils/runnerPay.ts).
  const runnerFee = Math.max(minRunnerFeeCents(discountedCents), Math.floor(Number(runnerFeeCents) || 0));
  const netCents = discountedCents + runnerFee;

  // Delivery confirmation code = last 4 digits of the customer's phone
  const phoneDigits = String(customerPhone ?? "").replace(/\D/g, "");
  const confirmationCode = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : null;

  // Service role: ordinary sessions can't insert order rows (closed in the
  // 2026-11-01 hardening); every check above is what stands in for that.
  const { data, error } = await admin
    .from("festdash_orders")
    .insert([{
      vendor_id: Number(vendorId),
      customer_id: user.id,
      customer_name: customerName || user.email?.split("@")[0] || "Guest",
      customer_email: user.email,
      event_name: eventName,
      campground_zone: campgroundZone,
      campsite_notes: campsiteNotes || null,
      campsite_photo_url: campsitePhotoUrl || null,
      campground: campground || null,
      sub_campground: subCampground || null,
      campsite_row: campsiteRow || null,
      tent: tent || null,
      car_photo_url: carPhotoUrl || null,
      license_plate: licensePlate || null,
      customer_phone: customerPhone || null,
      confirmation_code: confirmationCode,
      customer_lat: typeof customerLat === "number" ? customerLat : null,
      customer_lng: typeof customerLng === "number" ? customerLng : null,
      delivery_window: deliveryWindow,
      items: lines,
      total_cents: netCents,
      runner_fee_cents: runnerFee,
      store_credit_cents: creditCents,
      discount_cents: discountCents,
      commission_cents: commissionCents,
      promo_code: promo || null,
      promo_code_id: promoCodeId,
      // Hold new orders out of the vendor queue until the card is authorized.
      // The webhook / confirm step promotes them to "pending" once escrowed.
      status: local && !localCard ? (paymentMethod === "cash" ? "pending" : "awaiting_confirmation") : "awaiting_payment",
      payment_status: local && !localCard ? (paymentMethod === "cash" ? "cod" : "awaiting_confirmation") : "unpaid",
      paid: false,
      payment_method: local && !localCard ? paymentMethod : "card",
      payment_to: payTo,
      currency,
    }])
    .select()
    .single();

  if (error) {
    // Release the promo redemption we optimistically claimed.
    if (promoCodeId) {
      await admin.from("festdash_promo_codes")
        .update({ times_redeemed: claimedTimes - 1 })
        .eq("id", promoCodeId);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Record the commission redemption.
  if (promoCodeId) {
    await admin.from("festdash_promo_redemptions").insert({
      code_id: promoCodeId,
      order_id: data.id,
      customer_id: user.id,
      discount_cents: discountCents,
      commission_cents: commissionCents,
    });
  }

  // Local-rail orders stop here: no card, no escrow. A wallet order waits for
  // the purse keeper's confirmation (/festdash/purse); a cash order goes
  // straight into the shop's queue and settles at handover.
  if (local && !localCard) {
    return NextResponse.json({ order: data });
  }

  // The amount owed on the card after any code discount.
  const dueCents = data.total_cents as number;

  // Nothing to charge (a 100% code) → straight into the queue, no escrow. The
  // status value predates the no-credit rule and is kept for old rows.
  if (dueCents <= 0) {
    await admin
      .from("festdash_orders")
      .update({ paid: true, payment_status: "paid_credit", status: "pending" })
      .eq("id", data.id);
    data.paid = true;
    data.payment_status = "paid_credit";
    data.status = "pending";
    return NextResponse.json({ order: data });
  }

  // Stripe's floor is about US$0.50 in any currency; non-USD uses a generous
  // 50.00 in the shop's currency so a tiny GMD order can't fail at Stripe.
  const minCents = currency === "USD" ? STRIPE_MIN_CENTS : 5000;
  if (dueCents < minCents) {
    // Can't run a sub-$0.50 card. Roll back the order so it isn't orphaned.
    await admin.from("festdash_orders").delete().eq("id", data.id);
    return NextResponse.json(
      { error: `Card orders must be at least ${currency === "USD" ? "$" : currency + " "}${(minCents / 100).toFixed(2)}.` },
      { status: 400 }
    );
  }

  // Escrow via Stripe Checkout with MANUAL CAPTURE: the customer's card is
  // authorized (held) now, and only captured when the driver confirms delivery.
  // If the vendor has an onboarded Connect account, the charge is a destination
  // transfer minus FestDash's share — owner % + coordinator % from
  // coordinator_program_settings, 20% by default, so the vendor keeps 80% — and
  // capture pays the vendor directly. The coordinator's part of that share is
  // booked to them at delivery (orders/[id]) and paid out by the commissions
  // cron after the hold window. If the vendor has no Connect account, funds are
  // held on the platform and settled to the vendor manually.
  const { data: fv } = await admin
    .from("festdash_vendors")
    .select("stripe_account_id")
    .eq("vendor_id", Number(vendorId))
    .maybeSingle();
  // Never a destination transfer on the local rail: the funds stay with
  // NorthEDM and are disbursed through the coordinator (see localCard above).
  const vendorAccount = localCard ? null : (fv?.stripe_account_id as string | null) || null;

  const itemSummary = lines
    .map((i) => `${i.qty}× ${i.name}`)
    .join(", ")
    .slice(0, 250);

  const paymentIntentData: Record<string, unknown> = {
    capture_method: "manual",
    metadata: { festdash_order_id: data.id, vendor_id: String(vendorId), customer_id: user.id, rail: localCard ? "local_card" : "card" },
  };
  if (vendorAccount) {
    // Platform share of the ITEMS, plus the whole runner fee: the fee is
    // collected here and transferred to the runner at the delivery code.
    const splits = await loadSplitSettings(admin);
    paymentIntentData.application_fee_amount = platformFeeCents(dueCents - runnerFee, platformShareBps(splits)) + runnerFee;
    paymentIntentData.transfer_data = { destination: vendorAccount };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: dueCents,
            product_data: {
              name: `FestDash order — ${eventName}`,
              description: itemSummary || undefined,
            },
          },
        },
      ],
      payment_intent_data: paymentIntentData,
      customer_email: user.email ?? undefined,
      success_url: `${origin}/festdash/track/${data.id}?paid=1`,
      cancel_url: `${origin}/festdash/order?canceled=${data.id}`,
      metadata: { festdash_order_id: data.id },
      client_reference_id: data.id,
    });

    await admin
      .from("festdash_orders")
      .update({ payment_status: "awaiting_payment", stripe_checkout_session: session.id })
      .eq("id", data.id);

    return NextResponse.json({ order: data, checkoutUrl: session.url });
  } catch (e) {
    // Payment setup failed — remove the unpaid order so it doesn't linger.
    console.error("festdash checkout error:", e);
    await admin.from("festdash_orders").delete().eq("id", data.id);
    return NextResponse.json(
      { error: "Couldn't start secure payment. Please try again." },
      { status: 502 }
    );
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("festdash_orders")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data ?? [] });
}
