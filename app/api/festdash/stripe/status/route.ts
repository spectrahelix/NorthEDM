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

// GET — the vendor's Stripe payout-onboarding status (for the dashboard).
export async function GET() {
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
    .select("id, stripe_account_id")
    .eq("vendor_id", profile.vendor_id)
    .single();
  if (!vendor) {
    return NextResponse.json({ error: "Not a FestDash vendor" }, { status: 404 });
  }

  if (!vendor.stripe_account_id) {
    return NextResponse.json({ connected: false, onboarded: false });
  }

  const stripe = getStripe();
  const acct = await stripe.accounts.retrieve(vendor.stripe_account_id);

  return NextResponse.json({
    connected: true,
    onboarded: !!(acct.details_submitted && acct.payouts_enabled),
    payouts_enabled: !!acct.payouts_enabled,
    charges_enabled: !!acct.charges_enabled,
    details_submitted: !!acct.details_submitted,
  });
}
