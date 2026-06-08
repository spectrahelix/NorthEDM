import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const VALID_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
type Status = (typeof VALID_STATUSES)[number];

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

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "archon" && profile?.role !== "warden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { reportId?: number; status?: string; resolutionNotes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { reportId, status, resolutionNotes } = body;

  if (!reportId || !status || !VALID_STATUSES.includes(status as Status)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminClient
    .from("reports")
    .update({
      status,
      reviewed_by: user.id,
      resolution_notes: resolutionNotes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
