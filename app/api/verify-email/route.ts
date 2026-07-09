import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Confirms an admin-initiated email change. The token is the secret — anyone
// with a valid, unexpired token confirms the pending email on that account.
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const a = admin();
  const { data: row } = await a
    .from("user_profiles")
    .select("id, pending_email, email_change_expires")
    .eq("email_change_token", token)
    .maybeSingle();

  if (!row || !row.pending_email) {
    return NextResponse.json({ error: "This link is invalid or already used." }, { status: 400 });
  }
  if (row.email_change_expires && new Date(row.email_change_expires) < new Date()) {
    return NextResponse.json({ error: "This link has expired." }, { status: 400 });
  }

  const { error: authErr } = await a.auth.admin.updateUserById(row.id, {
    email: row.pending_email,
    email_confirm: true,
  });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });

  await a
    .from("user_profiles")
    .update({ pending_email: null, email_change_token: null, email_change_expires: null })
    .eq("id", row.id);

  return NextResponse.json({ ok: true, email: row.pending_email });
}
