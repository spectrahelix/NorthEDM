import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { canEditRanks } from "@/utils/ranks";
import { isMemberTag, setMemberTag } from "@/utils/memberTags";
import { MODERATOR_TAGS } from "@/app/components/roleColors";

// Tags from a profile page (owner, 2026-11-05: Merchant and Promoter are tags
// anyone can hold). Archons and wardens change anyone's (a warden not an
// archon's); site moderators give/take Merchant and Promoter on non-admins.
// Only an archon makes someone a moderator. Service role: the database ignores
// these columns on every ordinary session (protect_role_flags).
//
// POST { userId, tag, value }        → give / take one tag
// POST { userId, moderator: boolean } → archon only
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const admin = serviceClient();
  const [{ data: editor }, { data: target }] = await Promise.all([
    admin.from("user_profiles").select("id, role, extra_ranks, is_site_moderator").eq("id", user.id).maybeSingle(),
    admin.from("user_profiles").select("id, role, extra_ranks").eq("id", userId).maybeSingle(),
  ]);
  if (!target) return NextResponse.json({ error: "No such member." }, { status: 404 });

  if (typeof body.moderator === "boolean") {
    if (editor?.role !== "archon") return NextResponse.json({ error: "Only an Archon can make someone a moderator." }, { status: 403 });
    const { error } = await admin.from("user_profiles").update({ is_site_moderator: body.moderator }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, is_site_moderator: body.moderator });
  }

  const tag = body.tag;
  if (!isMemberTag(tag)) return NextResponse.json({ error: "Unknown tag." }, { status: 400 });
  if (!canEditRanks(editor, target)) return NextResponse.json({ error: "You can't change this member's tags." }, { status: 403 });
  const isAdminEditor = editor?.role === "archon" || editor?.role === "warden";
  if (!isAdminEditor && !MODERATOR_TAGS.includes(tag)) return NextResponse.json({ error: "Moderators give Merchant and Promoter only." }, { status: 403 });
  const r = await setMemberTag(admin, userId, tag, !!body.value);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, tag, value: !!body.value, referral_code: r.referral_code ?? null });
}
