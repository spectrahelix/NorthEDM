-- Admin-defined private audiences. Groups are organizational labels, not permissions
-- or publicly visible profile attributes. Members may belong to many groups.
create table if not exists public.member_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists member_groups_name_unique on public.member_groups(lower(trim(name)));

create table if not exists public.member_group_members (
  group_id uuid not null references public.member_groups(id) on delete cascade,
  member_id uuid not null references public.user_profiles(id) on delete cascade,
  added_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (group_id, member_id)
);
create index if not exists member_group_members_member_idx
  on public.member_group_members(member_id, group_id);
alter table public.member_groups enable row level security;
alter table public.member_group_members enable row level security;
revoke all on public.member_groups, public.member_group_members from anon, authenticated;
grant select, insert, update, delete on public.member_groups, public.member_group_members to service_role;

-- Targeting stored for auditing. No application-level recipient cap.
alter table public.member_broadcasts
  add column if not exists audience_mode text not null default 'selected'
    check (audience_mode in ('selected','groups','all')),
  add column if not exists audience_group_ids uuid[] not null default '{}';

-- Allow idempotent set-based creation of individual inbox DMs in one transaction.
-- Legacy and personal messages have NULL broadcast_id.
alter table public.direct_messages
  add column if not exists broadcast_id uuid references public.member_broadcasts(id) on delete set null;
create unique index if not exists direct_messages_broadcast_recipient_unique
  on public.direct_messages(broadcast_id,recipient_id)
  where broadcast_id is not null;

create or replace function public.deliver_member_announcement_audience(
  p_broadcast uuid,
  p_mode text,
  p_recipient_ids uuid[] default '{}'::uuid[],
  p_group_ids uuid[] default '{}'::uuid[]
) returns jsonb
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_sender uuid;
  v_subject text;
  v_body text;
  v_result jsonb;
begin
  select b.sender_id,b.subject,b.body
    into v_sender,v_subject,v_body
  from public.member_broadcasts b where b.id=p_broadcast;
  if v_sender is null then raise exception 'Announcement not found'; end if;
  if p_mode not in ('all','groups','selected') then raise exception 'Unknown audience mode'; end if;
  if p_mode='selected' and cardinality(p_recipient_ids)=0 then raise exception 'Select members'; end if;
  if p_mode='groups' and cardinality(p_group_ids)=0 then raise exception 'Select groups'; end if;
  if p_mode='groups' and exists (
    select 1 from unnest(p_group_ids) gid
    where not exists (select 1 from public.member_groups g where g.id=gid)
  ) then raise exception 'Unknown group'; end if;

  -- All, group union or manually selected audience is resolved inside Postgres.
  -- Repeated members in overlapping groups are deduplicated.
  insert into public.member_broadcast_deliveries(broadcast_id,recipient_id,outcome)
  select p_broadcast,p.id,
    case
      when exists (select 1 from public.member_broadcast_opt_outs o where o.user_id=p.id)
      then 'opted_out'
      when exists (
        select 1 from public.message_blocks b where
          (b.blocker_id=p.id and b.blocked_id=v_sender) or
          (b.blocker_id=v_sender and b.blocked_id=p.id)
      ) then 'blocked'
      else 'delivered'
    end
  from public.user_profiles p
  join auth.users u on u.id=p.id and u.email_confirmed_at is not null
  where p.id <> v_sender
    and (
      p_mode='all'
      or (p_mode='selected' and p.id=any(p_recipient_ids))
      or (p_mode='groups' and exists (
        select 1 from public.member_group_members gm
        where gm.member_id=p.id and gm.group_id=any(p_group_ids)
      ))
    )
  on conflict (broadcast_id,recipient_id) do nothing;

  insert into public.direct_messages(sender_id,recipient_id,subject,body,broadcast_id)
  select v_sender,d.recipient_id,v_subject,v_body,p_broadcast
  from public.member_broadcast_deliveries d
  where d.broadcast_id=p_broadcast and d.outcome='delivered'
  on conflict (broadcast_id,recipient_id) where broadcast_id is not null do nothing;

  update public.member_broadcast_deliveries d
  set message_id=m.id
  from public.direct_messages m
  where d.broadcast_id=p_broadcast
    and m.broadcast_id=p_broadcast
    and m.recipient_id=d.recipient_id
    and d.message_id is null;

  select jsonb_build_object(
    'delivered',count(*) filter (where outcome='delivered'),
    'blocked',count(*) filter (where outcome='blocked'),
    'opted_out',count(*) filter (where outcome='opted_out')
  ) into v_result
  from public.member_broadcast_deliveries
  where broadcast_id=p_broadcast;
  return v_result;
end
$$;
revoke all on function public.deliver_member_announcement_audience(uuid,text,uuid[],uuid[])
  from public, anon, authenticated;
grant execute on function public.deliver_member_announcement_audience(uuid,text,uuid[],uuid[])
  to service_role;
