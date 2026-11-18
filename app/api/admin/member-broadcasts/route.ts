import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const [{ data: members, error: membersError }, { data: campaigns, error: campaignsError }] = await Promise.all([
    g.admin.from("user_profiles").select("id,display_name,username,role").order("display_name").limit(500),
    g.admin.from("member_broadcasts").select("id,subject,created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  if (membersError || campaignsError) return NextResponse.json({ error: membersError?.message || campaignsError?.message }, { status: 500 });
  const counts = await Promise.all((campaigns ?? []).map(async campaign => {
    const { data } = await g.admin.from("member_broadcast_deliveries").select("outcome").eq("broadcast_id", campaign.id);
    return { ...campaign, delivered: (data ?? []).filter(x => x.outcome === "delivered").length, skipped: (data ?? []).filter(x => x.outcome !== "delivered").length };
  }));
  return NextResponse.json({ members: (members || []).filter(m => m.id !== g.userId), campaigns: counts });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await req.json().catch(() => ({}));
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.body === "string" ? body.body.trim() : "";
  const recipients = Array.isArray(body.recipient_ids) ? [...new Set(body.recipient_ids)] : [];
  if (!subject || subject.length > 100 || !message || message.length > 3000)
    return NextResponse.json({ error: "Subject must be 1–100 characters; message 1–3000." }, { status: 400 });
  if (!recipients.length || recipients.length > 50 || !recipients.every((id): id is string => typeof id === "string" && uuid.test(id) && id !== g.userId))
    return NextResponse.json({ error: "Select 1–50 other members per broadcast." }, { status: 400 });
  const { data: valid, error: validError } = await g.admin.from("user_profiles").select("id").in("id", recipients);
  if (validError || valid?.length !== recipients.length)
    return NextResponse.json({ error: "Some selected members no longer exist." }, { status: 400 });

  const { data: campaign, error: campaignError } = await g.admin.from("member_broadcasts")
    .insert({ sender_id: g.userId, subject, body: message }).select("id").single();
  if (campaignError || !campaign) return NextResponse.json({ error: campaignError?.message || "Could not save announcement." }, { status: 500 });

  const results: Record<string, number> = { delivered: 0, blocked: 0, opted_out: 0, duplicate: 0, missing: 0, failed: 0 };
  for (const recipient of recipients) {
    const { data, error } = await g.admin.rpc("deliver_member_announcement", { p_broadcast: campaign.id, p_recipient: recipient });
    if (error) { results.failed++; console.error("Member broadcast delivery failed", error.message); }
    else results[String(data)] = (results[String(data)] || 0) + 1;
  }
  return NextResponse.json({ ok: results.failed === 0, id: campaign.id, results });
}
