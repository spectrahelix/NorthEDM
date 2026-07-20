import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";
import { RESERVED_SLUGS } from "@/utils/store";

// Host admin (CJ): create embedded stores + assign an operator.
export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const { data: stores } = await g.admin
    .from("stores")
    .select("id, slug, name, tagline, owner_user_id, accent_color, operator_fee_bps, active, created_at")
    .order("created_at", { ascending: false });

  // Attach owner emails + member counts.
  const ownerIds = [...new Set((stores ?? []).map((s) => s.owner_user_id))];
  const emailByOwner = new Map<string, string>();
  for (const id of ownerIds) {
    const { data } = await g.admin.auth.admin.getUserById(id);
    if (data?.user?.email) emailByOwner.set(id, data.user.email);
  }
  const withOwner = (stores ?? []).map((s) => ({ ...s, owner_email: emailByOwner.get(s.owner_user_id) || null }));
  return NextResponse.json({ stores: withOwner });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const ownerEmail = String(body.ownerEmail || "").trim().toLowerCase();

  if (!name) return NextResponse.json({ error: "Store name is required." }, { status: 400 });
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) {
    return NextResponse.json({ error: "Slug must be lowercase letters, numbers, and hyphens." }, { status: 400 });
  }
  if (RESERVED_SLUGS.has(slug)) {
    return NextResponse.json({ error: `"${slug}" is reserved — pick another slug.` }, { status: 400 });
  }
  if (!ownerEmail) return NextResponse.json({ error: "Owner email is required." }, { status: 400 });

  // Resolve owner by email.
  const { data: list } = await g.admin.auth.admin.listUsers({ perPage: 1000 });
  const owner = list?.users?.find((u) => u.email?.toLowerCase() === ownerEmail);
  if (!owner) return NextResponse.json({ error: `No account found for ${ownerEmail}.` }, { status: 404 });

  const { error } = await g.admin.from("stores").insert({
    slug,
    name,
    tagline: body.tagline ? String(body.tagline).trim() : null,
    owner_user_id: owner.id,
    accent_color: /^#[0-9a-fA-F]{6}$/.test(String(body.accentColor)) ? body.accentColor : "#39FF14",
    operator_fee_bps: Math.max(0, Math.min(5000, Math.round(Number(body.operatorFeeBps) || 0))),
  });
  if (error) {
    const msg = /duplicate/i.test(error.message) ? "That slug is already taken." : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: `/${slug}` });
}
