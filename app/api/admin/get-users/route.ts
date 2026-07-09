import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "archon" && profile?.role !== "warden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profiles, error: profilesError } = await adminClient
    .from("user_profiles")
    .select("id, display_name, avatar_url, role, created_at, is_founder, is_vendor, is_festdash_vendor, is_promoter, is_artisan")
    .order("created_at", { ascending: false });

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const {
    data: { users: authUsers },
    error: authError,
  } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const emailMap: Record<string, string> = {};
  for (const u of authUsers) {
    if (u.email) emailMap[u.id] = u.email;
  }

  const result = (profiles ?? []).map(
    (p: {
      id: string;
      display_name: string;
      avatar_url: string | null;
      role: string;
      created_at: string;
      is_founder?: boolean;
      is_vendor?: boolean;
      is_festdash_vendor?: boolean;
      is_promoter?: boolean;
      is_artisan?: boolean;
    }) => ({
      ...p,
      email: emailMap[p.id] ?? "",
    })
  );

  return NextResponse.json({ users: result });
}
