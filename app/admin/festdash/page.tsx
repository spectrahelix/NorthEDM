import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
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

  const { data: applications } = await supabase
    .from("festdash_vendor_applications")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: activeVendors } = await supabase
    .from("festdash_vendors")
    .select("id, vendor_id, joined_at, vendors(name, category)")
    .eq("is_active", true);

  const { data: recentOrders } = await supabase
    .from("festdash_orders")
    .select("id, customer_name, event_name, status, total_cents, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <FestDashAdminClient
      applications={applications ?? []}
      activeVendors={activeVendors ?? []}
      recentOrders={recentOrders ?? []}
    />
  );
}
