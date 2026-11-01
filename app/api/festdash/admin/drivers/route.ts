import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

// Runners register themselves at /festdash/driver but start INACTIVE. Only
// this route (service role) can switch one on; the database trigger
// protect_runner_activation ignores is_active on every end-user write.
export async function PATCH(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const isActive = body.isActive;
  if (!id || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "id and isActive are required." }, { status: 400 });
  }

  const { data: current } = await g.admin
    .from("festdash_drivers")
    .select("id, approved_at")
    .eq("id", id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "Runner not found." }, { status: 404 });

  const { data, error } = await g.admin
    .from("festdash_drivers")
    .update({
      is_active: isActive,
      approved_at: isActive ? (current.approved_at ?? new Date().toISOString()) : current.approved_at,
    })
    .eq("id", id)
    .select("id, is_active, approved_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ runner: data });
}
