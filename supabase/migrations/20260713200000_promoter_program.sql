-- Unified promoter program settings.
--
-- A promoter's code (carried by their hoodie QR) attributes a shopper to them and
-- earns them a reward on NorthEDM-BRAND purchases (the shop). It is deliberately
-- walled off from third-party margins: FestDash orders and marketplace vendor
-- products never read the promoter cookie, so the code can't discount someone
-- else's goods. These settings control how the brand reward pays out.

create table if not exists public.promoter_program_settings (
  id               int primary key default 1,
  payout_mode      text not null default 'cash',   -- 'cash' (Stripe transfer) | 'credit' (store credit)
  first_order_only boolean not null default true,   -- reward only on a buyer's first paid brand order
  updated_at       timestamptz not null default now(),
  constraint promoter_program_single_row check (id = 1)
);

insert into public.promoter_program_settings (id) values (1) on conflict (id) do nothing;

-- Service-role only (admin settings API + checkout/webhook read via service role).
alter table public.promoter_program_settings enable row level security;
