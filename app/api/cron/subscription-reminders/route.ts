import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminGuard } from "@/utils/admin";
import { runSubscriptionReminders } from "@/utils/subscriptionReminders";
import { escalateStaleWalletPayments } from "@/utils/walletWatch";

// Daily fee reminders for coordinator shops (scheduled in vercel.json): a week
// before the paid period ends, on its last day, and once after it lapses — to
// the shop and to its coordinator, each sent once per period. Vercel Cron calls
// this with `Authorization: Bearer ${CRON_SECRET}`. An admin session may call it
// too (the "Run fee reminders now" button on /admin/festdash/coordinators), so
// the owner can watch it work without waiting for the schedule. Anything else
// is refused: it fails closed, like the other cron routes.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  let admin;
  if (secret && auth === `Bearer ${secret}`) {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  } else {
    const g = await adminGuard();
    if (!g.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    admin = g.admin;
  }
  const result = await runSubscriptionReminders(admin);
  // Same daily pass: wallet payments still unconfirmed 24h after the customer's reference.
  const wallet = await escalateStaleWalletPayments(admin).catch((e) => ({ error: String(e) }));
  return NextResponse.json({ ...result, wallet });
}
