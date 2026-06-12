import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const ADMIN_EMAIL = "cjblue27@gmail.com";

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

  const { id } = await params;
  const { action } = await req.json(); // "approve" | "reject"

  if (action === "approve") {
    // Fetch application
    const { data: app } = await supabase
      .from("festdash_vendor_applications")
      .select("vendor_id, user_id")
      .eq("id", id)
      .single();

    if (app?.vendor_id) {
      // Insert into approved vendors (upsert in case already exists)
      await supabase.from("festdash_vendors").upsert({
        vendor_id: app.vendor_id,
        user_id: app.user_id,
        is_active: true,
      }, { onConflict: "vendor_id" });
    }
  }

  const { error } = await supabase
    .from("festdash_vendor_applications")
    .update({ status: action === "approve" ? "approved" : "rejected" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
