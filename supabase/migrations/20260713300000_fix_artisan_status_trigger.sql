-- Fix: protect_privileged_profile_columns() set NEW.artisan_status := NULL on
-- INSERT into user_profiles, but artisan_status is NOT NULL (default 'none').
-- Because profile saves use upsert (INSERT ... ON CONFLICT), the insert path
-- fired this trigger and nulled a not-null column, so EVERY profile save failed
-- with "null value in column artisan_status violates not-null constraint".
--
-- Force it to 'none' instead — same intent (users can't self-grant artisan
-- status on insert) with a valid value.
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
as $function$
declare req_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  -- service_role and direct SQL are exempt
  if req_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_table_name = 'profiles' then
    if tg_op = 'INSERT' then
      new.role := 'user';
      new.vendor_id := null;
    elsif new.role is distinct from old.role
       or new.vendor_id is distinct from old.vendor_id then
      raise exception 'Cannot modify privileged profile fields';
    end if;
  elsif tg_table_name = 'user_profiles' then
    if tg_op = 'INSERT' then
      new.role := 'drifter';
      new.is_marketplace := false;
      new.is_verified := false;
      new.is_founder := false;
      new.artisan_status := 'none';   -- was NULL → not-null violation
    elsif new.role is distinct from old.role
       or new.is_marketplace is distinct from old.is_marketplace
       or new.is_verified is distinct from old.is_verified
       or new.is_founder is distinct from old.is_founder
       or new.artisan_status is distinct from old.artisan_status then
      raise exception 'Cannot modify privileged profile fields';
    end if;
  end if;
  return new;
end $function$;
