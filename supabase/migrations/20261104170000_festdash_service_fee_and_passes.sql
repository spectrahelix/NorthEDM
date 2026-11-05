-- Customer service fee on FestDash orders (owner keeps it; covers card
-- processing) and FestDash passes that waive it for a set number of days.
alter table public.coordinator_program_settings
  add column if not exists service_fee_bps integer not null default 500 check (service_fee_bps between 0 and 3000),
  add column if not exists service_fee_min_cents integer not null default 100 check (service_fee_min_cents between 0 and 10000),
  add column if not exists festdash_passes jsonb not null default '[
    {"key":"2day","label":"2-day pass","days":2,"price_cents":399},
    {"key":"3day","label":"Weekend pass (3 days)","days":3,"price_cents":499},
    {"key":"7day","label":"7-day pass","days":7,"price_cents":699},
    {"key":"monthly","label":"Monthly pass (30 days)","days":30,"price_cents":999}
  ]'::jsonb;
alter table public.festdash_orders add column if not exists service_fee_cents integer not null default 0;

create table if not exists public.festdash_member_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pass_key text not null,
  days integer not null check (days > 0),
  price_cents integer not null check (price_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'active')),
  starts_at timestamptz,
  ends_at timestamptz,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);
create index if not exists festdash_member_passes_user on public.festdash_member_passes (user_id, ends_at);
alter table public.festdash_member_passes enable row level security;
revoke all on table public.festdash_member_passes from anon, authenticated;
grant select on table public.festdash_member_passes to authenticated;
create policy "own passes" on public.festdash_member_passes for select to authenticated using (user_id = auth.uid());
