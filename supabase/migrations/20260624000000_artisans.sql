-- Artisan identity + portfolio works, plus expanded profile fields.
--
-- An "artisan" is a verified maker/creator (visual art, music, crafts, DIY…).
-- Anyone can fill out their artisan details and apply; the verified tag and the
-- public /artisans directory are gated on `is_artisan`, which only an admin
-- (service role) can flip — enforced by a trigger so users can't self-verify.

alter table public.user_profiles
  add column if not exists is_artisan boolean not null default false,
  add column if not exists artisan_status text not null default 'none',
  add column if not exists stage_name text,
  add column if not exists artisan_craft text,
  add column if not exists artisan_statement text,
  add column if not exists pronouns text,
  add column if not exists website text,
  add column if not exists socials jsonb not null default '[]'::jsonb;

alter table public.user_profiles
  drop constraint if exists user_profiles_artisan_status_check;
alter table public.user_profiles
  add constraint user_profiles_artisan_status_check
  check (artisan_status in ('none','pending','approved'));

-- Only the service role (admin API) may change verification status.
create or replace function public.protect_artisan_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.is_artisan, false) is distinct from coalesce(old.is_artisan, false)
     and coalesce(auth.role(), '') <> 'service_role' then
    new.is_artisan := old.is_artisan;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_artisan_verification on public.user_profiles;
create trigger trg_protect_artisan_verification
  before update on public.user_profiles
  for each row execute function public.protect_artisan_verification();

-- Portfolio works shown on the artisan's profile + the directory.
create table if not exists public.artisan_works (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'image' check (kind in ('image', 'embed', 'link')),
  title text,
  caption text,
  image_url text,
  url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists artisan_works_user_idx on public.artisan_works(user_id, sort);

alter table public.artisan_works enable row level security;

drop policy if exists "artisan_works public read" on public.artisan_works;
create policy "artisan_works public read" on public.artisan_works
  for select using (true);
drop policy if exists "artisan_works owner insert" on public.artisan_works;
create policy "artisan_works owner insert" on public.artisan_works
  for insert with check (auth.uid() = user_id);
drop policy if exists "artisan_works owner update" on public.artisan_works;
create policy "artisan_works owner update" on public.artisan_works
  for update using (auth.uid() = user_id);
drop policy if exists "artisan_works owner delete" on public.artisan_works;
create policy "artisan_works owner delete" on public.artisan_works
  for delete using (auth.uid() = user_id);

-- Storage bucket for artisan portfolio images (public read, owner-scoped writes).
insert into storage.buckets (id, name, public)
  values ('artisan-works', 'artisan-works', true)
  on conflict (id) do nothing;

drop policy if exists "artisan-works public read" on storage.objects;
create policy "artisan-works public read" on storage.objects
  for select using (bucket_id = 'artisan-works');
drop policy if exists "artisan-works auth insert" on storage.objects;
create policy "artisan-works auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'artisan-works');
drop policy if exists "artisan-works auth update" on storage.objects;
create policy "artisan-works auth update" on storage.objects
  for update to authenticated using (bucket_id = 'artisan-works');
drop policy if exists "artisan-works auth delete" on storage.objects;
create policy "artisan-works auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'artisan-works');
