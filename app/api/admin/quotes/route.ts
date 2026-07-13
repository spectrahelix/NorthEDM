import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminGuard } from "@/utils/admin";

// Admin API for Service Quotes.
//   GET         → promoters (for assignment) + all quotes.
//   POST create → make a quote, return its shareable pay link.

type LineItem = { label: string; amount_cents: number };

export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const [{ data: promoters }, { data: quotes }] = await Promise.all([
    g.admin.from("festdash_promoters").select("user_id, display_name").eq("is_active", true),
    g.admin
      .from("service_quotes")
      .select("id, token, title, client_name, client_email, total_cents, deposit_cents, monthly_cents, promoter_user_id, commission_bps, status, amount_paid_cents, promoter_paid_cents, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const nameByUser = new Map((promoters ?? []).map((p) => [p.user_id, p.display_name]));
  const withNames = (quotes ?? []).map((q) => ({ ...q, promoter_name: q.promoter_user_id ? nameByUser.get(q.promoter_user_id) || "—" : null }));

  return NextResponse.json({ promoters: promoters ?? [], quotes: withNames });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const rawItems: LineItem[] = Array.isArray(body.lineItems) ? body.lineItems : [];
  const lineItems = rawItems
    .map((i) => ({ label: String(i.label || "").trim().slice(0, 120), amount_cents: Math.max(0, Math.round(Number(i.amount_cents) || 0)) }))
    .filter((i) => i.label && i.amount_cents > 0);
  if (lineItems.length === 0) return NextResponse.json({ error: "Add at least one line item." }, { status: 400 });

  const total = lineItems.reduce((s, i) => s + i.amount_cents, 0);
  const depositCents = Math.max(0, Math.min(total, Math.round(Number(body.depositCents) || 0)));
  const monthlyCents = Math.max(0, Math.round(Number(body.monthlyCents) || 0));
  const commissionBps = Math.max(0, Math.min(5000, Math.round(Number(body.commissionBps) || 1000)));
  const promoterUserId = body.promoterUserId ? String(body.promoterUserId) : null;
  const token = randomUUID().replace(/-/g, "");

  const { data, error } = await g.admin
    .from("service_quotes")
    .insert({
      token,
      title,
      client_name: body.clientName ? String(body.clientName).trim() : null,
      client_email: body.clientEmail ? String(body.clientEmail).trim() : null,
      line_items: lineItems,
      total_cents: total,
      deposit_cents: depositCents,
      monthly_cents: monthlyCents,
      commission_bps: commissionBps,
      promoter_user_id: promoterUserId,
    })
    .select("token")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  return NextResponse.json({ ok: true, token: data.token, payUrl: `${origin}/quote/${data.token}` });
}
