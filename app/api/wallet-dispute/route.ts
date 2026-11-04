import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { reportWalletPayment } from "@/utils/walletWatch";

// POST { kind: "festdash" | "store", id, note? } — the customer reports a
// wallet payment that was never confirmed (24h after their reference) or was
// rejected. Goes straight to the owner, not through the coordinator.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to report a payment." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "store" ? "store" : body.kind === "festdash" ? "festdash" : null;
  const id = String(body.id || "");
  if (!kind || !id) return NextResponse.json({ error: "kind and id required" }, { status: 400 });
  const err = await reportWalletPayment(serviceClient(), kind, id, user.id, String(body.note ?? ""));
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  return NextResponse.json({ ok: true });
}
