import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { storeAdminClient } from "@/utils/store";

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
    .select("id, slug, name, active, billing_status, operator_fee_bps, platform_fee_bps")
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
    .select("id, vendor_id, name, price, inventory_count, is_public, status")
    .in("id", ids);
  const byId = new Map((products ?? []).map((p) => [Number(p.id), p]));

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const orderItems: { product_id: number; vendor_id: number; name: string; price_cents: number; qty: number }[] = [];
  for (const it of items) {
    const p = byId.get(Number(it.id));
    const qty = Math.max(1, Math.floor(Number(it.qty) || 0));
    if (!p || !p.is_public || p.status !== "published") {
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

  const { data: order, error: orderErr } = await admin.from("store_orders").insert({
    store_id: store.id,
    customer_id: user?.id ?? null,
    email: user?.email ?? null,
    items: orderItems,
    subtotal_cents: subtotal,
    platform_fee_cents: platformFee,
    operator_fee_cents: operatorFee,
    total_cents: subtotal,
    status: "pending",
  }).select("id").single();
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: `${origin}/${store.slug}?order=${order.id}`,
    cancel_url: `${origin}/${store.slug}`,
    shipping_address_collection: { allowed_countries: ["US"] },
    customer_email: user?.email ?? undefined,
    metadata: { kind: "store_order", store_order_id: order.id, store_slug: store.slug },
    client_reference_id: order.id,
  });

  await admin.from("store_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
  return NextResponse.json({ url: session.url });
}
