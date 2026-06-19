import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import PromoterApplicationsClient from "./client";

const ADMIN_EMAIL = "cjblue27@gmail.com";

export default async function FestDashPromotersAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const isAdmin =
    profile?.role === "archon" || profile?.role === "warden" || user.email === ADMIN_EMAIL;
  if (!isAdmin) redirect("/");

  return <PromoterApplicationsClient />;
}
