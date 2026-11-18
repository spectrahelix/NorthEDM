import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const page = Math.max(0, Math.floor(Number(req.nextUrl.searchParams.get("page") || "0") || 0));
  const search = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  const groupId = req.nextUrl.searchParams.get("group_id");

  let query = g.admin.from("user_profiles").select("id,display_name,username,role", { count: "exact" })
    .order("display_name").range(page * 100, page * 100 + 99);
  if (search) query = query.ilike("display_name", `%${search.replaceAll("%","\\%").replaceAll("_","\\_")}%`);

  const [groupsResult, membersResult] = await Promise.all([
    g.admin.from("member_groups").select("id,name,description,created_at").order("name"),
    query,
  ]);
  if (groupsResult.error || membersResult.error) return NextResponse.json(
    { error: groupsResult.error?.message || membersResult.error?.message }, { status: 500 }
  );
  const members = membersResult.data ?? [];
  let memberships: string[] = [];
  let assignedCount = 0;
  if (groupId && uuid.test(groupId)) {
    const [part, count] = await Promise.all([
      members.length
        ? g.admin.from("member_group_members").select("member_id").eq("group_id", groupId).in("member_id", members.map(m => m.id))
        : Promise.resolve({ data: [] as {member_id:string}[], error: null }),
      g.admin.from("member_group_members").select("member_id", {count: "exact", head: true}).eq("group_id", groupId),
    ]);
    if (part.error || count.error) return NextResponse.json({ error: part.error?.message || count.error?.message }, { status: 500 });
    memberships = (part.data ?? []).map(row => row.member_id);
    assignedCount = count.count ?? 0;
  }
  return NextResponse.json({
    groups: groupsResult.data ?? [], members, memberships,
    assigned_count: assignedCount, total: membersResult.count ?? 0, page,
  });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "create" || action === "update") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!name || name.length > 100 || description.length > 1000)
      return NextResponse.json({ error: "Group name is required; name max 100 characters and description max 1000." }, { status: 400 });
    if (action === "create") {
      const { data, error } = await g.admin.from("member_groups")
        .insert({ name, description, created_by: g.userId }).select("id").single();
      return error ? NextResponse.json({ error: error.message }, { status: 409 }) : NextResponse.json({ ok: true, id: data.id });
    }
    if (typeof body.id !== "string" || !uuid.test(body.id))
      return NextResponse.json({ error: "Invalid group ID." }, { status: 400 });
    const { error } = await g.admin.from("member_groups")
      .update({ name, description, updated_at: new Date().toISOString() }).eq("id", body.id);
    return error ? NextResponse.json({ error: error.message }, { status: 409 }) : NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (typeof body.id !== "string" || !uuid.test(body.id))
      return NextResponse.json({ error: "Invalid group ID." }, { status: 400 });
    // Deleting a group removes classifications, never users or past messages.
    const { error } = await g.admin.from("member_groups").delete().eq("id", body.id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }

  if (action === "membership") {
    if (typeof body.group_id !== "string" || !uuid.test(body.group_id) ||
        typeof body.member_id !== "string" || !uuid.test(body.member_id) ||
        typeof body.assigned !== "boolean")
      return NextResponse.json({ error: "Invalid membership." }, { status: 400 });
    const result = body.assigned
      ? await g.admin.from("member_group_members")
          .upsert({ group_id: body.group_id, member_id: body.member_id, added_by: g.userId }, { onConflict: "group_id,member_id" })
      : await g.admin.from("member_group_members")
          .delete().eq("group_id", body.group_id).eq("member_id", body.member_id);
    return result.error
      ? NextResponse.json({ error: result.error.message }, { status: 500 })
      : NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
