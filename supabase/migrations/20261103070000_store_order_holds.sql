-- Card orders on wallet-rail (Gambian) stores are HELD, not charged, until the
-- shop hands the order over (status 'authorized' → 'paid' at handover). The
-- hold is released if the shop cancels or after six days untouched.
alter table public.store_orders
  add column if not exists authorized_at timestamptz,
  add column if not exists fulfilled_at timestamptz;
