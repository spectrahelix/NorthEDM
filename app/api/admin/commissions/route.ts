import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { releaseCommission } from "@/utils/commissions";

// Admin view of promoter commissions: what's owed, what's released, what's stuck.
// GET returns the reserve totals + recent rows. POST releases a single commission
// that is already past its protection window — the DB trigger rejects anything
// early, so this can never shortcut refund protection.
export const dynamic = "force-dynamic";

const OWNER_EMAIL = "cjblue27@gmail.com";

async function guard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: profile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.role === "archon" || profile?.role === "warden" || user.email === OWNER_EMAIL;
  if (!isAdmin) return { ok: false as const, status: 403 };
  return {
    ok: true as const,
    admin: createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    ),
  };
}

export async function GET() {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "Forbidden" }, { status: g.status });

  const [{ data: reserve }, { data: rows }] = await Promise.all([
    g.admin.rpc("commission_reserve"),
    g.admin
      .from("commissions")
      .select("id, promoter_user_id, source_type, source_id, base_cents, amount_cents, status, payable_after, released_at, reversed_at, reversal_reason, hold_days, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // Attach promoter names + whether they can actually be paid yet.
  const ids = [...new Set((rows ?? []).map((r) => r.promoter_user_id))];
  const { data: promoters } = ids.length
    ? await g.admin.from("festdash_promoters")
        .select("user_id, display_name, stripe_account_id, payout_method, paypal_email").in("user_id", ids)
    : { data: [] };
  const byUser = new Map((promoters ?? []).map((p) => [p.user_id, p]));

  return NextResponse.json({
    reserve: reserve ?? null,
    commissions: (rows ?? []).map((r) => {
      const p = byUser.get(r.promoter_user_id);
      const method = p?.payout_method === "paypal" ? "paypal" : "stripe";
      return {
        ...r,
        promoter_name: p?.display_name ?? null,
        payout_method: method,
        payout_ready: method === "paypal" ? !!p?.paypal_email : !!p?.stripe_account_id,
      };
    }),
  });
}

export async function POST(req: Request) {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "Forbidden" }, { status: g.status });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const { data: c } = await g.admin
    .from("commissions")
    .select("id, promoter_user_id, amount_cents, source_type, source_id, status, payable_after")
    .eq("id", id)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (c.status !== "held") return NextResponse.json({ error: `Already ${c.status}.` }, { status: 400 });

  // Belt and braces: refuse early here too, even though the DB trigger would.
  if (!c.payable_after || new Date(c.payable_after) > new Date()) {
    return NextResponse.json(
      { error: `Refund-protection window is still open until ${c.payable_after}. It cannot be released early.` },
      { status: 400 }
    );
  }

  const res = await releaseCommission(g.admin, c);
  if (!res.ok) return NextResponse.json({ error: res.reason }, { status: 400 });
  return NextResponse.json({ ok: true });
}
