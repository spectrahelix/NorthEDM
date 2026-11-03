import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, isSiteAdminUser } from "@/utils/coordinator";
import { DEFAULT_RATES, loadShippingSettings, type Rates } from "@/utils/shipping";

async function guard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const admin = serviceClient();
  if (!(await isSiteAdminUser(admin, user))) return { ok: false as const, status: 403 };
  return { ok: true as const, admin };
}
export async function GET() {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "Forbidden" }, { status: g.status });
  const s = await loadShippingSettings(g.admin);
  return NextResponse.json({ ...s, defaults: DEFAULT_RATES });
}
export async function POST(req: Request) {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "Forbidden" }, { status: g.status });
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.ship_from && typeof body.ship_from === "object") patch.ship_from = body.ship_from;
  if (Number.isFinite(Number(body.handling_cents))) patch.handling_cents = Math.max(0, Math.round(Number(body.handling_cents)));
  if (body.rates === null) patch.rates = null;
  else if (body.rates && typeof body.rates === "object") {
    const r = body.rates as Partial<Rates>;
    for (const z of Object.keys(r)) for (const s of r[z as keyof Rates] ?? []) {
      if (!s.id || !s.name || !Number.isFinite(Number(s.base_cents)) || !Number.isFinite(Number(s.per_kg_cents)) || !Array.isArray(s.eta_days)) return NextResponse.json({ error: `Bad service in zone ${z}.` }, { status: 400 });
    }
    patch.rates = r;
  }
  const { error } = await g.admin.from("shipping_settings").update(patch).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
