import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const ADMIN_EMAIL = "cjblue27@gmail.com";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Always use getUser() — never getSession() — to verify with the auth server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isForumAdmin =
    profile?.role === "archon" || profile?.role === "warden";
  const isLegacyAdmin = user.email === ADMIN_EMAIL;

  if (!isForumAdmin && !isLegacyAdmin) {
    redirect("/");
  }

  return <>{children}</>;
}
