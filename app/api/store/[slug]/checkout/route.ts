import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { storeAdminClient } from "@/utils/store";
import { storeRail } from "@/utils/storeRail";
import { isWalletMethod, orderRef, walletNumberFor } from "@/utils/gambiaPay";
import { loadShippingSettings, quoteShipping } from "@/utils/shipping";
import { emailUser } from "@/utils/notifyEmail";
import { formatMoney } from "@/utils/money";
import { docPath } from "@/utils/orderDocs";
import { createPaymentRequest, WAYCHIT_MAX_GMD, waychitCharge, waychitState } from "@/utils/waychit";
import { safeOrigin } from "@/utils/safeRedirect";
import { loadLocalRules, remitFeeIn } from "@/utils/localRules";

// Checkout for an embedded store (/[store]). Mirrors /api/shop/checkout's rules:
// the client cart is NEVER trusted — every price and stock count is re-read
// server-side from `products` before a Stripe session is created.
//
// Only a live, paid-up store can take money: a draft store isn't public, and a store
// whose operator hasn't paid (billing_status) has checkout closed. See
// docs/FRANKS_MARKETPLACE.md.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const items: { id: number; qty: number }[] = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: "Cart is empty." }, { status: 400 });

  const admin = storeAdminClient();
  const { data: store } = await admin
    .from("stores")
    .select("id, slug, name, active, billing_status, operator_fee_bps, platform_fee_bps, owner_user_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  if (!store.active) {
    return NextResponse.json({ error: "This store isn't open yet." }, { status: 403 });
  }
  if (store.billing_status !== "active") {
    return NextResponse.json(
      { error: "This store isn't accepting orders right now." },
      { status: 403 }
    );
  }

  // Only vendors actually in this store may be sold here.
  const { data: members } = await admin
    .from("store_vendors").select("vendor_id").eq("store_id", store.id).eq("status", "approved");
  const memberIds = new Set((members ?? []).map((m) => Number(m.vendor_id)));
  if (memberIds.size === 0) return NextResponse.json({ error: "This store has no vendors yet." }, { status: 400 });

  // Re-read every product from the database — prices/stock from the client are ignored.
  const ids = items.map((i) => Number(i.id)).filter(Number.isFinite);
  const { data: products } = await admin
    .from("products")
    .select("id, vendor_id, name, price, inventory_count, is_public, status, weight_g")
    .in("id", ids);
  const byId = new Map((products ?? []).map((p) => [Number(p.id), p]));

  // A "lights out" vendor's items can't be bought even by a crafted request:
  // the page already hides them, but this route re-reads with the service
  // role, which skips the visibility rules.
  const vendorIds = [...new Set((products ?? []).map((p) => Number(p.vendor_id)))];
  const { data: vendorRows } = vendorIds.length
    ? await admin.from("vendors").select("id, status, is_public, suspended_at").in("id", vendorIds)
    : { data: [] as { id: number; status: string; is_public: boolean; suspended_at: string | null }[] };
  const sellable = new Set(
    (vendorRows ?? []).filter((v) => v.status === "approved" && v.is_public && !v.suspended_at).map((v) => Number(v.id)),
  );

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const orderItems: { product_id: number; vendor_id: number; name: string; price_cents: number; qty: number }[] = [];
  for (const it of items) {
    const p = byId.get(Number(it.id));
    const qty = Math.max(1, Math.floor(Number(it.qty) || 0));
    if (!p || !p.is_public || p.status !== "published" || !sellable.has(Number(p.vendor_id))) {
      return NextResponse.json({ error: "An item is no longer available." }, { status: 400 });
    }
    if (!memberIds.has(Number(p.vendor_id))) {
      return NextResponse.json({ error: "An item isn't sold by this store." }, { status: 400 });
    }
    if ((p.inventory_count ?? 0) < qty) {
      return NextResponse.json({ error: `"${p.name}" is out of stock.` }, { status: 400 });
    }
    // `products.price` is dollars; Stripe works in cents.
    const priceCents = Math.round(Number(p.price ?? 0) * 100);
    if (priceCents < 1) {
      return NextResponse.json({ error: `"${p.name}" isn't priced yet.` }, { status: 400 });
    }
    lineItems.push({
      quantity: qty,
      price_data: { currency: "usd", unit_amount: priceCents, product_data: { name: p.name ?? "Item" } },
    });
    orderItems.push({
      product_id: Number(p.id), vendor_id: Number(p.vendor_id),
      name: p.name ?? "Item", price_cents: priceCents, qty,
    });
  }

  const subtotal = orderItems.reduce((s, i) => s + i.price_cents * i.qty, 0);
  // Freeze both cuts onto the order now, so what's owed can't drift if the store's
  // fee settings change later.
  const platformFee = Math.floor((subtotal * (store.platform_fee_bps ?? 0)) / 10000);
  const operatorFee = Math.floor((subtotal * (store.operator_fee_bps ?? 0)) / 10000);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Wallet rail: a store run by a coordinator shop sells for Wave / QMoney /
  // Afrimoney paid to the coordinator, confirmed in the purse console before
  // the order counts as paid — the same flow as a FestDash wallet order.
  const rail = await storeRail(admin, (store.owner_user_id as string | null) ?? null);
  // Interim rule (2026-11-05, utils/localRules.ts): Gambian stores take card /
  // Google Pay only, plus a transfer fee for the owner's Remitly cost.
  const localRules = rail ? await loadLocalRules(admin) : null;
  if (rail && localRules && !localRules.walletsEnabled && body.paymentMethod && body.paymentMethod !== "card") {
    return NextResponse.json({ error: "For now this store takes card or Google Pay only." }, { status: 400 });
  }
  // Waychit (2026-11-04): the same wallets, paid on Waychit's page into
  // NorthEDM's own merchant account and confirmed by its signed webhook
  // (utils/waychit.ts). Only while the owner has it switched on, GMD only.
  if (rail && body.paymentMethod === "waychit") {
    if (!user) return NextResponse.json({ error: "Sign in to pay, so we can match your payment to you." }, { status: 401 });
    const wc = await waychitState(admin);
    if (!wc.enabled || rail.currency !== "GMD") return NextResponse.json({ error: "Paying through Waychit isn't available yet — pick another way to pay." }, { status: 400 });
    const { chargeGmd, processingFeeCents } = waychitCharge(subtotal, wc.fee_bps);
    if (chargeGmd > WAYCHIT_MAX_GMD) return NextResponse.json({ error: `Waychit takes up to D${WAYCHIT_MAX_GMD.toLocaleString()} per payment.` }, { status: 400 });
    const { data: wo, error: woErr } = await admin.from("store_orders").insert({
      store_id: store.id, customer_id: user.id, email: user.email ?? null, items: orderItems,
      subtotal_cents: subtotal, platform_fee_cents: platformFee, operator_fee_cents: operatorFee, total_cents: subtotal,
      processing_fee_cents: processingFeeCents, status: "awaiting_payment", payment_method: "waychit", currency: rail.currency, vendor_id: rail.vendorId,
    }).select("id").single();
    if (woErr) return NextResponse.json({ error: woErr.message }, { status: 500 });
    const site = safeOrigin(null, req.url);
    try {
      const pr = await createPaymentRequest({
        amountGmd: chargeGmd, description: `${store.name ?? store.slug} order ${orderRef(wo.id)}`, clientReference: String(wo.id).replace(/-/g, ""),
        successRedirectUrl: `${site}/${store.slug}?order=${wo.id}`, failureRedirectUrl: `${site}/${store.slug}`,
        metadata: { kind: "store", orderId: String(wo.id) },
      });
      await admin.from("store_orders").update({ waychit_request_id: pr.id }).eq("id", wo.id);
      return NextResponse.json({ url: pr.waychitLaunchUrl });
    } catch (e) {
      console.error("waychit store payment request failed:", e);
      await admin.from("store_orders").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("id", wo.id);
      return NextResponse.json({ error: "Couldn't open Waychit. Please try again or pick another way to pay." }, { status: 502 });
    }
  }

  if (rail && body.paymentMethod !== "card") {
    if (!user) return NextResponse.json({ error: "Sign in to pay by wallet, so we can match your payment to you." }, { status: 401 });
    const method = body.paymentMethod;
    if (!isWalletMethod(method)) return NextResponse.json({ error: "Choose how you'll pay: Wave, QMoney, Afrimoney or card." }, { status: 400 });
    const payTo = walletNumberFor(rail.numbers, method);
    if (!payTo) return NextResponse.json({ error: `${method} isn't set up for this store yet — pick another way to pay.` }, { status: 400 });
    const { data: wo, error: woErr } = await admin.from("store_orders").insert({
      store_id: store.id, customer_id: user.id, email: user.email ?? null, items: orderItems,
      subtotal_cents: subtotal, platform_fee_cents: platformFee, operator_fee_cents: operatorFee, total_cents: subtotal,
      status: "awaiting_confirmation", payment_method: method, payment_to: payTo, currency: rail.currency, vendor_id: rail.vendorId,
    }).select("id").single();
    if (woErr) return NextResponse.json({ error: woErr.message }, { status: 500 });
    // The buyer keeps a link to this order: payment details now, and the
    // "I paid but it wasn't confirmed" button later if it stalls.
    await emailUser(user.email, `Your order ${orderRef(wo.id)} — pay ${formatMoney(subtotal, rail.currency)} by ${method}`, {
      heading: "Your order is placed — now pay",
      intro: `Send ${formatMoney(subtotal, rail.currency)} by ${method} to ${payTo} and put ${orderRef(wo.id)} in the note. Then enter your transaction reference on the store page. If it isn't confirmed within 24 hours, open this order and tell NorthEDM.`,
      rows: [["Order", orderRef(wo.id)], ["Amount", formatMoney(subtotal, rail.currency)], ["Pay to", `${payTo} (${method})`]],
      cta: { label: "Open your order", path: docPath("store", wo.id, "invoice") },
    }).catch(() => {});
    return NextResponse.json({ orderId: wo.id, payTo, method, reference: orderRef(wo.id), total_cents: subtotal, currency: rail.currency, coordinator: rail.coordinatorName });
  }

  // Shipping (US card stores): destination + service from the cart, re-quoted
  // here from the products' weights; paid inside Checkout as a shipping option
  // and passed to the operator in full at settlement. A Gambian (wallet-rail)
  // store hands over locally, so it ships nothing and charges no shipping.
  const country = String(body.country || "US").toUpperCase().slice(0, 2);
  let ship: { cents: number; name: string; eta: string; eta_days: [number, number]; zone: string; weight_g: number } | null = null;
  if (!rail) {
    const settings = await loadShippingSettings(admin);
    const quote = quoteShipping({ items: orderItems.map((i) => ({ weight_g: byId.get(Number(i.product_id))?.weight_g ?? null, qty: i.qty })), country, rates: settings.rates, handlingCents: settings.handling_cents });
    const svc = quote.options.find((o) => o.id === body.shippingService) ?? quote.options[0];
    if (!svc) return NextResponse.json({ error: "This store can't ship to that country yet." }, { status: 400 });
    ship = { cents: svc.cents, name: svc.name, eta: svc.eta, eta_days: svc.eta_days, zone: quote.zone, weight_g: quote.weight_g };
  }

  const remitFee = rail && localRules ? await remitFeeIn(rail.currency, localRules.remitFeeUsdCents) : 0;
  if (remitFee > 0) lineItems.push({ quantity: 1, price_data: { currency: "usd", unit_amount: remitFee, product_data: { name: "International transfer fee", description: "Sending the shop its share in The Gambia" } } });

  const { data: order, error: orderErr } = await admin.from("store_orders").insert({
    store_id: store.id,
    customer_id: user?.id ?? null,
    email: user?.email ?? null,
    items: orderItems,
    subtotal_cents: subtotal,
    platform_fee_cents: platformFee,
    operator_fee_cents: operatorFee,
    total_cents: subtotal + (ship?.cents ?? 0) + remitFee,
    remit_fee_cents: remitFee,
    ...(ship ? { shipping_cents: ship.cents, ship_country: country, shipping_zone: ship.zone, shipping_service: ship.name, shipping_eta: ship.eta, package_weight_g: ship.weight_g } : {}),
    status: "pending",
    // Card on a wallet-rail store: priced and charged in the shop's currency;
    // the webhook books the split as owed by the owner (collected_by = 'owner').
    ...(rail ? { currency: rail.currency, vendor_id: rail.vendorId, payment_method: "card" } : {}),
  }).select("id").single();
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });
  if (rail) for (const li of lineItems) if (li.price_data) li.price_data.currency = rail.currency.toLowerCase();

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // US stores: a foreign buyer may pay in their own currency (Stripe adds its
    // conversion charge to their total; the store still gets USD). Held-card
    // Gambian orders can't use it (manual capture), so it's off for the rail.
    ...(rail ? {} : { adaptive_pricing: { enabled: true } }),
    line_items: lineItems,
    success_url: `${origin}/${store.slug}?order=${order.id}`,
    cancel_url: `${origin}/${store.slug}`,
    shipping_address_collection: { allowed_countries: rail ? ["GM", "US", "GB", "SN"] : [country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry] },
    ...(ship ? { shipping_options: [{ shipping_rate_data: { type: "fixed_amount" as const, fixed_amount: { amount: ship.cents, currency: "usd" }, display_name: ship.name, delivery_estimate: { minimum: { unit: "day" as const, value: ship.eta_days[0] }, maximum: { unit: "day" as const, value: ship.eta_days[1] } } } }] } : {}),
    customer_email: user?.email ?? undefined,
    metadata: { kind: "store_order", store_order_id: order.id, store_slug: store.slug, hold: rail ? "1" : "0" },
    client_reference_id: order.id,
    // Gambian stores: authorise now, charge at handover (operator's "Handed
    // over"). A dispute can't land on a sale that never left the counter.
    ...(rail ? { payment_intent_data: { capture_method: "manual" as const, metadata: { store_order_id: order.id } } } : {}),
  });

  await admin.from("store_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
  return NextResponse.json({ url: session.url });
}
