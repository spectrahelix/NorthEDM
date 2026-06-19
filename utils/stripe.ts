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

// FestDash platform fee, in basis points (500 = 5%). Easy to change.
export const PLATFORM_FEE_BPS = 500;

export function platformFeeCents(totalCents: number): number {
  return Math.round((totalCents * PLATFORM_FEE_BPS) / 10000);
}
