-- Post-consolidation audit. Two classes of problem.

-- ── 1. PRIVILEGE ESCALATION introduced by the consolidation itself ─────────
-- vendor_id was a privileged column: on the old profiles table this trigger
-- forced it NULL on insert and raised on any change. Moving the column to
-- user_profiles moved the data but NOT the guard. Combined with the
-- "own update profile" policy (auth.uid() = id), any signed-in account could
-- set its own vendor_id and inherit that vendor entirely — products, FestDash
-- orders, promo codes, Square connection.
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare req_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if req_role not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_table_name = 'user_profiles' then
    if tg_op = 'INSERT' then
      new.role           := 'drifter';
      new.is_marketplace := false;
      new.is_verified    := false;
      new.is_founder     := false;
      new.artisan_status := 'none';
      new.vendor_id      := null;
    elsif new.role           is distinct from old.role
       or new.is_marketplace is distinct from old.is_marketplace
       or new.is_verified    is distinct from old.is_verified
       or new.is_founder     is distinct from old.is_founder
       or new.artisan_status is distinct from old.artisan_status
       or new.vendor_id      is distinct from old.vendor_id then
      raise exception 'Cannot modify privileged profile fields';
    end if;
  end if;
  return new;
end $function$;

comment on function public.protect_privileged_profile_columns() is
  'Blocks end-user writes to privileged user_profiles columns (role, is_marketplace, is_verified, is_founder, artisan_status, vendor_id). service_role exempt.';

-- ── 2. SIX write policies still had an unconditional TRUE check ────────────
-- Same shape as the `requests` policy that admitted 14 spam rows.

drop policy if exists "public submit booking" on public.bookings;
drop policy if exists "verified submit booking" on public.bookings;
create policy "verified submit booking" on public.bookings
  for insert to authenticated with check (public.is_verified());

drop policy if exists "Anyone can apply as promoter" on public.festdash_promoter_applications;
drop policy if exists "verified apply as promoter" on public.festdash_promoter_applications;
create policy "verified apply as promoter" on public.festdash_promoter_applications
  for insert to authenticated with check (public.is_verified());

drop policy if exists "Anyone can apply to FestDash" on public.festdash_vendor_applications;
drop policy if exists "verified apply as festdash vendor" on public.festdash_vendor_applications;
create policy "verified apply as festdash vendor" on public.festdash_vendor_applications
  for insert to authenticated with check (public.is_verified());

drop policy if exists "auth create category" on public.forum_categories;
drop policy if exists "verified create category" on public.forum_categories;
create policy "verified create category" on public.forum_categories
  for insert to authenticated with check (public.is_verified() and created_by = auth.uid());

-- The app legitimately writes notifications addressed to OTHER users (a report
-- notifies admins, a DM notifies its recipient), so the row cannot be pinned to
-- auth.uid() — but the sender can be required to be a confirmed account.
drop policy if exists "system insert" on public.notifications;
drop policy if exists "verified insert notification" on public.notifications;
create policy "verified insert notification" on public.notifications
  for insert to authenticated with check (public.is_verified());

-- community_groups UPDATE was TRUE for any signed-in user, so anyone could
-- rename or recategorise any group. The policy exists so joining bumps
-- member_count — the only field an end user should change. RLS cannot compare
-- old to new, so a trigger enforces that part.
drop policy if exists "auth update community_groups" on public.community_groups;
drop policy if exists "verified update community_groups" on public.community_groups;
create policy "verified update community_groups" on public.community_groups
  for update to authenticated using (public.is_verified());

create or replace function public.protect_community_group_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare req_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if req_role not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.name is distinct from old.name
     or new.emoji is distinct from old.emoji
     or new.category is distinct from old.category then
    raise exception 'Only member_count can be changed here';
  end if;
  return new;
end $function$;

drop trigger if exists protect_community_group_fields on public.community_groups;
create trigger protect_community_group_fields
  before update on public.community_groups
  for each row execute function public.protect_community_group_fields();
