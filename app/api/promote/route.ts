import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
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
  const { data: { user } } = await supabase.auth.getUser();

  const body = await req.json();
  const { displayName, email, phone, audience, promoteVendor, why } = body;

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
    },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await notifyNewApplication({
    kind: "promoter",
    name: displayName,
    email: String(email).toLowerCase().trim(),
    detail: [
      phone ? `Phone: ${phone}` : "",
      audience ? `Audience: ${audience}` : "",
      promoteVendor ? `Wants to promote: ${promoteVendor}` : "",
      why ? `Why: ${why}` : "",
    ].filter(Boolean).join("\n"),
  });

  return NextResponse.json({ success: true });
}
