-- Vendor "Upcoming Shows": festivals/events a vendor will be at. The current or
-- most-upcoming show surfaces on their marketplace + FestDash listings unless
-- they toggle it hidden.

create table if not exists public.vendor_shows (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  festival_name text not null,
  location      text,
  start_date    date,
  end_date      date,
  created_at    timestamptz not null default now()
);
create index if not exists vendor_shows_user_idx on public.vendor_shows(user_id, start_date);

alter table public.vendor_shows enable row level security;
drop policy if exists "vendor_shows public read" on public.vendor_shows;
create policy "vendor_shows public read" on public.vendor_shows for select using (true);
drop policy if exists "vendor_shows owner insert" on public.vendor_shows;
create policy "vendor_shows owner insert" on public.vendor_shows for insert with check (auth.uid() = user_id);
drop policy if exists "vendor_shows owner update" on public.vendor_shows;
create policy "vendor_shows owner update" on public.vendor_shows for update using (auth.uid() = user_id);
drop policy if exists "vendor_shows owner delete" on public.vendor_shows;
create policy "vendor_shows owner delete" on public.vendor_shows for delete using (auth.uid() = user_id);

-- The "hide my upcoming shows from listings" toggle.
alter table public.user_profiles
  add column if not exists hide_shows boolean not null default false;
