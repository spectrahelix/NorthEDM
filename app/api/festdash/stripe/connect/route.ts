import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";
import { safeNext } from "@/utils/safeRedirect";
import { vendorStripeAccount } from "@/utils/storePayouts";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST — create (or reuse) the vendor's Stripe Express account and return an
// onboarding Account Link URL for them to complete payout setup.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("vendor_id")
    .eq("id", user.id)
    .single();
  if (!profile?.vendor_id) {
    return NextResponse.json({ error: "No vendor linked to this account" }, { status: 403 });
  }

  // Any vendor (FestDash, marketplace, store operator) — one Connect account
  // covers FestDash card orders and embedded-store sales. Lives on
  // vendors.stripe_account_id; mirrored to festdash_vendors for older readers.
  const admin = getAdminClient();
  const { data: vendor } = await admin.from("vendors").select("id, name").eq("id", profile.vendor_id).maybeSingle();
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const returnTo = safeNext(typeof body?.returnTo === "string" ? body.returnTo : null) ?? "/festdash/vendor-dashboard";

  const stripe = getStripe();
  let accountId = await vendorStripeAccount(admin, Number(vendor.id));

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email ?? undefined,
      business_profile: vendor.name ? { name: vendor.name } : undefined,
      capabilities: { transfers: { requested: true } },
      metadata: { vendor_id: String(vendor.id) },
    });
    accountId = account.id;
  }
  await admin.from("vendors").update({ stripe_account_id: accountId }).eq("id", vendor.id);
  await admin.from("festdash_vendors").update({ stripe_account_id: accountId }).eq("vendor_id", vendor.id);

  const origin = new URL(req.url).origin;
  const sep = returnTo.includes("?") ? "&" : "?";
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}${returnTo}${sep}stripe=refresh`,
    return_url: `${origin}${returnTo}${sep}stripe=connected`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
}
