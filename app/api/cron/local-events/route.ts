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

  // Fails CLOSED in production. The previous shape allowed the request through
  // when CRON_SECRET was unset — and it WAS unset, so both cron endpoints sat
  // publicly callable: anyone could trigger a full ingest (burning the
  // Ticketmaster quota and hammering venue sites) or poke the payout run.
  // A warning in a log nobody reads is not a control.
  //
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically once
  // the variable exists, so the scheduled run is unaffected. Locally, where
  // there is no secret and no Vercel, it still runs.
  if (process.env.VERCEL_ENV === "production" && !secret) {
    console.error("CRON_SECRET missing in production — refusing to run.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
