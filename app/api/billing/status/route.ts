import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { asKind, isActiveRow, quote } from "@/utils/billing";
import { isLocalRail } from "@/utils/gambiaPay";
import { activeSubscription } from "@/utils/coordinator";

// GET ?kind=festdash|store|bundle&storeSlug=&code= → what the dashboard card shows.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const kind = asKind(url.searchParams.get("kind"));
  const code = url.searchParams.get("code");
  const admin = serviceClient();
  const { data: prof } = await admin.from("user_profiles").select("vendor_id").eq("id", user.id).maybeSingle();
  const vendorId = (prof?.vendor_id as number | null) ?? null;

  let filter: { column: "vendor_id" | "store_id"; value: string | number } | null = null;
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
  } else {
    const slug = url.searchParams.get("storeSlug") ?? "";
    const { data: store } = await admin.from("stores").select("id, billing_status").eq("slug", slug).maybeSingle();
    if (!store) return NextResponse.json({ not_applicable: true });
    filter = { column: "store_id", value: store.id as string };
  }
  // The bundle covers both products, so a bundle row satisfies either card.
  const kinds = kind === "bundle" ? ["bundle"] : [kind, "bundle"];
  const { data: row } = await admin
    .from("stripe_subscriptions")
    .select("kind, status, current_period_end, amount_cents, stripe_customer_id")
    .in("kind", kinds).eq(filter.column, filter.value)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const q = await quote(admin, vendorId, kind, code);
  return NextResponse.json({
    active: isActiveRow(row), status: row?.status ?? null, current_period_end: row?.current_period_end ?? null, active_kind: row?.kind ?? null,
    amount_cents: q.amount_cents, recurring_cents: q.recurring_cents, list_cents: q.list_cents, discounted: q.discounted, discount_label: q.discount_label,
    invalid_code: q.invalid_code, has_customer: !!row?.stripe_customer_id,
    bundle_available: !!vendorId && (cardRail || walletRail), bundle_cents: q.bundle_cents, single_cents: q.single_cents, wallet_rail: walletRail,
    // A wallet-rail shop may already be paid up through its coordinator.
    coordinator_paid_through: walletRail && vendorId ? (await activeSubscription(admin, vendorId))?.period_end ?? null : null,
  });
}
