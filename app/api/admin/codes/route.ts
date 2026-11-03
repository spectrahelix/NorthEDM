import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, isSiteAdminUser } from "@/utils/coordinator";

// Owner's discount codes: list everything (incl. promoter-minted, with who
// minted it), create, switch off.
async function guard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const admin = serviceClient();
  if (!(await isSiteAdminUser(admin, user))) return { ok: false as const, status: 403 };
  return { ok: true as const, admin, user };
}

export async function GET() {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "Forbidden" }, { status: g.status });
  const { data } = await g.admin.from("discount_codes").select("*").order("created_at", { ascending: false }).limit(300);
  const minters = [...new Set((data ?? []).map((r) => r.minted_by).filter(Boolean))] as string[];
  const { data: names } = minters.length ? await g.admin.from("user_profiles").select("id, display_name").in("id", minters) : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  return NextResponse.json({ codes: (data ?? []).map((r) => ({ ...r, minted_by_name: r.minted_by ? nameOf.get(r.minted_by) ?? r.minted_by.slice(0, 8) : null })) });
}

export async function POST(req: Request) {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "Forbidden" }, { status: g.status });
  const body = await req.json().catch(() => ({}));
  if (body.action === "toggle") {
    const { data, error } = await g.admin.from("discount_codes").update({ active: !!body.active }).eq("id", String(body.id)).select("id, active").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ code: data });
  }
  const code = String(body.code ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
  if (code.length < 3) return NextResponse.json({ error: "Code needs at least 3 letters or numbers." }, { status: 400 });
  const pct = Math.round(Number(body.percentOff)), amt = Math.round(Number(body.amountOff) * 100);
  const row: Record<string, unknown> = { code, note: typeof body.note === "string" ? body.note.trim().slice(0, 160) || null : null };
  if (Number.isFinite(pct) && pct > 0) row.percent_off = Math.min(100, pct);
  else if (Number.isFinite(amt) && amt > 0) row.amount_off_cents = amt;
  else return NextResponse.json({ error: "Enter a percent or a dollar amount off." }, { status: 400 });
  const max = body.oneTime ? 1 : Number.isFinite(Number(body.maxRedemptions)) && Number(body.maxRedemptions) > 0 ? Math.round(Number(body.maxRedemptions)) : null;
  row.max_redemptions = max;
  if (typeof body.expiresAt === "string" && body.expiresAt) row.expires_at = new Date(body.expiresAt).toISOString();
  const { data, error } = await g.admin.from("discount_codes").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That code already exists." : error.message }, { status: 400 });
  return NextResponse.json({ code: data });
}
