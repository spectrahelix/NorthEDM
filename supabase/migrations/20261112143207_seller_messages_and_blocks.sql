-- Item attachments use site-owned product routes. Existing messages have no attachment.
alter table public.direct_messages add column item_path text
  check (item_path ~ '^(/marketplace/[1-9][0-9]*/item/[1-9][0-9]*|/shop/[a-z0-9][a-z0-9-]*)$');

create table public.message_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index message_blocks_blocked_id_idx on public.message_blocks(blocked_id);
alter table public.message_blocks enable row level security;
revoke all on public.message_blocks from public, anon, authenticated;
grant select, insert, delete on public.message_blocks to authenticated;
create policy "manage own message blocks" on public.message_blocks
  for all to authenticated
  using ((select auth.uid()) = blocker_id)
  with check ((select auth.uid()) = blocker_id);

create schema if not exists private;
-- The policy needs to see blocks in both directions without giving either
-- participant access to the other participant's list.
create function private.can_send_direct_message(p_recipient uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and not exists (
    select 1 from public.message_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_recipient)
       or (b.blocker_id = p_recipient and b.blocked_id = auth.uid())
  );
$$;
revoke all on function private.can_send_direct_message(uuid) from public, anon, authenticated;
grant execute on function private.can_send_direct_message(uuid) to authenticated;

alter policy "dm send" on public.direct_messages
  with check ((select auth.uid()) = sender_id and private.can_send_direct_message(recipient_id));
-- The existing update policy is for marking messages read.
revoke update on public.direct_messages from public, anon, authenticated;
grant update (read) on public.direct_messages to authenticated;

-- Only an accepted message can generate a DM notification. Keep the existing
-- verified-sender rule and leave other notification types on their current path.
alter policy "verified insert notification" on public.notifications
  with check (public.is_verified() and type <> 'message');

create function private.notify_direct_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) = new.sender_id and public.is_verified() then
    insert into public.notifications(user_id, type, message, link)
    values (
      new.recipient_id, 'message',
      'New message from ' || coalesce(
        (select p.display_name from public.user_profiles p where p.id = new.sender_id), 'someone'
      ) || ': ' || left(new.subject, 100),
      '/messages'
    );
  end if;
  return new;
end;
$$;
revoke all on function private.notify_direct_message() from public, anon, authenticated;
create trigger notify_direct_message after insert on public.direct_messages
  for each row execute function private.notify_direct_message();
