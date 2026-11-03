import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { storeAdminClient } from "@/utils/store";

// GET — what this vendor's embedded-store sales have paid them and what is
// still owed (no payout account yet). Service role after the vendor check.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: prof } = await supabase.from("user_profiles").select("vendor_id").eq("id", user.id).maybeSingle();
  if (!prof?.vendor_id) return NextResponse.json({ error: "No vendor linked to this account" }, { status: 403 });
  const admin = storeAdminClient();
  const { data } = await admin.from("store_payouts").select("status, amount_cents").eq("vendor_id", prof.vendor_id);
  let owed = 0, paid = 0;
  for (const r of data ?? []) { if (r.status === "owed") owed += Number(r.amount_cents); else if (r.status === "paid") paid += Number(r.amount_cents); }
  return NextResponse.json({ owed_cents: owed, paid_cents: paid });
}
