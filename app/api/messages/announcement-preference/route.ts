import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await admin.from("member_broadcast_opt_outs").select("user_id").eq("user_id", user.id).maybeSingle();
  return error ? NextResponse.json({ error: "Could not load preference." }, { status: 500 }) : NextResponse.json({ opted_out: !!data });
}

export async function POST(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.opted_out !== "boolean") return NextResponse.json({ error: "Invalid preference." }, { status: 400 });
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const result = body.opted_out
    ? await admin.from("member_broadcast_opt_outs").upsert({ user_id: user.id, updated_at: new Date().toISOString() })
    : await admin.from("member_broadcast_opt_outs").delete().eq("user_id", user.id);
  return result.error ? NextResponse.json({ error: "Could not save preference." }, { status: 500 }) : NextResponse.json({ ok: true });
}
