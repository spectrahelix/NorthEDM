import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { getStripe } from "@/utils/stripe";
import { safeOrigin } from "@/utils/safeRedirect";
import { activePass, loadFeeSettings } from "@/utils/festdashPass";

// GET — the pass options, the service-fee rule, and the caller's running pass.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = serviceClient();
  const [s, pass] = await Promise.all([loadFeeSettings(admin), activePass(admin, user?.id)]);
  return NextResponse.json({ passes: s.festdash_passes, service_fee_bps: s.service_fee_bps, service_fee_min_cents: s.service_fee_min_cents, active: pass, signedIn: !!user });
}

// POST { key } — start a Stripe Checkout for one pass. Activated by the webhook.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to buy a pass." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const admin = serviceClient();
  const s = await loadFeeSettings(admin);
  const opt = s.festdash_passes.find((p) => p.key === body.key);
  if (!opt) return NextResponse.json({ error: "Pick a pass." }, { status: 400 });
  const { data: row, error } = await admin.from("festdash_member_passes").insert({ user_id: user.id, pass_key: opt.key, days: opt.days, price_cents: opt.price_cents }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const origin = safeOrigin(null, req.url);
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    adaptive_pricing: { enabled: true },
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: opt.price_cents, product_data: { name: `FestDash ${opt.label}`, description: `No service fee on FestDash orders for ${opt.days} days` } } }],
    customer_email: user.email ?? undefined,
    success_url: `${origin}/festdash/pass?bought=1`,
    cancel_url: `${origin}/festdash/pass`,
    metadata: { kind: "festdash_pass", pass_id: row.id },
    client_reference_id: row.id,
  });
  await admin.from("festdash_member_passes").update({ stripe_session_id: session.id }).eq("id", row.id);
  return NextResponse.json({ url: session.url });
}
