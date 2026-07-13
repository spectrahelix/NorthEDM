-- Service Quotes — send a client a quote (website/dev/etc.), collect payment via
-- Stripe, and pay the referring promoter a real cash commission on payment.
--
-- Promoter attribution is set by the admin when creating the quote (explicit and
-- reliable for high-ticket service sales, vs. a scan cookie). On payment, the
-- promoter's commission is transferred to their Stripe Connect account — but only
-- once, and only on the client's FIRST paid quote (first-order guard).

create table if not exists public.service_quotes (
  id                 uuid primary key default gen_random_uuid(),
  token              text not null unique,              -- public pay-link slug
  title              text not null,
  client_name        text,
  client_email       text,
  line_items         jsonb not null default '[]',       -- [{label, amount_cents}]
  total_cents        int  not null default 0,
  deposit_cents      int  not null default 0,           -- 0 = pay in full only
  monthly_cents      int  not null default 0,           -- maintenance (billed separately, Phase 2)
  promoter_user_id   uuid references auth.users(id) on delete set null,
  commission_bps     int  not null default 1000,        -- 10%
  status             text not null default 'sent',      -- sent | deposit_paid | paid
  amount_paid_cents  int  not null default 0,
  promoter_paid_cents int not null default 0,
  stripe_session_id  text,
  stripe_payment_intent text,
  paid_sessions      jsonb not null default '[]',        -- processed checkout sessions (idempotency)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists service_quotes_token_idx on public.service_quotes (token);
create index if not exists service_quotes_promoter_idx on public.service_quotes (promoter_user_id);

-- Service-role only: admin management, the public pay page, and the webhook all
-- reach this through the service-role client. A quote's contents are exposed only
-- via the token-scoped pay endpoint.
alter table public.service_quotes enable row level security;
