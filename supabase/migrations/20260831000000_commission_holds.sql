-- Refund-protected promoter commissions.
--
-- THE MODEL: a commission is NOT paid at sale time. It is recorded as an unpaid
-- obligation ("held") for a protection window, and only transferred once that
-- window closes. This is deliberate:
--
--   * Refund protection is bulletproof — during the window no money has moved, so
--     a refund simply VOIDS the obligation. There is nothing to claw back, and
--     clawing back (transfer reversal) is the fragile path that can fail if the
--     recipient already withdrew. Reversal remains only as a backstop for the
--     rare already-released case.
--   * NorthEDM is NOT holding anyone's money. The funds are NorthEDM's own revenue
--     from the sale; the promoter has an unvested claim, i.e. accounts payable.
--     That is categorically different from custodying customer funds, which is
--     what raises money-transmitter exposure. See docs/WALLET.md.
--   * Nobody can pull it early. release_guard() below rejects any attempt to mark
--     a commission released before payable_after — enforced in the DATABASE, so a
--     bug, a bad admin action, or a direct query cannot bypass it.

alter table public.commissions
  add column if not exists payable_after     timestamptz,
  add column if not exists released_at       timestamptz,
  add column if not exists reversed_at       timestamptz,
  add column if not exists reversal_reason   text,
  add column if not exists stripe_transfer_id text,
  add column if not exists payout_method     text,          -- stripe | paypal
  add column if not exists hold_days         int not null default 30;

create index if not exists commissions_release_idx
  on public.commissions (status, payable_after);

-- Per-action protection window. 30 days is the common affiliate norm and covers
-- ordinary refund requests; card disputes can arrive later, which is what the
-- reversal backstop is for.
alter table public.commission_rates
  add column if not exists hold_days int not null default 30;

-- Hard guard: a commission can never be marked released before its window closes.
create or replace function public.commission_release_guard()
returns trigger language plpgsql as $$
begin
  if new.released_at is not null and old.released_at is null then
    if new.payable_after is null or now() < new.payable_after then
      raise exception
        'commission %: cannot release before payable_after (%). Refund-protection window is still open.',
        new.id, new.payable_after;
    end if;
  end if;
  -- Never let a released commission be silently un-released or re-released.
  if old.released_at is not null and new.released_at is distinct from old.released_at then
    raise exception 'commission %: released_at is immutable once set', new.id;
  end if;
  return new;
end $$;

drop trigger if exists commission_release_guard_trg on public.commissions;
create trigger commission_release_guard_trg
  before update on public.commissions
  for each row execute function public.commission_release_guard();

-- A promoter's permanent referral code now works at shop checkout too, not just
-- hoodie codes.
alter table public.shop_orders
  add column if not exists promoter_code text;

-- Promoter payout rail choice (Stripe bank/debit, or PayPal).
alter table public.festdash_promoters
  add column if not exists payout_method text not null default 'stripe',  -- stripe | paypal
  add column if not exists paypal_email  text;

-- What NorthEDM currently owes promoters but has not yet released. Surfaced in
-- admin so this money is never mistaken for spendable revenue.
create or replace function public.commission_reserve()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'held_cents',     coalesce(sum(amount_cents) filter (where status = 'held'), 0),
    'held_count',     count(*) filter (where status = 'held'),
    'releasable_cents', coalesce(sum(amount_cents) filter (where status = 'held' and payable_after <= now()), 0),
    'releasable_count', count(*) filter (where status = 'held' and payable_after <= now()),
    'paid_cents',     coalesce(sum(amount_cents) filter (where status = 'paid'), 0),
    'reversed_cents', coalesce(sum(amount_cents) filter (where status = 'reversed'), 0)
  ) from public.commissions;
$$;
revoke all on function public.commission_reserve() from public, anon, authenticated;
grant execute on function public.commission_reserve() to service_role;
