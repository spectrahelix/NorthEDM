import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { releaseCommission } from "@/utils/commissions";

// Daily release of promoter commissions whose refund-protection window has closed
// (scheduled in vercel.json). Vercel Cron calls this with
// `Authorization: Bearer ${CRON_SECRET}`; anything else is rejected so the payout
// path can't be triggered from the public internet.
//
// This is the ONLY code path that moves commission money. It selects strictly on
// `payable_after <= now()`, and the database trigger (commission_release_guard)
// rejects an early release independently — so a bug here still can't pay early.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("[release-commissions] CRON_SECRET not set — endpoint is unauthenticated");
  }

  const db = admin();
  const { data: due, error } = await db
    .from("commissions")
    .select("id, promoter_user_id, amount_cents, source_type, source_id")
    .eq("status", "held")
    .lte("payable_after", new Date().toISOString())
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let released = 0;
  const skipped: { id: string; reason: string }[] = [];
  for (const c of due ?? []) {
    const res = await releaseCommission(db, c);
    if (res.ok) released++;
    else skipped.push({ id: c.id, reason: res.reason });
  }

  // Skips are normal (promoter hasn't connected a payout account yet) — the
  // commission stays 'held' and is retried on the next run, so nothing is lost.
  return NextResponse.json({
    checked: due?.length ?? 0,
    released,
    skipped: skipped.length,
    skippedDetail: skipped.slice(0, 20),
  });
}
