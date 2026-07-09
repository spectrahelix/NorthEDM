import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { adminGuard } from "@/utils/admin";
import { sendEmail } from "@/utils/email";

// Admin "take the wheel": edit any user's profile fields. Most fields hard-save
// immediately. Changing the email does NOT hard-save — it stores a pending
// email + token and sends a verification link to the NEW address; the email
// only swaps once they confirm (see /api/verify-email).
const PROFILE_FIELDS = [
  "display_name",
  "bio",
  "home_city",
  "pronouns",
  "website",
  "role",
] as const;

const ROLES = ["drifter", "wanderer", "merchant", "warden", "archon", "promoter"];

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const patch = (body.patch || {}) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const f of PROFILE_FIELDS) {
    if (f in patch) {
      if (f === "role" && !ROLES.includes(String(patch.role))) continue;
      update[f] = patch[f];
    }
  }

  if (Object.keys(update).length > 0) {
    const { error } = await g.admin.from("user_profiles").update(update).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Email change → verification flow (does not hard-save yet).
  let emailPending = false;
  const newEmail = String(body.newEmail || "").trim().toLowerCase();
  if (newEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
    const { data: authUser } = await g.admin.auth.admin.getUserById(userId);
    const currentEmail = authUser?.user?.email?.toLowerCase() ?? "";
    if (newEmail !== currentEmail) {
      const token = randomBytes(24).toString("hex");
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24h
      const { error } = await g.admin
        .from("user_profiles")
        .update({ pending_email: newEmail, email_change_token: token, email_change_expires: expires })
        .eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.northedm.com").replace(/\/$/, "");
      const link = `${site}/verify-email?token=${token}`;
      await sendEmail({
        to: newEmail,
        subject: "Confirm your NorthEDM email change",
        html: `<div style="font-family:sans-serif;line-height:1.5">
          <h2>Confirm your email change</h2>
          <p>A NorthEDM administrator updated the email on your account to this address.
          Click below to confirm — your email won't change until you do.</p>
          <p><a href="${link}" style="display:inline-block;background:#39FF14;color:#000;
          padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Confirm email</a></p>
          <p style="color:#666;font-size:13px">Or paste this link: ${link}<br/>This link expires in 24 hours.
          If you didn't expect this, you can ignore it.</p>
        </div>`,
        text: `Confirm your NorthEDM email change: ${link} (expires in 24h)`,
      });
      emailPending = true;
    }
  }

  return NextResponse.json({ ok: true, emailPending });
}
