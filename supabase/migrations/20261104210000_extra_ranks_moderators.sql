-- Multiple ranks per person (owner's request, 2026-11-04). `role` stays the
-- primary rank (badge colour, admin power); `extra_ranks` holds additional
-- ranks whose abilities the person also has. Archon holds every rank's
-- abilities in code (utils/ranks.ts), so it is never stored here. Admin ranks
-- (warden, archon) are never extra ranks: admin power is the primary role only.
-- `is_site_moderator` lets someone add/remove the non-admin ranks on others.
alter table public.user_profiles
  add column if not exists extra_ranks text[] not null default '{}',
  add column if not exists is_site_moderator boolean not null default false;

alter table public.user_profiles drop constraint if exists user_profiles_extra_ranks_valid;
alter table public.user_profiles add constraint user_profiles_extra_ranks_valid
  check (extra_ranks <@ array['wanderer', 'merchant', 'promoter']::text[]);

-- user_profiles uses column-level grants: public, like role.
grant select (extra_ranks, is_site_moderator) on public.user_profiles to anon, authenticated;

-- Nobody sets their own ranks or moderator flag; only service-role routes do.
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
    new.extra_ranks          := old.extra_ranks;
    new.pending_email        := old.pending_email;
    new.email_change_token   := old.email_change_token;
    new.email_change_expires := old.email_change_expires;
  end if;
  return new;
end $function$;
