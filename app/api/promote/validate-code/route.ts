import { NextResponse } from "next/server";
import { resolvePromoterCode, discountCents, adminClient } from "@/utils/promoterCode";

// Public: check a promoter code against a quote and preview the discount, so the
// customer sees "10% off applied" before they're sent to Stripe. The pay route
// re-validates and recomputes server-side — this endpoint is only a preview and
// never sets a price.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  const token = String(body.token || "").trim();
  if (!code || !token) return NextResponse.json({ ok: false, error: "Missing code." }, { status: 400 });

  const promoter = await resolvePromoterCode(code);
  if (!promoter) {
    return NextResponse.json({ ok: false, error: "That code isn't valid." }, { status: 404 });
  }

  const admin = adminClient();
  const { data: quote } = await admin
    .from("service_quotes")
    .select("total_cents, amount_paid_cents, status")
    .eq("token", token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ ok: false, error: "Quote not found." }, { status: 404 });
  if (quote.status === "paid" || quote.amount_paid_cents > 0) {
    return NextResponse.json(
      { ok: false, error: "A code can only be applied before the first payment." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    code: promoter.code,
    promoterName: promoter.displayName,
    discountCents: discountCents(quote.total_cents),
    newTotalCents: quote.total_cents - discountCents(quote.total_cents),
  });
}
