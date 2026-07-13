import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";

// Create/reuse a promoter's Stripe Express account and return an onboarding link.
// Required before a promoter can receive real cash commissions.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: promoter } = await admin
    .from("festdash_promoters")
    .select("id, display_name, stripe_account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!promoter) return NextResponse.json({ error: "Not a promoter." }, { status: 403 });

  const stripe = getStripe();
  let accountId = promoter.stripe_account_id as string | null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email ?? undefined,
      business_profile: promoter.display_name ? { name: promoter.display_name } : undefined,
      capabilities: { transfers: { requested: true } },
      metadata: { promoter_user_id: user.id },
    });
    accountId = account.id;
    await admin.from("festdash_promoters").update({ stripe_account_id: accountId }).eq("id", promoter.id);
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/festdash/promoter-dashboard?stripe=refresh`,
    return_url: `${origin}/festdash/promoter-dashboard?stripe=connected`,
    type: "account_onboarding",
  });
  return NextResponse.json({ url: link.url });
}
