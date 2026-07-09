import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

// Admin-only: grant/revoke a role tag flag on a user's profile. Primarily for
// the admin-grantable "Founder" tag; the others are normally set by their own
// approval flows but can be corrected here too. Uses the service-role client so
// it can write the DB-guarded flags.
const ALLOWED = new Set([
  "is_founder",
  "is_vendor",
  "is_marketplace",
  "is_festdash_vendor",
  "is_promoter",
  "is_artisan",
  "is_driver",
  "is_forager",
  "is_verified",
]);

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "");
  const flag = String(body.flag || "");
  const value = !!body.value;
  if (!userId || !ALLOWED.has(flag)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const { error } = await g.admin
    .from("user_profiles")
    .update({ [flag]: value })
    .eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, flag, value });
}
