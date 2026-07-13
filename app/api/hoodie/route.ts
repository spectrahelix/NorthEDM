import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Public lookup for a hoodie code — used by the welcome modal to show the promo
// details. Returns only what the modal needs (never earnings). Also sets the
// attribution cookie when a code is applied from the cart ("?apply=1").
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").trim();
  if (!code) return NextResponse.json({ ok: false });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: h } = await admin
    .from("promoter_hoodies")
    .select("code, percent_off, active, promoter_user_id")
    .eq("code", code)
    .maybeSingle();
  if (!h || !h.active) return NextResponse.json({ ok: false });

  const { data: prof } = await admin
    .from("user_profiles")
    .select("display_name")
    .eq("id", h.promoter_user_id)
    .maybeSingle();

  const body = { ok: true, code: h.code, percent_off: h.percent_off, promoter_name: prof?.display_name || null };

  // When applied from the cart, set the attribution cookie so checkout discounts.
  if (url.searchParams.get("apply") === "1") {
    const res = NextResponse.json(body);
    res.cookies.set("ne_hoodie", h.code, { path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
    return res;
  }
  return NextResponse.json(body);
}
