-- Prevent ordinary members from marking their own DMs as privileged
-- broadcast deliveries. Service-role-only API paths attach broadcast_id.
create or replace function private.validate_direct_message_broadcast_id()
returns trigger
language plpgsql security invoker set search_path=''
as $$
begin
  if new.broadcast_id is not null
     and current_user not in ('service_role','postgres') then
    raise exception 'Broadcast identifiers are server-managed';
  end if;
  return new;
end
$$;
revoke all on function private.validate_direct_message_broadcast_id() from public,anon,authenticated;
drop trigger if exists trg_validate_direct_message_broadcast_id on public.direct_messages;
create trigger trg_validate_direct_message_broadcast_id
before insert or update of broadcast_id on public.direct_messages
for each row execute function private.validate_direct_message_broadcast_id();