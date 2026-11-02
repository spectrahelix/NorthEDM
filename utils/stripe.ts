import Stripe from "stripe";

// Lazy singleton so `next build` doesn't instantiate (and throw) without the key.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// FestDash's share of a card order, taken as the Stripe application fee on the
// destination charge. The percentage is deliberately NOT a constant here: it is
// the owner's share plus the coordinator's share from
// `coordinator_program_settings` (platformShareBps in utils/gambiaPay.ts) —
// the same two numbers that split a wallet sale, 80 / 10 / 10 by default.
export function platformFeeCents(totalCents: number, bps: number): number {
  return Math.round((totalCents * bps) / 10000);
}
