-- Apply before deploying the two-party FestDash handoff. Codes never live on
-- order rows or the realtime publication: only the service role can read them.
create table if not exists public.festdash_handoffs (
  order_id uuid primary key references public.festdash_orders(id) on delete cascade,
  customer_code text not null check (customer_code ~ '^[0-9]{4}$'),
  fulfiller_code text not null check (fulfiller_code ~ '^[0-9]{4}$' and fulfiller_code <> customer_code),
  fulfiller_user_id uuid references auth.users(id),
  customer_confirmed_at timestamptz,
  fulfiller_confirmed_at timestamptz,
  customer_attempts integer not null default 0 check (customer_attempts between 0 and 10),
  fulfiller_attempts integer not null default 0 check (fulfiller_attempts between 0 and 10),
  problem_reported_at timestamptz,
  problem_reported_by uuid references auth.users(id),
  problem_reason text,
  settled_at timestamptz,
  last_error text,
  stripe_refund_id text,
  created_at timestamptz not null default now()
);
alter table public.festdash_handoffs enable row level security;
revoke all on public.festdash_handoffs from public, anon, authenticated;
grant select, insert, update, delete on public.festdash_handoffs to service_role;

-- Every confirmation locks the order first, then its private handoff record.
-- Cancellation uses a conditional order update, so it cannot race a completed
-- handoff. Failed guesses are committed, not rolled back in an exception.
create or replace function public.festdash_handoff(
  p_order_id uuid, p_actor_id uuid, p_action text,
  p_code text, p_customer_code text, p_fulfiller_code text,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.festdash_orders%rowtype;
  h public.festdash_handoffs%rowtype;
  party text;
  attempts integer;
  already_confirmed boolean;
  problem_new boolean := false;
begin
  select * into o from public.festdash_orders where id = p_order_id for update;
  if not found or o.customer_id is null then
    return jsonb_build_object('ok', false, 'http_status', 404, 'error', 'Order not found.');
  end if;
  if p_actor_id = o.customer_id then
    party := 'customer';
  elsif o.fulfillment = 'pickup' and (
    exists (select 1 from public.user_profiles where id = p_actor_id and vendor_id = o.vendor_id)
    or exists (select 1 from public.vendors where id = o.vendor_id and user_id = p_actor_id)
  ) then
    party := 'fulfiller';
  elsif o.fulfillment <> 'pickup' and o.driver_id = p_actor_id and exists (
    select 1 from public.festdash_drivers where user_id = p_actor_id and is_active
  ) then
    party := 'fulfiller';
  else
    return jsonb_build_object('ok', false, 'http_status', 403, 'error', 'Only the customer and assigned Dasher (or pickup shop) may confirm this handoff.');
  end if;
  if p_action not in ('view', 'confirm', 'problem') then
    return jsonb_build_object('ok', false, 'http_status', 400, 'error', 'Invalid handoff action.');
  end if;
  if p_action = 'view' and o.status = 'delivered' and not exists (select 1 from public.festdash_handoffs where order_id = p_order_id) then
    return jsonb_build_object('ok', true, 'party', party, 'legacy', true,
      'own_code', null, 'order_status', o.status, 'payment_status', o.payment_status);
  end if;

  insert into public.festdash_handoffs (order_id, customer_code, fulfiller_code)
    values (p_order_id, p_customer_code, p_fulfiller_code) on conflict (order_id) do nothing;
  select * into h from public.festdash_handoffs where order_id = p_order_id for update;
  if party = 'fulfiller' then
    if h.fulfiller_user_id is not null and h.fulfiller_user_id <> p_actor_id then
      return jsonb_build_object('ok', false, 'http_status', 409, 'error', 'Another shop operator is handling this pickup. Contact NorthEDM if the handoff must change.');
    end if;
    update public.festdash_handoffs set fulfiller_user_id = p_actor_id where order_id = p_order_id;
    h.fulfiller_user_id := p_actor_id;
  end if;

  if p_action = 'problem' then
    if o.status not in ('pending', 'accepted', 'in_transit') then
      return jsonb_build_object('ok', false, 'http_status', 409, 'error', 'Use order support for a completed or closed order.');
    end if;
    problem_new := h.problem_reported_at is null;
    update public.festdash_handoffs set problem_reported_at = coalesce(problem_reported_at, now()),
      problem_reported_by = p_actor_id, problem_reason = left(trim(coalesce(p_reason, 'Handoff problem')), 500)
      where order_id = p_order_id returning * into h;
  elsif p_action = 'confirm' then
    if h.problem_reported_at is not null then
      return jsonb_build_object('ok', false, 'http_status', 409, 'error', 'Payment is paused because a handoff problem was reported. Contact NorthEDM.');
    end if;
    already_confirmed := case when party = 'customer' then h.customer_confirmed_at is not null else h.fulfiller_confirmed_at is not null end;
    if not (o.status = 'delivered' and h.customer_confirmed_at is not null and h.fulfiller_confirmed_at is not null)
       and o.status not in ('accepted', 'in_transit') then
      return jsonb_build_object('ok', false, 'http_status', 409, 'error', 'This order is not ready for handoff.');
    end if;
    if not already_confirmed then
      attempts := case when party = 'customer' then h.customer_attempts else h.fulfiller_attempts end;
      if attempts >= 10 then
        return jsonb_build_object('ok', false, 'http_status', 429, 'error', 'Too many incorrect codes. Confirmation is locked; contact NorthEDM.');
      end if;
      if coalesce(p_code, '') !~ '^[0-9]{4}$' or p_code <> (case when party = 'customer' then h.fulfiller_code else h.customer_code end) then
        if party = 'customer' then
          update public.festdash_handoffs set customer_attempts = customer_attempts + 1 where order_id = p_order_id;
        else
          update public.festdash_handoffs set fulfiller_attempts = fulfiller_attempts + 1 where order_id = p_order_id;
        end if;
        return jsonb_build_object('ok', false, 'http_status', 422, 'error', 'Incorrect handoff code.', 'attempts_remaining', 9 - attempts);
      end if;
      if party = 'customer' then
        update public.festdash_handoffs set customer_confirmed_at = now() where order_id = p_order_id returning * into h;
      else
        update public.festdash_handoffs set fulfiller_confirmed_at = now() where order_id = p_order_id returning * into h;
      end if;
    end if;
    if h.customer_confirmed_at is not null and h.fulfiller_confirmed_at is not null and o.status <> 'delivered' then
      update public.festdash_orders set status = 'delivered', confirmed_at = now(), updated_at = now() where id = p_order_id;
      o.status := 'delivered';
    end if;
  end if;
  return jsonb_build_object('ok', true, 'party', party,
    'own_code', case when o.status in ('delivered', 'declined') then null when party = 'customer' then h.customer_code else h.fulfiller_code end,
    'customer_confirmed', h.customer_confirmed_at is not null,
    'fulfiller_confirmed', h.fulfiller_confirmed_at is not null,
    'ready', h.customer_confirmed_at is not null and h.fulfiller_confirmed_at is not null and h.problem_reported_at is null,
    'problem_reported', h.problem_reported_at is not null,
    'problem_new', problem_new,
    'locked', case when party = 'customer' then h.customer_attempts >= 10 else h.fulfiller_attempts >= 10 end,
    'order_status', o.status, 'payment_status', o.payment_status);
end;
$$;
revoke all on function public.festdash_handoff(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.festdash_handoff(uuid, uuid, text, text, text, text, text) to service_role;

-- A buggy or stale route cannot release payment with only one confirmation.
create or replace function public.guard_festdash_handoff_release()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (new.status = 'delivered' and old.status is distinct from 'delivered')
    or (new.payment_status in ('capturing', 'released') and old.payment_status is distinct from new.payment_status) then
    if not exists (select 1 from public.festdash_handoffs where order_id = new.id
      and customer_confirmed_at is not null and fulfiller_confirmed_at is not null and problem_reported_at is null) then
      raise exception 'Both parties must confirm the handoff before delivery or payment release';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_festdash_handoff_release() from public, anon, authenticated;
drop trigger if exists guard_festdash_handoff_release on public.festdash_orders;
create trigger guard_festdash_handoff_release before update of status, payment_status on public.festdash_orders
  for each row execute function public.guard_festdash_handoff_release();

-- Retire phone-derived codes for all unfinished orders. Existing completed
-- transactions remain historical records and are not charged or refunded here.
update public.festdash_orders set confirmation_code = null where status not in ('delivered', 'declined');
