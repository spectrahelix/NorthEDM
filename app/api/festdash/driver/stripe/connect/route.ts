import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";

// POST — create (or reuse) the runner's Stripe Express account and return an
// onboarding link. Same shape as the vendor one: runner fees are paid to this
// account at the delivery code.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: driver } = await admin.from("festdash_drivers").select("id, display_name, stripe_account_id").eq("user_id", user.id).maybeSingle();
  if (!driver) return NextResponse.json({ error: "Register as a runner first." }, { status: 404 });

  const stripe = getStripe();
  let accountId = driver.stripe_account_id as string | null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email ?? undefined,
      capabilities: { transfers: { requested: true } },
      metadata: { festdash_driver_id: String(driver.id) },
    });
    accountId = account.id;
    await admin.from("festdash_drivers").update({ stripe_account_id: accountId }).eq("id", driver.id);
  }
  const origin = new URL(req.url).origin;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/festdash/driver?stripe=refresh`,
    return_url: `${origin}/festdash/driver?stripe=connected`,
    type: "account_onboarding",
  });
  return NextResponse.json({ url: link.url });
}
