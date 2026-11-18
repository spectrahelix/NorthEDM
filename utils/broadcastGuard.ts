import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const OWNER_EMAIL = "cjblue27@gmail.com";

type BroadcastOk = {
  ok: true;
  userId: string;
  role: string | null;
  admin: SupabaseClient;
  canManageGroups: boolean;
};
type BroadcastError = { ok: false; status: number; error: string };

// Broadcast permissions follow the live profile (not mutable user metadata).
// A site-moderator badge gives limited broadcast authority, NOT general admin
// permissions. A business / artisan / vendor can retain its existing tags.
export async function broadcastGuard(): Promise<BroadcastOk | BroadcastError> {
  const cookieStore = await cookies();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return { ok: false, status: 401, error: "Unauthorized" };
  const { data: profile, error: roleError } = await db.from("user_profiles")
    .select("role,is_site_moderator").eq("id", user.id).maybeSingle();
  if (roleError) return { ok: false, status: 500, error: "Unable to verify broadcast permission." };
  const isAdmin = profile?.role === "archon" || profile?.role === "warden" || user.email === OWNER_EMAIL;
  if (!isAdmin && profile?.is_site_moderator !== true) {
    return { ok: false, status: 403, error: "Broadcast permission requires Moderator, Warden or Archon authority." };
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { ok: true, userId: user.id, role: profile?.role ?? null, canManageGroups: isAdmin, admin };
}
