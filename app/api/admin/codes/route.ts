import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, isSiteAdminUser } from "@/utils/coordinator";
import { emailUser, notifyUserInApp, userEmailById } from "@/utils/notifyEmail";
import { makeReferralCode } from "@/utils/promoters";

// Owner's discounts & vouchers: the pool of one-time codes, sending one to a
// member (email + their profile), custom codes, and everything promoters mint.
async function guard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const admin = serviceClient();
  if (!(await isSiteAdminUser(admin, user))) return { ok: false as const, status: 403 };
  return { ok: true as const, admin, user };
}
const voucherCode = () => `NE-${makeReferralCode().slice(0, 4)}-${makeReferralCode().slice(0, 4)}`;

async function mintPool(admin: ReturnType<typeof serviceClient>, percent: number, count: number) {
  const rows = Array.from({ length: count }, () => ({ code: voucherCode(), percent_off: percent, max_redemptions: 1, note: "voucher" }));
  const { data, error } = await admin.from("discount_codes").insert(rows).select("id, code");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function GET() {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "Forbidden" }, { status: g.status });
  const { data } = await g.admin.from("discount_codes").select("*").order("created_at", { ascending: false }).limit(1000);
  const ids = [...new Set((data ?? []).flatMap((r) => [r.minted_by, r.assigned_to, r.last_redeemed_by]).filter(Boolean))] as string[];
  const { data: names } = ids.length ? await g.admin.from("user_profiles").select("id, display_name, username").in("id", ids) : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.display_name || n.username || n.id.slice(0, 8)]));
  const codes = (data ?? []).map((r) => ({
    ...r,
    minted_by_name: r.minted_by ? nameOf.get(r.minted_by) ?? null : null,
    assigned_to_name: r.assigned_to ? nameOf.get(r.assigned_to) ?? null : null,
    used: r.max_redemptions != null && Number(r.times_redeemed) >= Number(r.max_redemptions),
  }));
  // The pool: owner-made one-time codes nobody has been given yet.
  const pool: Record<string, number> = {};
  for (const c of codes) if (!c.minted_by && c.max_redemptions === 1 && !c.assigned_to && c.active && !c.used && c.percent_off != null) pool[c.percent_off] = (pool[c.percent_off] ?? 0) + 1;
  return NextResponse.json({ codes, pool });
}

export async function POST(req: Request) {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "Forbidden" }, { status: g.status });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "toggle") {
      const { data, error } = await g.admin.from("discount_codes").update({ active: !!body.active }).eq("id", String(body.id)).select("id, active").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ code: data });
    }
    if (body.action === "mint_batch") {
      const percent = Math.round(Number(body.percentOff)), count = Math.min(200, Math.max(1, Math.round(Number(body.count) || 10)));
      if (!(percent >= 1 && percent <= 100)) return NextResponse.json({ error: "Percent must be 1–100." }, { status: 400 });
      const made = await mintPool(g.admin, percent, count);
      return NextResponse.json({ minted: made.length });
    }
    if (body.action === "send") {
      const userId = String(body.userId ?? ""), percent = Math.round(Number(body.percentOff));
      if (!userId || !(percent >= 1 && percent <= 100)) return NextResponse.json({ error: "Pick a member and a voucher." }, { status: 400 });
      const { data: member } = await g.admin.from("user_profiles").select("id, display_name, username").eq("id", userId).maybeSingle();
      if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
      // Take one from the pool, or mint one on the spot.
      let { data: free } = await g.admin.from("discount_codes").select("id, code")
        .is("minted_by", null).is("assigned_to", null).eq("max_redemptions", 1).eq("active", true).eq("times_redeemed", 0).eq("percent_off", percent)
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (!free) free = (await mintPool(g.admin, percent, 1))[0] ?? null;
      if (!free) throw new Error("Couldn't get a voucher.");
      const now = new Date().toISOString();
      const { data: claimed } = await g.admin.from("discount_codes")
        .update({ assigned_to: userId, assigned_at: now, note: `voucher · ${member.display_name || member.username || "member"}` })
        .eq("id", free.id).is("assigned_to", null).select("id, code").maybeSingle();
      if (!claimed) throw new Error("That voucher was just taken — try again.");
      const to = await userEmailById(g.admin, userId);
      const r = await emailUser(to, `A ${percent}% voucher from NorthEDM`, {
        heading: `${percent}% off, on us`,
        intro: `Here's a one-time voucher for ${percent}% off your first month of any NorthEDM plan — a FestDash listing, your own online store, or the bundle of both. Enter it in the code box when you subscribe. It's also saved on your profile until you use it.`,
        rows: [["Your voucher", claimed.code], ["Good for", `${percent}% off the first month · one use`]],
        cta: { label: "See it on your profile", path: "/profile/edit" },
        outro: "Plans: FestDash listing $30/month · online store $30/month · both together $45/month. Nothing is charged until you choose one.",
      });
      await notifyUserInApp(g.admin, userId, "voucher", `You've been sent a ${percent}% voucher: ${claimed.code}. It's on your profile.`, "/profile/edit");
      if (r.ok) await g.admin.from("discount_codes").update({ sent_at: now }).eq("id", claimed.id);
      return NextResponse.json({ code: claimed.code, emailed: r.ok, email_error: r.ok ? null : r.error });
    }
    // Custom code
    const code = String(body.code ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
    if (code.length < 3) return NextResponse.json({ error: "Code needs at least 3 letters or numbers." }, { status: 400 });
    const pct = Math.round(Number(body.percentOff)), amt = Math.round(Number(body.amountOff) * 100);
    const row: Record<string, unknown> = { code, note: typeof body.note === "string" ? body.note.trim().slice(0, 160) || null : null };
    if (Number.isFinite(pct) && pct > 0) row.percent_off = Math.min(100, pct);
    else if (Number.isFinite(amt) && amt > 0) row.amount_off_cents = amt;
    else return NextResponse.json({ error: "Enter a percent or a dollar amount off." }, { status: 400 });
    row.max_redemptions = body.oneTime ? 1 : Number.isFinite(Number(body.maxRedemptions)) && Number(body.maxRedemptions) > 0 ? Math.round(Number(body.maxRedemptions)) : null;
    if (typeof body.expiresAt === "string" && body.expiresAt) row.expires_at = new Date(body.expiresAt).toISOString();
    const { data, error } = await g.admin.from("discount_codes").insert(row).select("*").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "That code already exists." : error.message }, { status: 400 });
    return NextResponse.json({ code: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}
