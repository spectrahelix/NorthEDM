import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";
import { isMemberTag, setMemberTag } from "@/utils/memberTags";

// Admin-only: give or take one tag (utils/memberTags.ts — the one
// implementation; Promoter also creates/pauses their promoter row and code).
// POST { userId, tag, value }. `flag` (the old is_* name) is still accepted.
const LEGACY: Record<string, string> = {
  is_marketplace: "merchant", is_promoter: "promoter", is_festdash_vendor: "festdash_vendor", is_vendor: "vendor",
  is_driver: "driver", is_artisan: "artisan", is_forager: "forager", is_founder: "founder",
};

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "");
  const tag = body.tag ?? LEGACY[String(body.flag ?? "")];
  const value = !!body.value;
  if (!userId || !isMemberTag(tag)) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const r = await setMemberTag(g.admin, userId, tag, value);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, tag, value, referral_code: r.referral_code ?? null });
}
