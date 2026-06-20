import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|preview|scan|monitor|headless|lighthouse/i;
const ADMIN_EMAIL = "cjblue27@gmail.com";

// Records an anonymous pageview. Fire-and-forget from the client. Attributes
// the view to the signed-in user (if any) and flags admins — derived
// server-side from the auth cookie, never trusted from the client.
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (BOT_RE.test(ua)) return new NextResponse(null, { status: 204 });

  let body: { path?: string; referrer?: string; visitorId?: string };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const path = typeof body.path === "string" ? body.path.slice(0, 512) : "";
  if (!path || !path.startsWith("/")) return new NextResponse(null, { status: 204 });

  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 512) : null;
  const visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 64) : null;

  // Who is this? (from the auth cookie on the beacon request.)
  let userId: string | null = null;
  let isAdmin = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      const { data: profile } = await supabase
        .from("user_profiles").select("role").eq("id", user.id).maybeSingle();
      isAdmin =
        profile?.role === "archon" || profile?.role === "warden" || user.email === ADMIN_EMAIL;
    }
  } catch {
    // unauthenticated / no cookie — treat as guest
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await admin.from("page_views").insert({
    path, referrer, visitor_id: visitorId, user_id: userId, is_admin: isAdmin,
  });

  return new NextResponse(null, { status: 204 });
}
