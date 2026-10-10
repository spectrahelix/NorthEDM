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

    // vendor_id is copied from the applicant's profile AT APPLY TIME, so it is
    // null for anyone who applied before being granted vendor access — which,
    // until 2026-10-10, was everyone, because nothing set it. When it is
    // missing this upsert was simply skipped: the admin saw "approved" and the
    // vendor was never actually enrolled, silently. Look it up now instead.
    let vendorId: number | null = (app?.vendor_id as number | null) ?? null;
    if (!vendorId && app?.user_id) {
      const { data: prof } = await adminClient
        .from("user_profiles").select("vendor_id").eq("id", app.user_id).maybeSingle();
      vendorId = (prof?.vendor_id as number | null) ?? null;
      if (vendorId) {
        await adminClient
          .from("festdash_vendor_applications")
          .update({ vendor_id: vendorId })
          .eq("id", id);
      }
    }

    if (vendorId) {
      await adminClient.from("festdash_vendors").upsert({
        vendor_id: vendorId,
        user_id: app?.user_id ?? null,
        is_active: true,
      }, { onConflict: "vendor_id" });
    } else {
      // Never approve into silence. The admin needs to know this did nothing.
      return NextResponse.json({
        ok: false,
        error:
          "Approved the application, but this person has no vendor record yet, so they are not enrolled in FestDash. Approve them on /admin/vendors first — that grants access — then approve this again.",
      }, { status: 409 });
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
