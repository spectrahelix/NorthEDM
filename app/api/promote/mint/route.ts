import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, loadSplitSettings } from "@/utils/coordinator";
import { mintedCodeFor } from "@/utils/discountCodes";

// Promoters mint ONE-TIME discount codes to hand to a shop they are bringing
// on. The code carries the promoter: a shop that applies or checks out with it
// is attributed to them (same as their referral code) and the owner sees who
// minted it. Discount size is capped by the owner's settings.
async function promoter(admin: ReturnType<typeof serviceClient>, userId: string) {
  const { data } = await admin.from("festdash_promoters").select("user_id, referral_code, is_active").eq("user_id", userId).maybeSingle();
  return data && data.is_active ? data : null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = serviceClient();
  if (!(await promoter(admin, user.id))) return NextResponse.json({ error: "Not a promoter." }, { status: 403 });
  const s = await loadSplitSettings(admin);
  const { data } = await admin.from("discount_codes").select("id, code, percent_off, amount_off_cents, times_redeemed, max_redemptions, active, note, created_at, last_redeemed_at")
    .eq("minted_by", user.id).order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ codes: data ?? [], max_percent_off: s.mint_max_percent_off ?? 50, max_amount_off_cents: s.mint_max_amount_off_cents ?? 2000 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = serviceClient();
  const p = await promoter(admin, user.id);
  if (!p) return NextResponse.json({ error: "Not a promoter." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const s = await loadSplitSettings(admin);
  const maxPct = s.mint_max_percent_off ?? 50, maxAmt = s.mint_max_amount_off_cents ?? 2000;
  const pct = Math.round(Number(body.percentOff)), amt = Math.round(Number(body.amountOff) * 100);
  let row: Record<string, unknown>;
  if (Number.isFinite(pct) && pct > 0) {
    if (pct > maxPct) return NextResponse.json({ error: `Up to ${maxPct}% off.` }, { status: 400 });
    row = { percent_off: pct };
  } else if (Number.isFinite(amt) && amt > 0) {
    if (amt > maxAmt) return NextResponse.json({ error: `Up to $${(maxAmt / 100).toFixed(2)} off.` }, { status: 400 });
    row = { amount_off_cents: amt };
  } else return NextResponse.json({ error: "Enter a percent or a dollar amount off." }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 120) || null : null;
  let code = mintedCodeFor(p.referral_code as string | null);
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await admin.from("discount_codes").select("id").eq("code", code).maybeSingle();
    if (!clash) break;
    code = mintedCodeFor(p.referral_code as string | null);
  }
  const { data, error } = await admin.from("discount_codes").insert({ ...row, code, max_redemptions: 1, minted_by: user.id, note }).select("id, code, percent_off, amount_off_cents, note, created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ code: data });
}
