import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

type Status = "draft" | "approved" | "scheduled" | "handoff" | "published" | "failed" | "archived";
const statuses = new Set<Status>(["draft", "approved", "scheduled", "handoff", "published", "failed", "archived"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePost(body: Record<string, unknown>) {
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 150) : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  const image = typeof body.image_url === "string" ? body.image_url.trim() : "";
  const planned = typeof body.planned_for === "string" ? body.planned_for.trim() : "";
  const accountIds = Array.isArray(body.account_ids)
    ? [...new Set(body.account_ids.filter((id): id is string => typeof id === "string" && uuid.test(id)))].slice(0, 30)
    : [];
  if (!caption || caption.length > 5000) return { error: "Caption must be 1–5000 characters." };
  if (image && (!/^https:\/\//i.test(image) || image.length > 2048)) return { error: "Image must be an HTTPS URL under 2048 characters." };
  if (planned && !Number.isFinite(Date.parse(planned))) return { error: "Enter a valid schedule date." };
  return { value: { caption, title, notes, image_url: image || null, account_ids: accountIds, planned_for: planned ? new Date(planned).toISOString() : null } };
}

export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const [{ data: posts, error }, { data: accounts }] = await Promise.all([
    g.admin.from("social_post_queue").select("*").order("created_at", { ascending: false }).limit(100),
    g.admin.from("social_accounts").select("id,platform,label,url,active").order("created_at", { ascending: true }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: posts ?? [], accounts: accounts ?? [] });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  const action = body.action;
  if (action === "create" || action === "edit") {
    const parsed = parsePost(body);
    if (parsed.error || !parsed.value) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { value } = parsed;
    if (value.account_ids.length) {
      const { data, error } = await g.admin.from("social_accounts").select("id").in("id", value.account_ids);
      if (error || data?.length !== value.account_ids.length) return NextResponse.json({ error: "One or more target accounts were not found." }, { status: 400 });
    }
    if (action === "create") {
      const { data, error } = await g.admin.from("social_post_queue").insert({ ...value, author_id: g.userId }).select("*").single();
      return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ post: data });
    }
    if (typeof body.id !== "string" || !uuid.test(body.id)) return NextResponse.json({ error: "Invalid post ID." }, { status: 400 });
    const { data: current } = await g.admin.from("social_post_queue").select("status").eq("id", body.id).maybeSingle();
    if (!current || !["draft", "approved", "scheduled"].includes(current.status)) return NextResponse.json({ error: "Only drafts, approved, or scheduled posts can be edited." }, { status: 409 });
    const { error } = await g.admin.from("social_post_queue").update({ ...value, status: "draft", approved_at: null, updated_at: new Date().toISOString() }).eq("id", body.id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (action === "status") {
    if (typeof body.id !== "string" || !uuid.test(body.id) || typeof body.status !== "string" || !statuses.has(body.status as Status))
      return NextResponse.json({ error: "Invalid post ID or status." }, { status: 400 });
    const status = body.status as Status;
    const { data: current } = await g.admin.from("social_post_queue").select("status,planned_for,account_ids").eq("id", body.id).maybeSingle();
    if (!current) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    const transitions: Record<Status, Status[]> = {
      draft: ["approved", "scheduled", "archived"], approved: ["draft", "scheduled", "handoff", "archived"],
      scheduled: ["draft", "approved", "handoff", "archived"], handoff: ["published", "failed", "draft"],
      published: ["archived"], failed: ["draft", "handoff", "archived"], archived: ["draft"],
    };
    if (!transitions[current.status as Status]?.includes(status)) return NextResponse.json({ error: "Invalid status transition." }, { status: 409 });
    if (status === "scheduled" && !current.planned_for) return NextResponse.json({ error: "Set a publish date first." }, { status: 400 });
    if (["approved", "scheduled", "handoff"].includes(status) && !current.account_ids?.length) return NextResponse.json({ error: "Select at least one account before approval." }, { status: 400 });
    // A published flag means the admin confirmed an external publish; the app never claims to publish itself.
    const changes: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "approved" || status === "scheduled") changes.approved_at = new Date().toISOString();
    if (status === "published") changes.published_at = new Date().toISOString();
    if (status === "draft") { changes.approved_at = null; changes.published_at = null; }
    const { error } = await g.admin.from("social_post_queue").update(changes).eq("id", body.id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
