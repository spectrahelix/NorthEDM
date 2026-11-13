-- Save the previous name in the same transaction as the member's profile edit.
create or replace function public.record_profile_display_name_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.display_name_history (user_id, display_name)
  values (old.id, old.display_name);
  return new;
end;
$$;

create or replace trigger record_profile_display_name_change
  after update of display_name on public.user_profiles
  for each row
  when (old.display_name is distinct from new.display_name and old.id = auth.uid())
  execute function public.record_profile_display_name_change();

revoke execute on function public.record_profile_display_name_change() from public, anon, authenticated;
