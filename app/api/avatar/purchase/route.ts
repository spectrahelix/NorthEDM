import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ITEM_BY_ID } from "@/app/avatar/catalog";

// Unlocks a premium avatar item by spending store credit. The catalog (and
// thus the price) is the server-side source of truth. Ownership is claimed
// first via a UNIQUE insert so concurrent calls can't double-charge; if the
// credit spend then fails, the ownership row is rolled back.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await req.json().catch(() => ({}));
  const item = typeof itemId === "string" ? ITEM_BY_ID[itemId] : undefined;
  if (!item) return NextResponse.json({ error: "Unknown item." }, { status: 400 });
  if (item.priceCents <= 0) {
    return NextResponse.json({ error: "That item is already free to use." }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Claim ownership first (idempotent on the PK). If it already exists, the
  // user owns it — nothing to charge.
  const { data: claimed, error: claimErr } = await admin
    .from("user_avatar_items")
    .upsert(
      { user_id: user.id, item_id: item.id, price_cents: item.priceCents },
      { onConflict: "user_id,item_id", ignoreDuplicates: true }
    )
    .select();
  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 });
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ ok: true, alreadyOwned: true });
  }

  // Spend the credit. Roll back ownership if the wallet can't cover it.
  const { data: newBalance, error: spendErr } = await admin.rpc("grant_store_credit", {
    p_user: user.id, p_amount: -item.priceCents,
    p_reason: "avatar_item", p_ref_type: "avatar_item", p_ref_id: item.id,
  });
  if (spendErr) {
    await admin.from("user_avatar_items")
      .delete().eq("user_id", user.id).eq("item_id", item.id);
    return NextResponse.json({ error: "Not enough store credit." }, { status: 402 });
  }

  return NextResponse.json({ ok: true, balanceCents: newBalance ?? 0 });
}
