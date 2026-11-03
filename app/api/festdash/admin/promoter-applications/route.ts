import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "cjblue27@gmail.com";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const isAdmin =
    profile?.role === "archon" || profile?.role === "warden" || user.email === ADMIN_EMAIL;
  return isAdmin ? user : null;
}

export async function GET() {
  const supabase = await createClient();
  if (!await checkAdmin(supabase)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin
    .from("festdash_promoter_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const inviters = [...new Set((data ?? []).map((a) => a.invited_by).filter(Boolean))] as string[];
  const { data: names } = inviters.length ? await admin.from("user_profiles").select("id, display_name").in("id", inviters) : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  return NextResponse.json({ applications: (data ?? []).map((a) => ({ ...a, invited_by_name: a.invited_by ? nameOf.get(a.invited_by) ?? null : null })) });
}
