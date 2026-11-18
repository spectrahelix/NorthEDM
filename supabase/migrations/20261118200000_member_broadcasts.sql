-- New profiles start with NULL; only first verified sign-in can claim the welcome.
-- Existing members are marked as already checked to avoid unsolicited retroactive greetings.
alter table public.user_profiles add column if not exists welcome_dm_checked_at timestamptz;
update public.user_profiles set welcome_dm_checked_at=now() where welcome_dm_checked_at is null;

-- Member announcements are separate from the one-time welcome.
create table if not exists public.member_broadcast_opt_outs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table if not exists public.member_broadcasts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id),
  subject text not null check(char_length(subject) between 1 and 100),
  body text not null check(char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);
create table if not exists public.member_broadcast_deliveries (
  broadcast_id uuid not null references public.member_broadcasts(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  message_id bigint references public.direct_messages(id) on delete set null,
  outcome text not null check(outcome in ('delivered','blocked','opted_out')),
  created_at timestamptz not null default now(),
  primary key (broadcast_id,recipient_id)
);
alter table public.member_broadcast_opt_outs enable row level security;
alter table public.member_broadcasts enable row level security;
alter table public.member_broadcast_deliveries enable row level security;
revoke all on public.member_broadcast_opt_outs, public.member_broadcasts, public.member_broadcast_deliveries from anon, authenticated;
grant select, insert, update, delete on public.member_broadcast_opt_outs, public.member_broadcasts, public.member_broadcast_deliveries to service_role;

-- System-generated messages honor recipient block lists and announcement opt-outs.
-- Race-safe unique constraint keeps one broadcast from reaching a recipient twice.
create or replace function public.deliver_member_announcement(p_broadcast uuid, p_recipient uuid)
returns text language plpgsql security invoker set search_path = ''
as $$
declare
 v_sender uuid;
 v_subject text;
 v_body text;
 v_outcome text;
 v_message bigint;
begin
 select sender_id,subject,body into v_sender,v_subject,v_body
 from public.member_broadcasts where id=p_broadcast;
 if v_sender is null then return 'missing'; end if;
 if p_recipient=v_sender then return 'self'; end if;
 if not exists(select 1 from auth.users where id=p_recipient and email_confirmed_at is not null)
   or not exists(select 1 from public.user_profiles where id=p_recipient) then return 'missing'; end if;
 if exists(select 1 from public.member_broadcast_opt_outs where user_id=p_recipient) then
   v_outcome := 'opted_out';
 elsif exists(select 1 from public.message_blocks where
     (blocker_id=p_recipient and blocked_id=v_sender) or
     (blocker_id=v_sender and blocked_id=p_recipient)) then
   v_outcome := 'blocked';
 else
   v_outcome := 'delivered';
 end if;
 insert into public.member_broadcast_deliveries(broadcast_id,recipient_id,outcome)
 values(p_broadcast,p_recipient,v_outcome) on conflict do nothing;
 if not found then return 'duplicate'; end if;
 if v_outcome='delivered' then
   insert into public.direct_messages(sender_id,recipient_id,subject,body)
   values(v_sender,p_recipient,v_subject,v_body) returning id into v_message;
   update public.member_broadcast_deliveries set message_id=v_message
   where broadcast_id=p_broadcast and recipient_id=p_recipient;
 end if;
 return v_outcome;
end
$$;
revoke all on function public.deliver_member_announcement(uuid,uuid) from public,anon,authenticated;
grant execute on function public.deliver_member_announcement(uuid,uuid) to service_role;
