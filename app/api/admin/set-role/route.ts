import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const VALID_ROLES = ["archon", "warden", "merchant", "wanderer", "drifter"] as const;
type Role = (typeof VALID_ROLES)[number];

export async function POST(request: NextRequest) {
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

  const { data: requesterProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const requesterRole = requesterProfile?.role;
  if (requesterRole !== "archon" && requesterRole !== "warden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { targetUserId?: string; newRole?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { targetUserId, newRole } = body;

  if (!targetUserId || !newRole || !VALID_ROLES.includes(newRole as Role)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  if (requesterRole === "warden" && newRole === "archon") {
    return NextResponse.json(
      { error: "Wardens cannot assign the Archon role" },
      { status: 403 }
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminClient
    .from("user_profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
