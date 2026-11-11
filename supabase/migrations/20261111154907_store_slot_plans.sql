-- Store-specific selections leave shared vendor inventory and legacy stores alone.
create table public.store_catalog_plans (
  store_id uuid primary key references public.stores(id) on delete cascade,
  slot_limit smallint check (slot_limit in (5, 10, 15, 30)),
  listing_groups bigint[] not null default '{}',
  stripe_subscription_id text,
  checkout_attempt uuid,
  checkout_slots smallint check (checkout_slots in (5, 10, 15, 30)),
  checkout_session_id text,
  checkout_expires_at timestamptz,
  checkout_quote_key text,
  constraint store_catalog_capacity check (
    cardinality(listing_groups) <= least(coalesce(slot_limit, 30), coalesce(checkout_slots, 30))
  )
);
alter table public.store_catalog_plans enable row level security;
revoke all on public.store_catalog_plans from public, anon, authenticated;
grant select, insert, update, delete on public.store_catalog_plans to service_role;

-- Serializes a new checkout against other checkouts and billing updates. The
-- capacity constraint also limits catalog edits while a smaller plan is pending.
create function public.reserve_store_plan_checkout(
  p_store_id uuid, p_vendor_id bigint, p_kind text, p_slots smallint,
  p_attempt uuid, p_expires_at timestamptz, p_quote_key text
) returns void language plpgsql set search_path = '' as $$
declare
  current_billing text;
  catalog public.store_catalog_plans%rowtype;
begin
  select billing_status into current_billing from public.stores where id = p_store_id for update;
  if not found then raise exception 'Store not found.'; end if;
  if current_billing = 'active' or exists (
    select 1 from public.stripe_subscriptions
    where status not in ('canceled', 'incomplete_expired') and
      ((store_id = p_store_id and kind in ('store', 'bundle')) or
       (p_kind = 'bundle' and vendor_id = p_vendor_id and kind in ('festdash', 'bundle')))
  ) then
    raise exception 'There is already a plan for this store or listing. Use Manage billing before starting a new subscription.';
  end if;
  insert into public.store_catalog_plans(store_id) values (p_store_id) on conflict do nothing;
  select * into catalog from public.store_catalog_plans where store_id = p_store_id for update;
  if catalog.checkout_attempt is not null then raise exception 'A checkout is already open for this store.'; end if;
  if cardinality(catalog.listing_groups) > p_slots then
    raise exception 'Save a selection of at most % storefront listings before choosing this plan.', p_slots;
  end if;
  update public.store_catalog_plans set checkout_attempt = p_attempt, checkout_slots = p_slots,
    checkout_expires_at = p_expires_at, checkout_quote_key = p_quote_key where store_id = p_store_id;
end $$;

-- The initial entitlement needs a bound, verified checkout. Existing
-- subscriptions can update their billing status without replacing the catalog.
create function public.sync_store_plan_subscription(
  p_store_id uuid, p_slots smallint, p_attempt uuid, p_subscription_id text,
  p_billing_status text, p_can_activate boolean
) returns void language plpgsql set search_path = '' as $$
declare
  catalog public.store_catalog_plans%rowtype;
begin
  perform id from public.stores where id = p_store_id for update;
  if not found then raise exception 'Store not found.'; end if;
  select * into catalog from public.store_catalog_plans where store_id = p_store_id for update;
  if not found then raise exception 'Store checkout record missing.'; end if;
  if catalog.stripe_subscription_id is distinct from p_subscription_id then
    if not p_can_activate or p_billing_status <> 'active' then return; end if;
    if catalog.checkout_attempt is distinct from p_attempt or catalog.checkout_slots is distinct from p_slots
       or catalog.checkout_session_id is null then
      raise exception 'Store subscription does not match its checkout.';
    end if;
    update public.store_catalog_plans set slot_limit = p_slots, stripe_subscription_id = p_subscription_id,
      checkout_attempt = null, checkout_slots = null, checkout_session_id = null,
      checkout_expires_at = null, checkout_quote_key = null where store_id = p_store_id;
  elsif catalog.slot_limit is distinct from p_slots then
    raise exception 'Store subscription slot limit changed outside checkout.';
  end if;
  update public.stores set billing_status = p_billing_status, stripe_subscription_id = p_subscription_id
    where id = p_store_id;
end $$;

revoke all on function public.reserve_store_plan_checkout(uuid, bigint, text, smallint, uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function public.sync_store_plan_subscription(uuid, smallint, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.reserve_store_plan_checkout(uuid, bigint, text, smallint, uuid, timestamptz, text) to service_role;
grant execute on function public.sync_store_plan_subscription(uuid, smallint, uuid, text, text, boolean) to service_role;
