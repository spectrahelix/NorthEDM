import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// A scanned hoodie QR hits /h/<code>. We count the scan, drop the attribution
// cookie (so the discount applies + credits the promoter at checkout), then send
// the shopper to the NorthEDM homepage where a welcome modal pops with their
// code + copy button. Unknown/inactive codes just land on the shop.
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: h } = await admin
    .from("promoter_hoodies")
    .select("id, active, scans")
    .eq("code", code)
    .maybeSingle();

  if (!h || !h.active) {
    return NextResponse.redirect(`${origin}/shop`);
  }

  await admin.from("promoter_hoodies").update({ scans: (h.scans ?? 0) + 1 }).eq("id", h.id);

  const res = NextResponse.redirect(`${origin}/?welcome=${encodeURIComponent(code)}`);
  res.cookies.set("ne_hoodie", code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
  });
  return res;
}
