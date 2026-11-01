import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CoordinatorsClient from "./client";

export const metadata = { title: "Admin · Coordinators" };

const ADMIN_EMAIL = "cjblue27@gmail.com";

// Owner's controls for the coordinator ("purse keeper") model: who is a
// coordinator, which shops are theirs, the splits, and confirming remittances.
export default async function CoordinatorsAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = me?.role === "archon" || me?.role === "warden" || user.email === ADMIN_EMAIL;
  if (!isAdmin) redirect("/");
  return <CoordinatorsClient />;
}
