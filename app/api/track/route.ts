import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|preview|scan|monitor|headless|lighthouse/i;

// Records an anonymous pageview. Fire-and-forget from the client.
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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await admin.from("page_views").insert({ path, referrer, visitor_id: visitorId });

  return new NextResponse(null, { status: 204 });
}
