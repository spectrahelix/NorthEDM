import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "cjblue27@gmail.com";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user?.id ?? "")
      .single();

    const isAdmin =
      profile?.role === "archon" ||
      profile?.role === "warden" ||
      user?.email === ADMIN_EMAIL;

    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

    if (!data.id) {
      return NextResponse.json({ error: "Missing vendor id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("vendors")
      .update({
        status: data.status,
        vendor_type: data.vendorType,
        is_public: data.isPublic,
      })
      .eq("id", data.id);

    if (error) {
      console.error("VENDOR UPDATE ERROR:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Sync the Vendor tag on the owner's profile (service role — the flag is
    // guarded against non-service-role writes).
    const { data: vendorRow } = await supabase
      .from("vendors")
      .select("user_id")
      .eq("id", data.id)
      .single();
    if (vendorRow?.user_id) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      await admin
        .from("user_profiles")
        .update({ is_vendor: data.status === "approved" })
        .eq("id", vendorRow.user_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("VENDOR UPDATE API ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
