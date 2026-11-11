import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { asKind, isActiveRow, quote } from "@/utils/billing";
import { isLocalRail } from "@/utils/gambiaPay";
import { activeSubscription } from "@/utils/coordinator";
import { loadStoreCatalogPlan } from "@/utils/storeCatalog";
import { storeSlotPlan } from "@/utils/storePlans";

// GET ?kind=festdash|store|bundle&storeSlug=&code= → what the dashboard card shows.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const kind = asKind(url.searchParams.get("kind"));
  const code = url.searchParams.get("code");
  const admin = serviceClient();
  const { data: prof } = await admin.from("user_profiles").select("vendor_id,role").eq("id", user.id).maybeSingle();
  const vendorId = (prof?.vendor_id as number | null) ?? null;

  let filter: { column: "vendor_id" | "store_id"; value: string | number } | null = null;
  let storeBilling: string | null = null;
  let catalogStoreId: string | null = null;
  let currentSubscriptionId: string | null = null;
  // Every shop can pay by card; wallet-rail shops may also pay their coordinator in dalasi.
  let cardRail = false, walletRail = false;
  if (vendorId) {
    const { data: vendor } = await admin.from("vendors").select("id, coordinator_user_id, currency").eq("id", vendorId).maybeSingle();
    cardRail = !!vendor && !isLocalRail(vendor);
    walletRail = !!vendor && isLocalRail(vendor);
  }
  if (kind === "festdash" || kind === "bundle") {
    if (!vendorId) return NextResponse.json({ not_applicable: true });
    filter = { column: "vendor_id", value: vendorId };
    const { data: store } = await admin.from("stores").select("id").eq("owner_user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
    catalogStoreId = store?.id ?? null;
  } else {
    const slug = url.searchParams.get("storeSlug") ?? "";
    const { data: store } = await admin.from("stores").select("id,billing_status,owner_user_id,stripe_subscription_id").eq("slug", slug).maybeSingle();
    if (!store) return NextResponse.json({ not_applicable: true });
    if (store.owner_user_id !== user.id && prof?.role !== "archon" && prof?.role !== "warden") return NextResponse.json({ error: "Not your store." }, { status: 403 });
    filter = { column: "store_id", value: store.id as string };
    catalogStoreId = store.id;
    storeBilling = store.billing_status;
    currentSubscriptionId = store.stripe_subscription_id;
  }
  // The bundle covers both products, so a bundle row satisfies either card.
  const kinds = kind === "bundle" ? ["bundle"] : [kind, "bundle"];
  let subscriptionQuery = admin
    .from("stripe_subscriptions")
    .select("kind, status, current_period_end, amount_cents, stripe_customer_id")
    .in("kind", kinds).eq(filter.column, filter.value);
  if (currentSubscriptionId) subscriptionQuery = subscriptionQuery.eq("stripe_subscription_id", currentSubscriptionId);
  const { data: row } = await subscriptionQuery.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const slots = url.searchParams.get("slots");
  if (kind === "store" && slots && !storeSlotPlan(slots)) return NextResponse.json({ error: "Invalid store plan." }, { status: 400 });
  const bundleAvailable = !!vendorId && (cardRail || walletRail);
  const [q, bundleQuote, catalog] = await Promise.all([
    quote(admin, vendorId, kind, code, slots ?? undefined),
    bundleAvailable ? quote(admin, vendorId, "bundle", code) : Promise.resolve(null),
    catalogStoreId ? loadStoreCatalogPlan(admin, catalogStoreId) : Promise.resolve(null),
  ]);
  return NextResponse.json({
    active: isActiveRow(row), status: row?.status ?? null, current_period_end: row?.current_period_end ?? null, active_kind: row?.kind ?? null,
    amount_cents: q.amount_cents, recurring_cents: q.recurring_cents, list_cents: q.list_cents, discounted: q.discounted, discount_label: q.discount_label,
    invalid_code: q.invalid_code, has_customer: !!row?.stripe_customer_id,
    bundle_available: bundleAvailable, bundle_cents: q.bundle_cents, single_cents: q.single_cents, wallet_rail: walletRail,
    bundle_quote: bundleQuote ? { amount_cents: bundleQuote.amount_cents, recurring_cents: bundleQuote.recurring_cents } : null,
    slot_limit: catalog?.slot_limit ?? null, selected_slots: catalog?.listing_groups.length ?? 0,
    quoted_slots: q.store_slots, pending_checkout: !!catalog?.checkout_attempt,
    manually_active: kind === "store" && storeBilling === "active" && !isActiveRow(row),
    can_subscribe: !row || row.status === "canceled" || row.status === "incomplete_expired",
    // A wallet-rail shop may already be paid up through its coordinator.
    coordinator_paid_through: walletRail && vendorId ? (await activeSubscription(admin, vendorId))?.period_end ?? null : null,
  });
}
