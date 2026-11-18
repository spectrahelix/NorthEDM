-- NorthEDM Social Command Center, phase 1: admin-only content queue.
-- Scheduling here records intended publish time; it does not imply an automated
-- post or a direct connection to Muse. Every outbound action is human-approved.
create table if not exists public.social_post_queue (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  title text not null default '',
  caption text not null check (char_length(caption) between 1 and 5000),
  image_url text,
  account_ids uuid[] not null default '{}',
  planned_for timestamptz,
  status text not null default 'draft'
    check (status in ('draft','approved','scheduled','handoff','published','failed','archived')),
  notes text not null default '',
  delivery_results jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_queue_image_url_check
    check (image_url is null or image_url ~ '^https://'),
  constraint social_queue_schedule_check
    check (status <> 'scheduled' or planned_for is not null)
);

create index if not exists social_queue_status_planned_idx
  on public.social_post_queue (status, planned_for);
create index if not exists social_queue_created_idx
  on public.social_post_queue (created_at desc);
alter table public.social_post_queue enable row level security;
-- Admin access is via the authenticated Next.js API route and the
-- server-side service role only; never expose drafts publicly.
revoke all on table public.social_post_queue from anon, authenticated;
grant select, insert, update, delete on public.social_post_queue to service_role;
comment on table public.social_post_queue is
  'Admin-only drafted, approved and manually handed-off social posts. No automatic publishing.';
