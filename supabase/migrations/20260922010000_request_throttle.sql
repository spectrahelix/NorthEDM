-- Durable per-IP throttling for the handful of endpoints that must stay open
-- to people without accounts (vendor applications, signup, sign-in help).
--
-- /api/vendors previously throttled with an in-memory Map. On serverless that
-- is close to useless: the map dies on every cold start and each instance keeps
-- its own copy, so a caller spread across instances is never counted. This
-- table is the shared counter those routes actually needed.
create table if not exists public.request_throttle (
  id         bigserial primary key,
  bucket     text        not null,   -- which endpoint, e.g. 'signup'
  ip         text        not null,   -- never null: a null IP must not form a shared bucket
  created_at timestamptz not null default now()
);

create index if not exists request_throttle_lookup_idx
  on public.request_throttle (bucket, ip, created_at desc);

-- Service-role only. RLS on with zero policies means no anon or authenticated
-- caller can read or write it, which is what we want for a counter that exists
-- purely to be checked server-side.
alter table public.request_throttle enable row level security;

revoke all on public.request_throttle from anon, authenticated;
revoke all on sequence public.request_throttle_id_seq from anon, authenticated;

comment on table public.request_throttle is
  'Per-IP request counter for guest-open endpoints. Written and read only by service_role; rows older than a day are pruned by the writer.';
