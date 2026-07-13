import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";

// The promoter's payout-onboarding status (for the dashboard).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: promoter } = await admin
    .from("festdash_promoters")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!promoter) return NextResponse.json({ connected: false, onboarded: false });
  if (!promoter.stripe_account_id) return NextResponse.json({ connected: false, onboarded: false });

  const stripe = getStripe();
  const acct = await stripe.accounts.retrieve(promoter.stripe_account_id);
  return NextResponse.json({
    connected: true,
    onboarded: !!(acct.details_submitted && acct.payouts_enabled),
    payouts_enabled: !!acct.payouts_enabled,
  });
}
