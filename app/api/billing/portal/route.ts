import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { billingPortalUrl, type SubscriptionKind } from "@/utils/billing";

// POST { kind, storeSlug? } → Stripe Billing Portal link (card, cancel, invoices).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const kind: SubscriptionKind = body.kind === "store" ? "store" : "festdash";
  const admin = serviceClient();
  let q = admin.from("stripe_subscriptions").select("stripe_customer_id, user_id").eq("kind", kind);
  if (kind === "store") {
    const { data: store } = await admin.from("stores").select("id, owner_user_id").eq("slug", String(body.storeSlug ?? "")).maybeSingle();
    if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
    q = q.eq("store_id", store.id as string);
  } else {
    const { data: prof } = await admin.from("user_profiles").select("vendor_id").eq("id", user.id).maybeSingle();
    if (!prof?.vendor_id) return NextResponse.json({ error: "No vendor linked." }, { status: 403 });
    q = q.eq("vendor_id", prof.vendor_id);
  }
  const { data: row } = await q.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!row?.stripe_customer_id) return NextResponse.json({ error: "No subscription yet." }, { status: 404 });
  if (row.user_id && row.user_id !== user.id) {
    const { data: me } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
    if (me?.role !== "archon" && me?.role !== "warden") return NextResponse.json({ error: "Not yours." }, { status: 403 });
  }
  const origin = new URL(req.url).origin;
  const url = await billingPortalUrl(row.stripe_customer_id, `${origin}${kind === "store" ? `/${body.storeSlug}/manage` : "/festdash/vendor-dashboard"}`);
  return NextResponse.json({ url });
}
