-- Marketplace access: a PAID, admin-granted capability (separate from the
-- "Vendor" membership) that lets a vendor upload inventory to their in-house
-- NorthEDM market. Users apply; the Archon reviews + grants.

alter table public.user_profiles
  add column if not exists is_marketplace boolean not null default false;

-- Guard the new flag too (only the service role / admin flow may set it).
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
    new.pending_email        := old.pending_email;
    new.email_change_token   := old.email_change_token;
    new.email_change_expires := old.email_change_expires;
  end if;
  return new;
end $$;

-- Applications for marketplace access.
create table if not exists public.marketplace_applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  category      text,
  description   text,
  contact       text,
  website       text,
  status        text not null default 'pending',  -- pending | approved | rejected
  created_at    timestamptz not null default now()
);
create index if not exists marketplace_apps_user_idx on public.marketplace_applications(user_id);
create index if not exists marketplace_apps_status_idx on public.marketplace_applications(status);

alter table public.marketplace_applications enable row level security;

drop policy if exists "mkt apps owner read" on public.marketplace_applications;
create policy "mkt apps owner read" on public.marketplace_applications
  for select using (auth.uid() = user_id);
drop policy if exists "mkt apps owner insert" on public.marketplace_applications;
create policy "mkt apps owner insert" on public.marketplace_applications
  for insert with check (auth.uid() = user_id);
-- Admin reads/updates go through the service role (bypasses RLS).
