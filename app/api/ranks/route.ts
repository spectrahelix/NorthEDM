import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { canEditRanks, EXTRA_RANKS, type ExtraRank } from "@/utils/ranks";
import { grantPromoter } from "@/utils/promoters";

// Extra ranks (utils/ranks.ts). Archons and wardens change anyone's (a warden
// not an archon's); site moderators change non-admins'. Only an archon makes
// someone a moderator. Writes use the service role — the database ignores
// these columns on every ordinary session (protect_role_flags).
//
// POST { userId, extraRanks: string[] }  → set the extra ranks
// POST { userId, moderator: boolean }    → archon only
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
    admin.from("user_profiles").select("id, role, extra_ranks, is_promoter").eq("id", userId).maybeSingle(),
  ]);
  if (!target) return NextResponse.json({ error: "No such member." }, { status: 404 });

  if (typeof body.moderator === "boolean") {
    if (editor?.role !== "archon") return NextResponse.json({ error: "Only an Archon can make someone a moderator." }, { status: 403 });
    const { error } = await admin.from("user_profiles").update({ is_site_moderator: body.moderator }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, is_site_moderator: body.moderator });
  }

  if (!Array.isArray(body.extraRanks)) return NextResponse.json({ error: "extraRanks must be a list." }, { status: 400 });
  if (!canEditRanks(editor, target)) return NextResponse.json({ error: "You can't change this member's ranks." }, { status: 403 });
  const wanted: string[] = [...new Set((body.extraRanks as unknown[]).map((r) => String(r)))];
  const bad = wanted.filter((r) => !(EXTRA_RANKS as readonly string[]).includes(r));
  if (bad.length) return NextResponse.json({ error: `Not an extra rank: ${bad.join(", ")}. Admin ranks are set as the main rank only.` }, { status: 400 });
  const extras = (wanted as ExtraRank[]).filter((r) => r !== target.role);
  const { error } = await admin.from("user_profiles").update({ extra_ranks: extras }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // The Promoter rank needs a promoter row and referral code behind it, the
  // same as the Promoter tag (utils/promoters.ts). Removing the rank leaves the
  // tag and code alone; revoke those from the tag if that is meant.
  let referral_code: string | null = null;
  if (extras.includes("promoter") && !target.is_promoter) {
    ({ referral_code } = await grantPromoter(admin, userId));
  }
  return NextResponse.json({ ok: true, extra_ranks: extras, referral_code });
}
