-- Local Events aggregator: auto-populated "Upcoming Local Events".
--
-- Unlike vendor_shows (hand-entered by vendors), this table is filled by a
-- scheduled ingest job (app/api/cron/local-events): a curated seed list of
-- known regional festivals (auto-approved) plus optional Ticketmaster discovery
-- (queued as 'pending' for admin review). The public /events page reads only
-- 'approved' rows; the admin review screen sees everything.

create table if not exists public.local_events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  venue       text,
  city        text,
  region      text,                 -- state / region label, e.g. "PA"
  start_date  date,
  end_date    date,
  lat         double precision,
  lng         double precision,
  description text,
  source      text not null default 'manual',  -- 'seed' | 'ticketmaster' | 'manual'
  source_url  text,
  status      text not null default 'pending', -- 'pending' | 'approved' | 'hidden'
  -- normalized name|city|start used to upsert without creating duplicates
  dedup_key   text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists local_events_status_start_idx
  on public.local_events (status, start_date);

alter table public.local_events enable row level security;

-- Public may read only approved events. Pending/hidden are admin-only, reached
-- through the service-role client in the admin API. No public writes at all —
-- the cron job and admin actions both use the service role.
drop policy if exists "public read approved local_events" on public.local_events;
create policy "public read approved local_events" on public.local_events
  for select using (status = 'approved');

-- keep updated_at fresh on writes
create or replace function public.touch_local_events_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists local_events_touch_updated_at on public.local_events;
create trigger local_events_touch_updated_at
  before update on public.local_events
  for each row execute function public.touch_local_events_updated_at();
