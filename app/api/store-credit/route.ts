import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Current user's store-credit balance (in cents).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("store_credit_balances")
    .select("balance_cents")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ balanceCents: data?.balance_cents ?? 0 });
}
