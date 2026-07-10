import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";
import { runLocalEventsIngest, dedupKey } from "@/utils/localEvents";

// Admin API for the Local Events review screen.
//   GET               → list every event (pending/approved/hidden) for review.
//   POST refresh      → run the ingest now (seed refresh + discovery).
//   POST approve|hide → set an event's status.
//   POST delete       → remove an event.
//   POST create       → manually add an event (auto-approved).

export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const { data, error } = await g.admin
    .from("local_events")
    .select("*")
    .order("start_date", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "refresh") {
    const result = await runLocalEventsIngest(g.admin);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "approve" || action === "hide") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const status = action === "approve" ? "approved" : "hidden";
    const { error } = await g.admin.from("local_events").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status });
  }

  if (action === "delete") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { error } = await g.admin.from("local_events").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "create") {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    const e = {
      name,
      venue: body.venue?.trim() || null,
      city: body.city?.trim() || null,
      region: body.region?.trim() || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      lat: body.lat != null && body.lat !== "" ? Number(body.lat) : null,
      lng: body.lng != null && body.lng !== "" ? Number(body.lng) : null,
      description: body.description?.trim() || null,
      source: "manual" as const,
    };
    const { error } = await g.admin.from("local_events").insert({
      ...e,
      status: "approved",
      dedup_key: dedupKey(e),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
