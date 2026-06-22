import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Deletes a user account: their auth user (frees the email for re-signup) plus
// app profile rows. Admin-only. Cannot delete yourself; wardens cannot delete
// archons.
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: requesterProfile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const requesterRole = requesterProfile?.role;
  if (requesterRole !== "archon" && requesterRole !== "warden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { targetUserId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const targetUserId = body.targetUserId;
  if (!targetUserId) return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "You can't delete your own account here." }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Wardens cannot delete archons.
  const { data: targetProfile } = await admin
    .from("user_profiles").select("role").eq("id", targetUserId).maybeSingle();
  if (requesterRole === "warden" && targetProfile?.role === "archon") {
    return NextResponse.json({ error: "Wardens cannot delete an Archon." }, { status: 403 });
  }

  // Remove app rows that don't cascade from auth.users, then the auth user.
  await admin.from("profiles").delete().eq("id", targetUserId);
  await admin.from("user_profiles").delete().eq("id", targetUserId);

  const { error } = await admin.auth.admin.deleteUser(targetUserId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
