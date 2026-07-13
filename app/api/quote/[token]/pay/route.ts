import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";

// Client pays a quote (deposit or the remaining balance) via Stripe Checkout.
// The webhook records payment + pays the referring promoter their commission.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const mode = (await req.json().catch(() => ({}))).mode === "deposit" ? "deposit" : "full";

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: quote } = await admin
    .from("service_quotes")
    .select("id, token, title, total_cents, deposit_cents, amount_paid_cents, client_email, status")
    .eq("token", token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  if (quote.status === "paid") return NextResponse.json({ error: "This quote is already paid in full." }, { status: 400 });

  const remaining = quote.total_cents - quote.amount_paid_cents;
  let amount = remaining;
  if (mode === "deposit" && quote.deposit_cents > 0 && quote.amount_paid_cents === 0) {
    amount = quote.deposit_cents;
  }
  if (amount < 50) return NextResponse.json({ error: "Nothing left to pay." }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: {
            name: quote.title,
            description: amount === quote.total_cents ? "Paid in full" : (mode === "deposit" ? "Deposit" : "Balance"),
          },
        },
      },
    ],
    customer_email: quote.client_email ?? undefined,
    success_url: `${origin}/quote/${quote.token}?paid=1`,
    cancel_url: `${origin}/quote/${quote.token}`,
    metadata: { quote_id: quote.id, kind: "service_quote", portion: String(amount) },
    client_reference_id: quote.id,
  });

  await admin.from("service_quotes").update({ stripe_session_id: session.id, updated_at: new Date().toISOString() }).eq("id", quote.id);
  return NextResponse.json({ url: session.url });
}
