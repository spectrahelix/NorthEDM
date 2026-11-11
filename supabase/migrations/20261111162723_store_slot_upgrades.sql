-- A single in-flight Stripe upgrade per storefront. The existing table stays
-- service-only, and the active slot limit continues to enforce catalog capacity.
alter table public.store_catalog_plans add column pending_upgrade jsonb;

create or replace function public.sync_store_plan_subscription(
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
      checkout_expires_at = null, checkout_quote_key = null, pending_upgrade = null where store_id = p_store_id;
  elsif catalog.slot_limit is distinct from p_slots then
    raise exception 'Store subscription slot limit changed outside its paid plan.';
  end if;
  update public.stores set billing_status = p_billing_status, stripe_subscription_id = p_subscription_id
    where id = p_store_id;
end $$;
