-- Editable welcome DM variants and a one-time delivery record.
-- Delivery is opt-in and runs only after confirmed auth, not during signup request.
create table if not exists public.welcome_dm_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  sender_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.welcome_dm_settings (id) values (true) on conflict do nothing;

create table if not exists public.welcome_dm_templates (
  id smallint primary key check (id between 1 and 4),
  title text not null,
  subject text not null check (char_length(subject) between 1 and 100),
  body text not null check (char_length(body) between 1 and 3000),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.welcome_dm_templates (id,title,subject,body) values
(1,'Forest welcome','Welcome to NorthEDM! 🌲','Hey {name}, welcome to NorthEDM! We’re building a home for music lovers, curious minds, artisans, and explorers across the Northeast. Start by adding a profile photo and a little about yourself at /profile/edit, then introduce yourself in the community Forum at /forum: where you’re from, what you create or enjoy, and what brought you here. Explore local shows at /events, meet makers in /artisans, and browse /marketplace. Glad you found your way into the forest. 🌿 Unite the Northeast!'),
(2,'Festival family','You’re part of the NorthEDM family! 🎶','What’s up, {name}? Welcome to NorthEDM — a meeting place for people who believe music and community can bring the Northeast together. Tell us about yourself! Update your profile at /profile/edit, then say hello on /forum. Share your hometown, favorite music, skills or hobbies, and what you’d love to discover here. Check out /events for upcoming happenings, /feed for community posts, and /vendors to find local businesses. PLUR, and we’re happy you’re here!'),
(3,'Explorer greeting','Your NorthEDM adventure begins ✨','Hey {name}! You’ve officially joined NorthEDM. Whether you’re into festivals, forests, creativity, or connecting with new people, there’s room for you here. Set up your profile at /profile/edit and introduce yourself on /forum — tell the community who you are, where you’re from, and what sparks your curiosity. Take a look at /foraging for guided nature experiences, /apps-and-tools for fun interactive features, and /artisans to discover creative professionals. Welcome aboard — Unite the Northeast!'),
(4,'Community spotlight','Glad you joined us, {name}! 💜','Welcome in, {name}! NorthEDM is all about lifting each other up, sharing knowledge, and strengthening our regional creative community. Make your profile your own at /profile/edit, then post an introduction in /forum. A great intro includes your interests, your general area, and whether you’re here to discover events, make friends, show off your craft, or support local makers. Browse /crowdwave, explore the /marketplace, and follow what’s new on /feed. We can’t wait to see what you bring to the community. PLUR!')
on conflict (id) do nothing;

create table if not exists public.welcome_dm_deliveries (
  recipient_id uuid primary key references auth.users(id) on delete cascade,
  template_id smallint not null references public.welcome_dm_templates(id),
  message_id bigint references public.direct_messages(id) on delete set null,
  delivered_at timestamptz not null default now()
);
alter table public.welcome_dm_settings enable row level security;
alter table public.welcome_dm_templates enable row level security;
alter table public.welcome_dm_deliveries enable row level security;
revoke all on public.welcome_dm_settings,public.welcome_dm_templates,public.welcome_dm_deliveries from anon,authenticated;
grant select,insert,update,delete on public.welcome_dm_settings,public.welcome_dm_templates,public.welcome_dm_deliveries to service_role;

-- A single transaction makes the welcome and its deduplication record atomic.
-- No SECURITY DEFINER: the caller is a verified server-side service-role client.
create or replace function public.deliver_signup_welcome(p_recipient uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sender uuid;
  v_name text;
  v_template_id smallint;
  v_subject text;
  v_body text;
  v_msg bigint;
  v_count integer;
  v_index integer;
begin
  select sender_id into v_sender
  from public.welcome_dm_settings where id = true and enabled = true;
  if v_sender is null or v_sender = p_recipient then return false; end if;
  if not exists (
    select 1 from auth.users where id = p_recipient and email_confirmed_at is not null
  ) then return false; end if;
  if not exists (select 1 from public.user_profiles where id = p_recipient) then return false; end if;
  if exists (select 1 from public.message_blocks where
    (blocker_id=p_recipient and blocked_id=v_sender) or
    (blocker_id=v_sender and blocked_id=p_recipient)) then return false; end if;
  if exists (select 1 from public.welcome_dm_deliveries where recipient_id=p_recipient) then return false; end if;
  select count(*) into v_count from public.welcome_dm_templates where active;
  if v_count=0 then return false; end if;
  v_index := get_byte(decode(md5(p_recipient::text),'hex'),0) % v_count;
  select id, subject, body into v_template_id,v_subject,v_body
  from public.welcome_dm_templates where active order by id offset v_index limit 1;
  select coalesce(nullif(trim(display_name),''),'friend') into v_name
  from public.user_profiles where id=p_recipient;
  v_name := left(coalesce(v_name,'friend'),60);
  -- Claim once; if a concurrent request already claimed it, exit without DM.
  insert into public.welcome_dm_deliveries(recipient_id,template_id)
    values(p_recipient,v_template_id) on conflict do nothing;
  if not found then return false; end if;
  insert into public.direct_messages(sender_id,recipient_id,subject,body)
    values(v_sender,p_recipient,replace(v_subject,'{name}',v_name),replace(v_body,'{name}',v_name))
    returning id into v_msg;
  update public.welcome_dm_deliveries set message_id=v_msg where recipient_id=p_recipient;
  return true;
end
$$;
revoke all on function public.deliver_signup_welcome(uuid) from public,anon,authenticated;
grant execute on function public.deliver_signup_welcome(uuid) to service_role;
