import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";
import { broadcast, connectorStatus } from "@/utils/socialConnectors";

// Admin: broadcast one post to every configured social connector. Logs the
// post + per-destination result to social_posts.
export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : undefined;
  if (!text) return NextResponse.json({ error: "Write something to post." }, { status: 400 });

  const anyConfigured = connectorStatus().some((c) => c.configured);
  if (!anyConfigured) {
    return NextResponse.json({ error: "No social connectors are configured yet. Add one in your env (Buffer / Discord / Telegram / Mastodon)." }, { status: 400 });
  }

  const results = await broadcast(text, imageUrl);
  await g.admin.from("social_posts").insert({
    author_id: g.userId,
    text,
    image_url: imageUrl ?? null,
    results,
  });

  return NextResponse.json({ ok: true, results });
}
