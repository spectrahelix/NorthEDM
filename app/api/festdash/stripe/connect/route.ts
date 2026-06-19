import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";

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
    .from("profiles")
    .select("vendor_id")
    .eq("id", user.id)
    .single();
  if (!profile?.vendor_id) {
    return NextResponse.json({ error: "No vendor linked to this account" }, { status: 403 });
  }

  const admin = getAdminClient();
  const { data: vendor } = await admin
    .from("festdash_vendors")
    .select("id, name, stripe_account_id")
    .eq("vendor_id", profile.vendor_id)
    .single();
  if (!vendor) {
    return NextResponse.json({ error: "Not a FestDash vendor" }, { status: 404 });
  }

  const stripe = getStripe();
  let accountId = vendor.stripe_account_id as string | null;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email ?? undefined,
      business_profile: vendor.name ? { name: vendor.name } : undefined,
      capabilities: { transfers: { requested: true } },
      metadata: { festdash_vendor_id: String(vendor.id) },
    });
    accountId = account.id;
    await admin
      .from("festdash_vendors")
      .update({ stripe_account_id: accountId })
      .eq("id", vendor.id);
  }

  const origin = new URL(req.url).origin;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/festdash/vendor-dashboard?stripe=refresh`,
    return_url: `${origin}/festdash/vendor-dashboard?stripe=connected`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
}
