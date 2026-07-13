import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Creates a Stripe Checkout session for the cart. Prices/stock are validated
// server-side from shop_products (the client cart is never trusted). A pending
// shop_orders row is created and its id is carried in session metadata so the
// webhook can mark it paid + decrement stock.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const items: { id: string; qty: number }[] = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: "Cart is empty." }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const ids = items.map((i) => i.id);
  const { data: products } = await admin
    .from("shop_products").select("id, name, price_cents, inventory_count, active").in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const orderItems: { product_id: string; name: string; price_cents: number; qty: number }[] = [];
  for (const it of items) {
    const p = byId.get(it.id);
    const qty = Math.max(1, Math.floor(Number(it.qty) || 0));
    if (!p || !p.active) return NextResponse.json({ error: "An item is no longer available." }, { status: 400 });
    if (p.inventory_count < qty) return NextResponse.json({ error: `"${p.name}" is out of stock.` }, { status: 400 });
    lineItems.push({
      quantity: qty,
      price_data: { currency: "usd", unit_amount: p.price_cents, product_data: { name: p.name } },
    });
    orderItems.push({ product_id: p.id, name: p.name, price_cents: p.price_cents, qty });
  }
  const subtotal = orderItems.reduce((s, i) => s + i.price_cents * i.qty, 0);

  // Who's ordering (optional — guest checkout allowed).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  // Promoter hoodie attribution: a scanned hoodie leaves an `ne_hoodie` cookie.
  // If it maps to an active hoodie, apply that promoter's discount — the amount
  // the customer saves is credited to the promoter on payment (in the webhook).
  const cookieStore = await cookies();
  const hoodieCode = cookieStore.get("ne_hoodie")?.value;
  let hoodie: { code: string; promoter_user_id: string; percent_off: number } | null = null;
  if (hoodieCode) {
    const { data: h } = await admin
      .from("promoter_hoodies")
      .select("code, promoter_user_id, percent_off, active")
      .eq("code", hoodieCode)
      .maybeSingle();
    if (h && h.active) hoodie = { code: h.code, promoter_user_id: h.promoter_user_id, percent_off: h.percent_off };
  }
  const discountCents = hoodie ? Math.floor((subtotal * hoodie.percent_off) / 100) : 0;

  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (hoodie && discountCents > 0) {
    const coupon = await stripe.coupons.create({
      percent_off: hoodie.percent_off,
      duration: "once",
      name: `Promoter code · ${hoodie.code}`,
    });
    discounts = [{ coupon: coupon.id }];
  }

  // Prefill checkout from the user's saved personal info (name, phone, address)
  // by attaching a Stripe customer. Falls back to just the email.
  let customerId: string | null = null;
  if (user) {
    const { data: me } = await admin
      .from("user_profiles")
      .select("full_name, phone, address_line1, address_line2, city, region, postal_code")
      .eq("id", user.id)
      .single();
    if (me && (me.address_line1 || me.full_name)) {
      const address = me.address_line1
        ? {
            line1: me.address_line1,
            line2: me.address_line2 || undefined,
            city: me.city || undefined,
            state: me.region || undefined,
            postal_code: me.postal_code || undefined,
            country: "US",
          }
        : undefined;
      const cust = await stripe.customers.create({
        email: user.email ?? undefined,
        name: me.full_name || undefined,
        phone: me.phone || undefined,
        address,
        ...(address ? { shipping: { name: me.full_name || user.email || "Customer", phone: me.phone || undefined, address } } : {}),
      });
      customerId = cust.id;
    }
  }

  const { data: order, error: orderErr } = await admin.from("shop_orders").insert({
    customer_id: user?.id ?? null,
    email: user?.email ?? null,
    items: orderItems,
    subtotal_cents: subtotal,
    shipping_cents: 0,
    total_cents: subtotal - discountCents,
    status: "pending",
    hoodie_code: hoodie?.code ?? null,
    promoter_user_id: hoodie?.promoter_user_id ?? null,
    discount_cents: discountCents,
  }).select("id").single();
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: `${origin}/shop/success?order=${order.id}`,
    cancel_url: `${origin}/shop/cart`,
    shipping_address_collection: { allowed_countries: ["US"] },
    // Attach the customer (prefills name/address) or just the email.
    ...(customerId ? { customer: customerId } : { customer_email: user?.email ?? undefined }),
    ...(discounts ? { discounts } : {}),
    metadata: { order_id: order.id },
    client_reference_id: order.id,
  });

  await admin.from("shop_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
  return NextResponse.json({ url: session.url });
}
