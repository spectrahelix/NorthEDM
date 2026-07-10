-- FestDash escrow: track the Stripe Checkout session that authorizes each order.
-- The order's card is authorized (held) at checkout and captured on confirmed
-- delivery; stripe_payment_intent + payment_status + escrow_released_at already
-- exist on festdash_orders, this just adds the session handle used to promote an
-- order from "awaiting_payment" to "pending" once the hold is in place.
alter table public.festdash_orders
  add column if not exists stripe_checkout_session text;

-- payment_status lifecycle (text, no constraint so it stays flexible):
--   unpaid → awaiting_payment → authorized → released   (happy path)
--   authorized → canceled                                (declined/cancelled)
--   paid_credit                                          (fully store-credit)
create index if not exists festdash_orders_payment_status_idx
  on public.festdash_orders (payment_status);
