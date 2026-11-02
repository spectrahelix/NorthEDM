import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { createSubscriptionCheckout, type SubscriptionKind } from "@/utils/billing";
import { isLocalRail } from "@/utils/gambiaPay";

// POST { kind: "festdash" | "store", storeSlug? } → { url } to Stripe Checkout.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const kind: SubscriptionKind = body.kind === "store" ? "store" : "festdash";
  const admin = serviceClient();
  const origin = new URL(req.url).origin;

  if (kind === "festdash") {
    const { data: prof } = await admin.from("user_profiles").select("vendor_id").eq("id", user.id).maybeSingle();
    if (!prof?.vendor_id) return NextResponse.json({ error: "No vendor linked to this account." }, { status: 403 });
    const { data: vendor } = await admin.from("vendors").select("id, coordinator_user_id, currency").eq("id", prof.vendor_id).maybeSingle();
    if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    if (isLocalRail(vendor)) return NextResponse.json({ error: "Your listing fee is paid to your coordinator, not by card." }, { status: 400 });
    const { url } = await createSubscriptionCheckout(admin, { kind, userId: user.id, email: user.email, vendorId: vendor.id, origin, returnPath: "/festdash/vendor-dashboard" });
    return NextResponse.json({ url });
  }

  const slug = String(body.storeSlug ?? "");
  const { data: store } = await admin.from("stores").select("id, slug, owner_user_id").eq("slug", slug).maybeSingle();
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  const { data: me } = await admin.from("user_profiles").select("role, vendor_id").eq("id", user.id).maybeSingle();
  const isAdmin = me?.role === "archon" || me?.role === "warden";
  if (store.owner_user_id !== user.id && !isAdmin) return NextResponse.json({ error: "Not your store." }, { status: 403 });
  const { url } = await createSubscriptionCheckout(admin, { kind, userId: user.id, email: user.email, vendorId: (me?.vendor_id as number | null) ?? null, storeId: store.id as string, origin, returnPath: `/${store.slug}/manage` });
  return NextResponse.json({ url });
}
