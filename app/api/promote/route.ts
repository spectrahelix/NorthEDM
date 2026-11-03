import { shieldForm } from "@/utils/botSignals";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireVerifiedUser } from "@/utils/authGate";
import { resolveCode } from "@/utils/discountCodes";
import { serviceClient as admin } from "@/utils/coordinator";
import { notifyNewApplication } from "@/utils/alerts";

// Promoter applications. This handler lived at /api/festdash/promoter-signup
// until the promoter program moved site-wide to /promote. The page moved and
// started POSTing to /api/promote, but the route didn't come with it — so every
// application since then hit the HTML catch-all, `res.json()` threw on the HTML
// body, and the submit button hung on "Submitting…" forever with no error and
// nothing written. The one path into the entire commission pipeline was dead.
//
// Keep this colocated with /promote. The field names below are the form's, so
// the two move together.
export async function POST(req: Request) {
  const supabase = await createClient();

  // Verified accounts only — the matching RLS policy enforces this too.
  const gate = await requireVerifiedUser(supabase);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }
  const { data: { user } } = await supabase.auth.getUser();

  const body = await req.json();
  const shield = await shieldForm(req, body, "promote-apply");
  if (shield.verdict !== "ok") return shield.response;
  const { displayName, email, phone, audience, promoteVendor, why, inviteCode } = body;
  // Who brought them in: a promoter's referral code or a code that promoter minted.
  const invite = await resolveCode(admin(), typeof inviteCode === "string" ? inviteCode : null, 1000);
  const invitedBy = invite?.promoter_user_id ?? null;

  if (!displayName || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  const { error } = await supabase.from("festdash_promoter_applications").insert([
    {
      display_name: displayName,
      email: String(email).toLowerCase().trim(),
      phone: phone || null,
      audience: audience || null,
      promote_vendor: promoteVendor || null,
      why: why || null,
      user_id: user?.id ?? null,
      status: "pending",
      invite_code: invite?.code ?? null,
      invited_by: invitedBy,
    },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await notifyNewApplication({
    kind: "promoter",
    name: displayName,
    email: String(email).toLowerCase().trim(),
    fields: [
      ["Name", displayName],
      ["Email", String(email).toLowerCase().trim()],
      ["Phone", phone || null],
      ["Audience", audience || null],
      ["Wants to promote", promoteVendor || null],
      ["Why", why || null],
      ["Invite code", invite ? `${invite.code}${invitedBy ? " (minted by a promoter — see the card)" : ""}` : null],
    ],
  });

await shield.record();
    return NextResponse.json({ success: true });
}
