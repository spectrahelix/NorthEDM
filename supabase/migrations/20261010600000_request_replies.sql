-- Service requests had no way to answer the person who sent them, and no
-- record of what had been said. Every reply sent from /admin/requests is kept
-- here, including whether the email actually went out, so the owner can see
-- the whole conversation and never wonder whether a reply was delivered.
create table if not exists public.request_replies (
  id          bigserial primary key,
  request_id  bigint not null references public.requests(id) on delete cascade,
  body        text not null,
  sent_by     uuid,
  sent_to     text not null,
  delivered   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists request_replies_request_idx
  on public.request_replies (request_id, created_at);

-- Admin-only. RLS on with no policies: only the service role (every admin
-- action) can read or write it.
alter table public.request_replies enable row level security;
revoke all on public.request_replies from anon, authenticated;
revoke all on sequence public.request_replies_id_seq from anon, authenticated;

comment on table public.request_replies is
  'Replies sent to service requesters from /admin/requests. Service-role only.';
