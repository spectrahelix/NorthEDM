import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

// Admin-only: approve or reject an artisan verification. Uses the service-role
// client (via adminGuard) so it can flip `is_artisan`, which the DB trigger
// blocks for everyone else.
export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "");
  const action = String(body.action || "");
  if (!userId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const patch =
    action === "approve"
      ? { is_artisan: true, artisan_status: "approved" }
      : { is_artisan: false, artisan_status: "none" };

  const { error } = await g.admin.from("user_profiles").update(patch).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
