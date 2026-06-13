import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import FestDashAdminClient from "./client";

const ADMIN_EMAIL = "cjblue27@gmail.com";

export default async function FestDashAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const isAdmin =
    profile?.role === "archon" || profile?.role === "warden" || user.email === ADMIN_EMAIL;
  if (!isAdmin) redirect("/");

  // Use service role for admin queries — RLS would otherwise restrict results
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [
    { data: applications },
    { data: activeVendors },
    { data: recentOrders },
  ] = await Promise.all([
    admin.from("festdash_vendor_applications").select("*").order("created_at", { ascending: false }),
    admin.from("festdash_vendors").select("id, vendor_id, is_active, joined_at, vendors(name, category)").order("joined_at", { ascending: false }),
    admin.from("festdash_orders").select("id, customer_name, event_name, status, total_cents, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  // All approved vendors not yet enrolled in FestDash
  const enrolledIds = (activeVendors ?? []).map((v) => v.vendor_id);
  const { data: unenrolledVendors } = await admin
    .from("vendors")
    .select("id, name, category")
    .eq("status", "approved")
    .not("id", "in", `(${enrolledIds.length ? enrolledIds.join(",") : "0"})`)
    .order("name");

  return (
    <FestDashAdminClient
      applications={applications ?? []}
      activeVendors={activeVendors ?? []}
      recentOrders={recentOrders ?? []}
      unenrolledVendors={unenrolledVendors ?? []}
    />
  );
}
