-- Gambian payment bridge intake (stage two): the coordinator's business,
-- bank and aggregator (Waychit / Modem Pay) details. Private: no end-user
-- grant at all — read and written only by API routes with the service role
-- (coordinator for their own row, admins for every row). Secrets (API key,
-- webhook secret) are returned to the UI masked.
create table if not exists public.coordinator_bridge (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'waychit' check (provider in ('waychit', 'modempay')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'verified', 'live')),
  business_name text,
  registration_number text,
  tin text,
  business_address text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_swift text,
  bank_can_send_usd boolean,
  merchant_id text,
  api_key text,
  webhook_secret text,
  provider_contact text,
  notes text,
  owner_notes text,
  submitted_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coordinator_bridge enable row level security;
revoke all on table public.coordinator_bridge from anon, authenticated;
