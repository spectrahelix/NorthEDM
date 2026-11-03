-- 1) Paid PDF downloads for Apps and Tools — first PDF per account free, then
--    $0.99 by store credit or card; free without limit for perk roles (admins,
--    moderators, Wanderers). One row per purchase. `report_key` is an HMAC of
--    the chart's inputs (utils/numerology/pdfPurchases.ts) so the buyer can
--    re-download without their birth details being stored. Service role writes;
--    a user can read their own rows.
create table if not exists public.app_tool_pdf_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_slug text not null default 'astrology-hebrew-numerology',
  report_key text not null,
  method text not null check (method in ('free', 'credit', 'card', 'perk')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  status text not null default 'paid' check (status in ('pending', 'paid')),
  stripe_session_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create unique index if not exists app_tool_pdf_purchases_paid_once
  on public.app_tool_pdf_purchases (user_id, tool_slug, report_key) where status = 'paid';
create unique index if not exists app_tool_pdf_purchases_one_free
  on public.app_tool_pdf_purchases (user_id, tool_slug) where method = 'free';
create index if not exists app_tool_pdf_purchases_user on public.app_tool_pdf_purchases (user_id);
alter table public.app_tool_pdf_purchases enable row level security;
revoke all on public.app_tool_pdf_purchases from anon, authenticated;
grant select on public.app_tool_pdf_purchases to authenticated;
drop policy if exists "own pdf purchases" on public.app_tool_pdf_purchases;
create policy "own pdf purchases" on public.app_tool_pdf_purchases
  for select to authenticated using (user_id = auth.uid());

-- 2) Moderator tags (admin-granted) and the rank lock (an admin's manual rank
--    choice wins over automatic Wanderer promotion).
alter table public.user_profiles
  add column if not exists is_site_moderator boolean not null default false,
  add column if not exists is_forum_moderator boolean not null default false,
  add column if not exists rank_locked boolean not null default false;
-- user_profiles uses column-level grants: a new column is unreadable by
-- ordinary sessions (and any query naming it fails) until granted. Public.
grant select (is_site_moderator, is_forum_moderator, rank_locked) on public.user_profiles to anon, authenticated;

-- End users can't set these on themselves (same guard as the other tag flags).
create or replace function public.protect_role_flags()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.is_artisan           := old.is_artisan;
    new.is_vendor            := old.is_vendor;
    new.is_festdash_vendor   := old.is_festdash_vendor;
    new.is_promoter          := old.is_promoter;
    new.is_founder           := old.is_founder;
    new.is_marketplace       := old.is_marketplace;
    new.is_driver            := old.is_driver;
    new.is_forager           := old.is_forager;
    new.is_verified          := old.is_verified;
    new.is_site_moderator    := old.is_site_moderator;
    new.is_forum_moderator   := old.is_forum_moderator;
    new.rank_locked          := old.rank_locked;
    new.pending_email        := old.pending_email;
    new.email_change_token   := old.email_change_token;
    new.email_change_expires := old.email_change_expires;
  end if;
  return new;
end $function$;

-- 3) Wanderer = the forum regular. Promote Drifters whose forum activity meets
--    the bar; never touches other ranks or a rank an admin locked. Called daily
--    by /api/cron/forum-regulars (service role). Returns who was promoted.
create or replace function public.promote_forum_regulars(
  p_min_posts integer, p_min_active_days integer, p_min_age_days integer
) returns table (user_id uuid, posts bigint, active_days bigint)
language sql
security definer
set search_path to 'public'
as $$
  with activity as (
    select a.user_id, count(*) as posts, count(distinct a.created_at::date) as active_days, min(a.created_at) as first_post
    from (select t.user_id, t.created_at from threads t union all select r.user_id, r.created_at from replies r) a
    group by a.user_id
  ), promoted as (
    update user_profiles p set role = 'wanderer'
    from activity s
    where p.id = s.user_id
      and p.role = 'drifter'
      and not p.rank_locked
      and s.posts >= p_min_posts
      and s.active_days >= p_min_active_days
      and s.first_post <= now() - make_interval(days => p_min_age_days)
    returning p.id, s.posts, s.active_days
  )
  select * from promoted;
$$;
revoke all on function public.promote_forum_regulars(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.promote_forum_regulars(integer, integer, integer) to service_role;
