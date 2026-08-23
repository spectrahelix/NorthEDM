-- NorthEDM Wallet / Promoter commissions / Payouts — Stage 1: schema + ledger
-- primitives. See docs/WALLET.md. No UI depends on this yet; app logic ships in
-- later verified stages. Money-sensitive: balances live in an append-only ledger,
-- and NO client can write balance-affecting tables — only SECURITY DEFINER
-- functions (below) or the service role.

-- ── Wallet ledger: append-only source of truth for balances ──────────────────
create table if not exists public.wallet_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('commission','refund','spend','withdrawal','adjustment')),
  amount_cents bigint not null,                 -- signed: + credit, − debit
  ref_type     text,                            -- e.g. 'shop_order', 'stripe_transfer'
  ref_id       text,
  memo         text,
  created_at   timestamptz not null default now()
);
create index if not exists wallet_ledger_user_idx on public.wallet_ledger (user_id, created_at desc);

alter table public.wallet_ledger enable row level security;
-- Users may read ONLY their own entries; no client insert/update/delete at all.
drop policy if exists "wallet_ledger owner read" on public.wallet_ledger;
create policy "wallet_ledger owner read" on public.wallet_ledger for select using (auth.uid() = user_id);

-- Client-callable: my own balance only (never exposes another user's balance).
create or replace function public.my_wallet_balance()
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount_cents), 0)::bigint from public.wallet_ledger where user_id = auth.uid();
$$;
revoke all on function public.my_wallet_balance() from public, anon;
grant execute on function public.my_wallet_balance() to authenticated;

-- Server-side money movement with invariants: never let a balance go negative,
-- serialized per-user via an advisory lock. Service-role only.
create or replace function public.wallet_apply(
  p_user uuid, p_kind text, p_amount_cents bigint,
  p_ref_type text default null, p_ref_id text default null, p_memo text default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare bal bigint;
begin
  if p_amount_cents = 0 then raise exception 'wallet_apply: zero amount'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select coalesce(sum(amount_cents), 0) into bal from public.wallet_ledger where user_id = p_user;
  if p_amount_cents < 0 and bal + p_amount_cents < 0 then
    raise exception 'wallet_apply: insufficient balance (have %, need %)', bal, -p_amount_cents;
  end if;
  insert into public.wallet_ledger (user_id, kind, amount_cents, ref_type, ref_id, memo)
    values (p_user, p_kind, p_amount_cents, p_ref_type, p_ref_id, p_memo);
  return bal + p_amount_cents;
end $$;
revoke all on function public.wallet_apply(uuid, text, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.wallet_apply(uuid, text, bigint, text, text, text) to service_role;

-- ── Reusable promoter codes (one permanent code/QR per promoter) ─────────────
create table if not exists public.promoter_codes (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  code       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.promoter_codes enable row level security;
drop policy if exists "promoter_codes owner read" on public.promoter_codes;
create policy "promoter_codes owner read" on public.promoter_codes for select using (auth.uid() = user_id);
-- Resolution of a code → promoter happens server-side (service role); no public read.

-- ── First-touch attribution (immutable, no self-referral) ────────────────────
create table if not exists public.referral_attributions (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  promoter_user_id uuid not null references auth.users(id) on delete cascade,
  code             text not null,
  created_at       timestamptz not null default now(),
  check (referred_user_id <> promoter_user_id)
);
create index if not exists referral_attr_promoter_idx on public.referral_attributions (promoter_user_id);
alter table public.referral_attributions enable row level security;
drop policy if exists "referral_attr party read" on public.referral_attributions;
create policy "referral_attr party read" on public.referral_attributions
  for select using (auth.uid() = referred_user_id or auth.uid() = promoter_user_id);

-- ── Commission rates (admin-editable % per paid action) ──────────────────────
create table if not exists public.commission_rates (
  source_type text primary key,       -- shop_order | vendor_listing | foraging_tour | festdash_order
  rate_bps    int not null default 0 check (rate_bps between 0 and 10000),  -- 1000 = 10%
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);
insert into public.commission_rates (source_type, rate_bps) values
  ('shop_order', 1000), ('vendor_listing', 1000), ('foraging_tour', 1000), ('festdash_order', 1000)
on conflict (source_type) do nothing;
alter table public.commission_rates enable row level security;
drop policy if exists "commission_rates public read" on public.commission_rates;
create policy "commission_rates public read" on public.commission_rates for select using (active);
-- Writes: admin/service role only (no client write policy).

-- ── Commissions (one row per paid action, idempotent, credits the ledger) ────
create table if not exists public.commissions (
  id               uuid primary key default gen_random_uuid(),
  promoter_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  source_type      text not null,
  source_id        text not null,
  base_cents       bigint not null,
  rate_bps         int not null,
  amount_cents     bigint not null,
  status           text not null default 'credited',
  created_at       timestamptz not null default now(),
  unique (source_type, source_id)     -- idempotency: a retried webhook can't double-pay
);
create index if not exists commissions_promoter_idx on public.commissions (promoter_user_id, created_at desc);
alter table public.commissions enable row level security;
drop policy if exists "commissions promoter read" on public.commissions;
create policy "commissions promoter read" on public.commissions for select using (auth.uid() = promoter_user_id);

-- ── Stripe Connect accounts (for bank withdrawals) ───────────────────────────
create table if not exists public.connect_accounts (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text not null unique,
  payouts_enabled   boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.connect_accounts enable row level security;
drop policy if exists "connect_accounts owner read" on public.connect_accounts;
create policy "connect_accounts owner read" on public.connect_accounts for select using (auth.uid() = user_id);
-- Writes: server (service role) only.
