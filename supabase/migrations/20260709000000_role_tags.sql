-- Approval tags shown on profiles + forum: Founder, Vendor, FestDash Vendor,
-- Promoter (Artisan already exists). Denormalized boolean flags on user_profiles
-- so the forum/profile (which already read user_profiles) light up with no extra
-- queries. Flags are set by the approval flows via the service role only.

alter table public.user_profiles
  add column if not exists is_vendor          boolean not null default false,
  add column if not exists is_festdash_vendor boolean not null default false,
  add column if not exists is_promoter        boolean not null default false,
  add column if not exists is_founder         boolean not null default false,
  -- tag keys the user chose to HIDE from the forum (still show on their profile)
  add column if not exists hidden_tags        text[]  not null default '{}';

-- Backfill from existing approved records.
update public.user_profiles up set is_vendor = true
  where exists (select 1 from public.vendors v where v.user_id = up.id and v.status = 'approved');
update public.user_profiles up set is_festdash_vendor = true
  where exists (select 1 from public.festdash_vendors fv where fv.user_id = up.id and fv.is_active);
update public.user_profiles up set is_promoter = true
  where exists (select 1 from public.festdash_promoters fp where fp.user_id = up.id and fp.is_active);
update public.user_profiles up set is_founder = true
  where exists (select 1 from public.vendors v where v.user_id = up.id and coalesce(v.is_founder, false));

-- Only the service role (admin/approval flows) may change any role flag —
-- users can't self-grant. Replaces the artisan-only guard with a combined one.
create or replace function public.protect_role_flags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.is_artisan          := old.is_artisan;
    new.is_vendor           := old.is_vendor;
    new.is_festdash_vendor  := old.is_festdash_vendor;
    new.is_promoter         := old.is_promoter;
    new.is_founder          := old.is_founder;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_artisan_verification on public.user_profiles;
drop trigger if exists trg_protect_role_flags on public.user_profiles;
create trigger trg_protect_role_flags
  before update on public.user_profiles
  for each row execute function public.protect_role_flags();
