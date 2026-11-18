import { NextRequest, NextResponse } from "next/server";
import { broadcastGuard } from "@/utils/broadcastGuard";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const g = await broadcastGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  // Pagination is for screen rendering, not a limit on who can receive a broadcast.
  const page = Math.max(0, Math.floor(Number(req.nextUrl.searchParams.get("page") || 0) || 0));
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  let membersQuery = g.admin.from("user_profiles").select("id,display_name,username,role", { count: "exact" })
    .order("display_name").range(page * 100, page * 100 + 99);
  if (q) membersQuery = membersQuery.ilike("display_name", `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);

  const [{ data: members, error: membersError, count }, { data: campaigns, error: campaignsError }, { data: groups, error: groupsError }] = await Promise.all([
    membersQuery,
    g.admin.from("member_broadcasts").select("id,subject,created_at,audience_mode").order("created_at", { ascending: false }).limit(20),
    g.admin.from("member_groups").select("id,name,description").order("name"),
  ]);
  if (membersError || campaignsError || groupsError) return NextResponse.json(
    { error: membersError?.message || campaignsError?.message || groupsError?.message }, { status: 500 }
  );
  const counts = await Promise.all((campaigns ?? []).map(async campaign => {
    const [success, skipped] = await Promise.all([
      g.admin.from("member_broadcast_deliveries").select("recipient_id", { count: "exact", head: true }).eq("broadcast_id", campaign.id).eq("outcome", "delivered"),
      g.admin.from("member_broadcast_deliveries").select("recipient_id", { count: "exact", head: true }).eq("broadcast_id", campaign.id).neq("outcome", "delivered"),
    ]);
    return { ...campaign, delivered: success.count ?? 0, skipped: skipped.count ?? 0 };
  }));
  return NextResponse.json({ members: (members || []).filter(m => m.id !== g.userId), count: count ?? 0, page, groups: groups ?? [], campaigns: counts, canManageGroups: g.canManageGroups, role: g.role });
}

export async function POST(req: Request) {
  const g = await broadcastGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await req.json().catch(() => ({}));
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.body === "string" ? body.body.trim() : "";
  const mode = body.audience_mode;
  const rawRecipients = Array.isArray(body.recipient_ids) ? [...new Set(body.recipient_ids)] : [];
  const rawGroups = Array.isArray(body.group_ids) ? [...new Set(body.group_ids)] : [];
  if (!subject || subject.length > 100 || !message || message.length > 3000)
    return NextResponse.json({ error: "Subject must be 1–100 characters; message 1–3000." }, { status: 400 });
  if (!["selected", "groups", "all"].includes(mode))
    return NextResponse.json({ error: "Choose an audience: selected members, custom groups or all members." }, { status: 400 });
  if (!rawRecipients.every((id): id is string => typeof id === "string" && uuid.test(id) && id !== g.userId) ||
      !rawGroups.every((id): id is string => typeof id === "string" && uuid.test(id)))
    return NextResponse.json({ error: "Invalid member or group ID." }, { status: 400 });
  if (mode === "selected" && !rawRecipients.length)
    return NextResponse.json({ error: "Select members first." }, { status: 400 });
  if (mode === "groups" && !rawGroups.length)
    return NextResponse.json({ error: "Select one or more groups." }, { status: 400 });

  const { data: campaign, error: campaignError } = await g.admin.from("member_broadcasts")
    .insert({
      sender_id: g.userId, subject, body: message, audience_mode: mode,
      audience_group_ids: mode === "groups" ? rawGroups : [],
    }).select("id").single();
  if (campaignError || !campaign) return NextResponse.json({ error: campaignError?.message || "Could not save announcement." }, { status: 500 });

  // A single database operation resolves groups and eligible members without
  // restricting broadcast size or making one remote call for every recipient.
  const { data, error } = await g.admin.rpc("deliver_member_announcement_audience", {
    p_broadcast: campaign.id,
    p_mode: mode,
    p_recipient_ids: mode === "selected" ? rawRecipients : [],
    p_group_ids: mode === "groups" ? rawGroups : [],
  });
  if (error) {
    console.error("Member broadcast failed:", error.message);
    return NextResponse.json({ error: "Broadcast delivery failed. The campaign was saved for audit; no successful publication is claimed.", id: campaign.id }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: campaign.id, results: data });
}
