import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { notifyMarketplaceApplication } from "@/utils/alerts";

// A logged-in user applies for paid Marketplace access. Insert runs as the user
// (RLS: owner insert). The Archon reviews + grants at /admin/marketplace.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const businessName = String(body.businessName || "").trim();
  if (businessName.length < 2) {
    return NextResponse.json({ error: "Please enter your business name." }, { status: 400 });
  }

  const { error } = await supabase.from("marketplace_applications").insert({
    user_id: user.id,
    business_name: businessName.slice(0, 120),
    category: String(body.category || "").trim().slice(0, 80) || null,
    description: String(body.description || "").trim().slice(0, 2000) || null,
    contact: String(body.contact || "").trim().slice(0, 200) || null,
    website: String(body.website || "").trim().slice(0, 200) || null,
    status: "pending",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyMarketplaceApplication({ businessName, email: user.email ?? undefined });
  return NextResponse.json({ ok: true });
}
