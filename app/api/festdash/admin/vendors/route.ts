import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "cjblue27@gmail.com";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function assertAdmin(supabase: Awaited<ReturnType<typeof createClient>>, user: { id: string; email?: string | null }) {
  const { data: profile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  return profile?.role === "archon" || profile?.role === "warden" || user.email === ADMIN_EMAIL;
}

// POST — directly enroll a vendor into FestDash (bypasses application flow)
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await assertAdmin(supabase, user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vendorId } = await req.json();
  if (!vendorId) return NextResponse.json({ error: "vendorId required" }, { status: 400 });

  const adminClient = getAdminClient();

  const { data: vendor } = await adminClient
    .from("vendors").select("id, user_id").eq("id", Number(vendorId)).single();
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const { error } = await adminClient.from("festdash_vendors").upsert({
    vendor_id: vendor.id,
    user_id: vendor.user_id,
    is_active: true,
  }, { onConflict: "vendor_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PATCH — deactivate or reactivate a FestDash vendor
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await assertAdmin(supabase, user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { festdashVendorId, isActive } = await req.json();
  if (!festdashVendorId) return NextResponse.json({ error: "festdashVendorId required" }, { status: 400 });

  const adminClient = getAdminClient();
  const { error } = await adminClient
    .from("festdash_vendors")
    .update({ is_active: Boolean(isActive) })
    .eq("id", Number(festdashVendorId));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
