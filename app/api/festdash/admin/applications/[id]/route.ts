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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const isAdmin =
    profile?.role === "archon" || profile?.role === "warden" || user.email === ADMIN_EMAIL;
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = getAdminClient();
  const { id } = await params;
  const { action } = await req.json(); // "approve" | "reject"

  if (action === "approve") {
    const { data: app } = await adminClient
      .from("festdash_vendor_applications")
      .select("vendor_id, user_id")
      .eq("id", id)
      .single();

    if (app?.vendor_id) {
      await adminClient.from("festdash_vendors").upsert({
        vendor_id: app.vendor_id,
        user_id: app.user_id,
        is_active: true,
      }, { onConflict: "vendor_id" });
    }
    if (app?.user_id) {
      // Light up the FestDash Vendor tag on their profile.
      await adminClient.from("user_profiles")
        .update({ is_festdash_vendor: true }).eq("id", app.user_id);
    }
  }

  const { error } = await adminClient
    .from("festdash_vendor_applications")
    .update({ status: action === "approve" ? "approved" : "rejected" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
