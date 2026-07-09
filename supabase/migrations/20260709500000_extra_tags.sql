-- Extra admin-grantable tags: Driver, Forager/Guide, Verified.
alter table public.user_profiles
  add column if not exists is_driver   boolean not null default false,
  add column if not exists is_forager  boolean not null default false,
  add column if not exists is_verified boolean not null default false;

-- Backfill Driver from active FestDash drivers.
update public.user_profiles up set is_driver = true
  where exists (select 1 from public.festdash_drivers d where d.user_id = up.id and d.is_active);

-- Guard the new flags (service role only), keeping all prior guards.
create or replace function public.protect_role_flags()
returns trigger language plpgsql security definer set search_path = public as $$
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
    new.pending_email        := old.pending_email;
    new.email_change_token   := old.email_change_token;
    new.email_change_expires := old.email_change_expires;
  end if;
  return new;
end $$;
