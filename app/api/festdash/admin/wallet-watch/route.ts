import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, isSiteAdminUser } from "@/utils/coordinator";
import { loadWalletWatch } from "@/utils/walletWatch";

async function guard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = serviceClient();
  if (!(await isSiteAdminUser(admin, user))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { admin };
}
// GET — open wallet-payment concerns (rejected with a reference, unconfirmed 24h+, reported).
export async function GET() {
  const g = await guard(); if ("error" in g) return g.error;
  return NextResponse.json({ rows: await loadWalletWatch(g.admin) });
}
// POST { kind, id } — the owner closes one (checked with the customer/coordinator).
export async function POST(req: Request) {
  const g = await guard(); if ("error" in g) return g.error;
  const body = await req.json().catch(() => ({}));
  const table = body.kind === "store" ? "store_orders" : body.kind === "festdash" ? "festdash_orders" : null;
  if (!table || !body.id) return NextResponse.json({ error: "kind and id required" }, { status: 400 });
  const { error } = await g.admin.from(table).update({ payment_watch_resolved_at: new Date().toISOString() }).eq("id", String(body.id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
