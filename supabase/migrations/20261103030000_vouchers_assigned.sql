-- Vouchers: a one-time discount code handed to a member. The owner keeps a
-- pool of unassigned one-time codes (20 / 25 / 30 / 50% off) and sends one to
-- a member from /admin/codes; it is emailed and shows on the member's profile
-- until it is used, when it drops out of both views (times_redeemed reaches
-- max_redemptions — nothing is deleted).
alter table public.discount_codes
  add column if not exists assigned_to uuid,
  add column if not exists assigned_at timestamptz,
  add column if not exists sent_at timestamptz;
create index if not exists discount_codes_assigned_idx on public.discount_codes (assigned_to) where assigned_to is not null;
create policy "discount_codes assignee read" on public.discount_codes
  for select to authenticated using (assigned_to = auth.uid());
