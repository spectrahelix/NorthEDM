import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runLocalEventsIngest } from "@/utils/localEvents";

// Nightly local-events ingest (scheduled in vercel.json). Vercel Cron calls
// this with `Authorization: Bearer ${CRON_SECRET}`; we reject anything else so
// the endpoint can't be triggered by the public. Refreshes the curated seed
// list and, if TICKETMASTER_API_KEY is set, pulls new nearby music events into
// the pending review queue.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  // In production a secret is required. If none is configured, allow (local dev)
  // but log — so a misconfigured prod deploy is visible rather than wide open.
  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("CRON_SECRET not set — local-events cron is unauthenticated.");
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const result = await runLocalEventsIngest(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("local-events cron error:", e);
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}
