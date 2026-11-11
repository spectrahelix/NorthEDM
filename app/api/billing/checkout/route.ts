import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { asKind, createSubscriptionCheckout } from "@/utils/billing";
import { ensureOwnStore } from "@/utils/ownStore";
import { safeNext, safeOrigin } from "@/utils/safeRedirect";
import { cancelStorePlanCheckout } from "@/utils/storePlanCheckout";

// POST { kind: "festdash" | "store" | "bundle", storeSlug?, code? } → { url } to Stripe Checkout.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const kind = asKind(body.kind);
  const code = typeof body.code === "string" ? body.code : null;
  const admin = serviceClient();
  const origin = safeOrigin(req.headers.get("origin"), req.url);
  if (req.headers.get("origin") && req.headers.get("origin") !== origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { data: me } = await admin.from("user_profiles").select("role, vendor_id").eq("id", user.id).maybeSingle();
  const vendorId = (me?.vendor_id as number | null) ?? null;

  try {
    if (body.action === "cancel_pending") {
      let storeId: string | null = null;
      if (body.storeSlug) {
        const { data: store } = await admin.from("stores").select("id,owner_user_id").eq("slug", String(body.storeSlug)).maybeSingle();
        if (store?.owner_user_id === user.id || (store && (me?.role === "archon" || me?.role === "warden"))) storeId = store.id;
      } else if (vendorId) {
        const { data: store } = await admin.from("stores").select("id").eq("owner_user_id", user.id)
          .order("created_at", { ascending: true }).limit(1).maybeSingle();
        storeId = store?.id ?? null;
      }
      if (!storeId) return NextResponse.json({ error: "Store not found." }, { status: 404 });
      await cancelStorePlanCheckout(admin, storeId);
      return NextResponse.json({ canceled: true });
    }
    if (kind === "festdash" || kind === "bundle") {
      if (!vendorId) return NextResponse.json({ error: "No vendor linked to this account." }, { status: 403 });
      const { data: vendor } = await admin.from("vendors").select("id, name, coordinator_user_id, currency").eq("id", vendorId).maybeSingle();
      if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
      // Wallet-rail shops may pay fees by card too (owner's decision, 2026-11-03):
      // the fee then lands with the owner and the coordinator's 10% is a commission.
      // The bundle needs a store to switch on; a vendor without one gets a draft
      // store under their own name, made live by the subscription.
      let store = null;
      if (kind === "bundle") {
        if (typeof body.storeSlug === "string" && body.storeSlug) {
          const { data } = await admin.from("stores").select("id,slug").eq("slug", body.storeSlug).eq("owner_user_id", user.id).maybeSingle();
          if (!data) return NextResponse.json({ error: "Choose a store you own for the bundle." }, { status: 403 });
          store = data;
        } else {
          store = await ensureOwnStore(admin, user.id, Number(vendor.id), String(vendor.name ?? "shop"));
        }
      }
      const returnPath = safeNext(typeof body.returnPath === "string" ? body.returnPath : null, store && body.storeSlug ? `/${store.slug}/manage` : "/festdash/vendor-dashboard");
      const { url } = await createSubscriptionCheckout(admin, { kind, userId: user.id, email: user.email, vendorId: vendor.id, storeId: store?.id ?? null, origin, returnPath, code, consent: body.consent });
      return NextResponse.json({ url });
    }

    const slug = String(body.storeSlug ?? "");
    const { data: store } = await admin.from("stores").select("id, slug, owner_user_id").eq("slug", slug).maybeSingle();
    if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
    const isAdmin = me?.role === "archon" || me?.role === "warden";
    if (store.owner_user_id !== user.id && !isAdmin) return NextResponse.json({ error: "Not your store." }, { status: 403 });
    const { url } = await createSubscriptionCheckout(admin, { kind, userId: user.id, email: user.email, vendorId, storeId: store.id as string, origin, returnPath: `/${store.slug}/manage`, code, slots: body.slots, consent: body.consent });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't start checkout." }, { status: 400 });
  }
}
