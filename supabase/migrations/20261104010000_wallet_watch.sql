-- Wallet-payment guards: when the customer gave a reference, whether they
-- reported a payment that was never confirmed, whether the owner was alerted
-- about a stale one, and when the owner closed it.
alter table public.festdash_orders
  add column if not exists payment_ref_at timestamptz,
  add column if not exists payment_disputed_at timestamptz,
  add column if not exists payment_dispute_note text,
  add column if not exists payment_escalated_at timestamptz,
  add column if not exists payment_watch_resolved_at timestamptz;
alter table public.store_orders
  add column if not exists payment_ref_at timestamptz,
  add column if not exists payment_disputed_at timestamptz,
  add column if not exists payment_dispute_note text,
  add column if not exists payment_escalated_at timestamptz,
  add column if not exists payment_watch_resolved_at timestamptz;
