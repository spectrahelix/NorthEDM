import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { isActiveRow, quote, type SubscriptionKind } from "@/utils/billing";
import { isLocalRail } from "@/utils/gambiaPay";

// GET ?kind=festdash|store&storeSlug= → what the dashboard card shows.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const kind: SubscriptionKind = url.searchParams.get("kind") === "store" ? "store" : "festdash";
  const admin = serviceClient();
  const { data: prof } = await admin.from("user_profiles").select("vendor_id").eq("id", user.id).maybeSingle();
  const vendorId = (prof?.vendor_id as number | null) ?? null;

  let filter: { column: "vendor_id" | "store_id"; value: string | number } | null = null;
  if (kind === "festdash") {
    if (!vendorId) return NextResponse.json({ not_applicable: true });
    const { data: vendor } = await admin.from("vendors").select("id, coordinator_user_id, currency").eq("id", vendorId).maybeSingle();
    if (!vendor || isLocalRail(vendor)) return NextResponse.json({ not_applicable: true });
    filter = { column: "vendor_id", value: vendorId };
  } else {
    const slug = url.searchParams.get("storeSlug") ?? "";
    const { data: store } = await admin.from("stores").select("id, billing_status").eq("slug", slug).maybeSingle();
    if (!store) return NextResponse.json({ not_applicable: true });
    filter = { column: "store_id", value: store.id as string };
  }
  const { data: row } = await admin
    .from("stripe_subscriptions")
    .select("status, current_period_end, amount_cents, stripe_customer_id")
    .eq("kind", kind).eq(filter.column, filter.value)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const q = await quote(admin, vendorId);
  return NextResponse.json({
    active: isActiveRow(row), status: row?.status ?? null, current_period_end: row?.current_period_end ?? null,
    amount_cents: row?.amount_cents ?? q.amount_cents, list_cents: q.list_cents, discounted: q.discounted, has_customer: !!row?.stripe_customer_id,
  });
}
