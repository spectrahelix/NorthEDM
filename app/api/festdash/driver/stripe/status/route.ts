import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";

// GET — the runner's payout status plus what is waiting for them: runner fees
// on delivered card orders that haven't been transferred yet.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: driver } = await admin.from("festdash_drivers").select("id, stripe_account_id").eq("user_id", user.id).maybeSingle();
  if (!driver) return NextResponse.json({ error: "Not a runner" }, { status: 404 });
  const { data: owedRows } = await admin
    .from("festdash_orders")
    .select("runner_fee_cents")
    .eq("driver_id", user.id).eq("payment_method", "card").eq("status", "delivered").is("runner_fee_transfer_id", null);
  const owed_cents = (owedRows ?? []).reduce((s, r) => s + Number(r.runner_fee_cents ?? 0), 0);
  if (!driver.stripe_account_id) return NextResponse.json({ connected: false, onboarded: false, owed_cents });
  const acct = await getStripe().accounts.retrieve(driver.stripe_account_id);
  return NextResponse.json({ connected: true, onboarded: !!(acct.details_submitted && acct.payouts_enabled), owed_cents });
}
