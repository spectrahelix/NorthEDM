import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, coordinatorFor } from "@/utils/coordinator";

// POST — the coordinator logs money they sent to the owner (Remitly etc.):
// where it came from is implied by the ledger; what it's for and how much are
// recorded here. The owner confirms what actually landed in /admin.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = serviceClient();
  const me = await coordinatorFor(admin, user.id);
  if (!me) return NextResponse.json({ error: "Not a coordinator." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  const currency = typeof body.currency === "string" ? body.currency.toUpperCase().slice(0, 3) : "USD";
  const method = typeof body.method === "string" ? body.method.trim().slice(0, 24) || "remitly" : "remitly";
  const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 64) || null : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) || null : null;
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Enter the amount you sent." }, { status: 400 });

  const { data, error } = await admin.from("coordinator_ledger").insert({
    kind: "remittance", coordinator_user_id: user.id, currency, gross_cents: Math.round(amount * 100),
    method, reference, note, created_by: user.id,
  }).select("id, gross_cents, currency, method, reference, created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ remittance: data });
}
