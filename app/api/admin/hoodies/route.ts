import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminGuard } from "@/utils/admin";

// Admin API for Promoter Hoodies.
//   GET            → list promoters (to assign) + all hoodies with stats.
//   POST mint      → create N hoodies for a promoter (unique codes).
//   POST toggle    → activate / deactivate a hoodie.
//   POST setPct    → change a hoodie's discount %.

function newCode() {
  return `HF-${randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase()}`;
}

export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const [{ data: promoters }, { data: hoodies }, { data: settings }] = await Promise.all([
    g.admin.from("festdash_promoters").select("user_id, display_name, is_active").eq("is_active", true),
    g.admin
      .from("promoter_hoodies")
      .select("id, code, promoter_user_id, label, percent_off, active, scans, redemptions, earned_cents, created_at")
      .order("created_at", { ascending: false }),
    g.admin.from("promoter_program_settings").select("payout_mode, first_order_only").eq("id", 1).maybeSingle(),
  ]);

  // Attach promoter display names to hoodies.
  const nameByUser = new Map((promoters ?? []).map((p) => [p.user_id, p.display_name]));
  const withNames = (hoodies ?? []).map((h) => ({
    ...h,
    promoter_name: nameByUser.get(h.promoter_user_id) || "—",
  }));

  return NextResponse.json({
    promoters: promoters ?? [],
    hoodies: withNames,
    settings: settings ?? { payout_mode: "cash", first_order_only: true },
  });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "mint") {
    const promoterUserId = String(body.promoterUserId || "");
    const percentOff = Math.max(1, Math.min(90, Math.floor(Number(body.percentOff) || 10)));
    const quantity = Math.max(1, Math.min(200, Math.floor(Number(body.quantity) || 1)));
    const labelPrefix = String(body.labelPrefix || "").trim().slice(0, 40);
    if (!promoterUserId) return NextResponse.json({ error: "Pick a promoter." }, { status: 400 });

    const rows = [];
    for (let i = 0; i < quantity; i++) {
      rows.push({
        promoter_user_id: promoterUserId,
        code: newCode(),
        percent_off: percentOff,
        label: labelPrefix ? `${labelPrefix} #${String(i + 1).padStart(3, "0")}` : null,
      });
    }
    const { data, error } = await g.admin.from("promoter_hoodies").insert(rows).select("code, label");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, created: data ?? [] });
  }

  if (action === "toggle") {
    const id = String(body.id || "");
    const active = !!body.active;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { error } = await g.admin.from("promoter_hoodies").update({ active }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "settings") {
    const payoutMode = body.payoutMode === "credit" ? "credit" : "cash";
    const firstOrderOnly = !!body.firstOrderOnly;
    const { error } = await g.admin
      .from("promoter_program_settings")
      .update({ payout_mode: payoutMode, first_order_only: firstOrderOnly, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "setPct") {
    const id = String(body.id || "");
    const percentOff = Math.max(1, Math.min(90, Math.floor(Number(body.percentOff) || 10)));
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { error } = await g.admin.from("promoter_hoodies").update({ percent_off: percentOff }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
