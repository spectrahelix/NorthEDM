-- Access hardening from the 2026-11-01 security audit.
-- Every change here closes a path an ordinary session had around the server
-- routes. Nothing is dropped; reversible by re-granting / re-altering.

-- 1. FestDash orders ---------------------------------------------------------
-- Orders are created and moved between states only by the server routes
-- (service role): /api/festdash/orders prices every line from `products` and
-- gates the vendor; /api/festdash/orders/[id] enforces the state machine and
-- the delivery code, then settles the card hold. The one end-user write left
-- is the assigned runner's live position.
alter policy "Authenticated users can place orders" on public.festdash_orders with check (false);
alter policy "Vendors update their order status" on public.festdash_orders using (false);
revoke insert, update, delete on table public.festdash_orders from anon, authenticated;
grant update (driver_lat, driver_lng, location_updated_at) on table public.festdash_orders to authenticated;

-- 2. Runners -----------------------------------------------------------------
-- Self-registration lands inactive; the owner activates in /admin/festdash.
-- An active runner sees every open order's campsite details, so activation is
-- a decision, not a default.
alter table public.festdash_drivers alter column is_active set default false;
alter table public.festdash_drivers add column if not exists approved_at timestamptz;

create or replace function public.protect_runner_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.is_active := false;
      new.approved_at := null;
    else
      new.is_active := old.is_active;
      new.approved_at := old.approved_at;
    end if;
  end if;
  return new;
end
$$;

create trigger trg_protect_runner_activation
  before insert or update on public.festdash_drivers
  for each row execute function public.protect_runner_activation();

revoke insert, update, delete on table public.festdash_drivers from anon;

-- 3. user_profiles: personal columns are the owner's and the service role's ---
-- Signed-in sessions keep reading the public profile columns of everyone
-- (forum, messages, artisans). Name, phone, address and the pending email
-- change are no longer in that set; the owner reads their own through the
-- RPC below. `select("*")` on user_profiles now fails for ordinary sessions.
revoke select on table public.user_profiles from authenticated;
grant select (
  id, display_name, avatar_url, avatar_border, bio, home_city, role, created_at, avatar_config,
  signup_alerted, is_artisan, artisan_status, artisan_applied_at, stage_name, artisan_craft,
  artisan_statement, pronouns, website, socials, is_vendor, vendor_id, is_marketplace,
  is_festdash_vendor, is_promoter, is_founder, is_driver, is_forager, is_verified,
  hidden_tags, hide_shows, username
) on table public.user_profiles to authenticated;
revoke insert, update, delete on table public.user_profiles from anon;

create or replace function public.my_private_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'full_name', p.full_name, 'phone', p.phone,
      'address_line1', p.address_line1, 'address_line2', p.address_line2,
      'city', p.city, 'region', p.region, 'postal_code', p.postal_code,
      'pending_email', p.pending_email)
    from public.user_profiles p
    where p.id = auth.uid()
  ), '{}'::jsonb)
$$;
revoke execute on function public.my_private_profile() from public, anon;
grant execute on function public.my_private_profile() to authenticated;

-- 4. vendors: personal contact is for the vendor, admins and the service role --
-- Public pages show `business_email`; the personal `email`, `first_name` and
-- `last_name` come back only through the RPC. Applications are inserted by
-- /api/vendors with the service role after its bot checks, so the open insert
-- policy (which let anyone write rows straight past those checks) is closed.
revoke select on table public.vendors from anon, authenticated;
grant select (
  id, name, category, description, capacity, contact, vendor_type, is_public, is_founder,
  status, created_at, user_id, phone, show_phone, website, wants_public, suspended_at,
  suspended_reason, business_email, accent_color
) on table public.vendors to anon, authenticated;
alter policy "public apply as vendor" on public.vendors with check (false);
revoke insert, delete on table public.vendors from anon, authenticated;
revoke update on table public.vendors from anon;

create or replace function public.vendor_private_contact(p_vendor_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object('email', v.email, 'first_name', v.first_name, 'last_name', v.last_name)
    from public.vendors v
    where v.id = p_vendor_id
      and (v.user_id = auth.uid() or public.is_site_admin())
  ), '{}'::jsonb)
$$;
revoke execute on function public.vendor_private_contact(bigint) from public, anon;
grant execute on function public.vendor_private_contact(bigint) to authenticated;

-- 5. Storage: uploads stay in the uploader's own folder; images only; size cap --
alter policy "Auth upload festdash photos" on storage.objects
  with check (bucket_id = 'festdash-campsites' and (auth.uid())::text = (storage.foldername(name))[1]);
alter policy "artisan-works auth insert" on storage.objects
  with check (bucket_id = 'artisan-works' and (auth.uid())::text = (storage.foldername(name))[1]);
alter policy "artisan-works auth update" on storage.objects
  using (bucket_id = 'artisan-works' and (auth.uid())::text = (storage.foldername(name))[1]);
alter policy "artisan-works auth delete" on storage.objects
  using (bucket_id = 'artisan-works' and (auth.uid())::text = (storage.foldername(name))[1]);
update storage.buckets
   set file_size_limit = 15728640,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']
 where id in ('avatars', 'festdash-campsites', 'artisan-works', 'shop-products');

notify pgrst, 'reload schema';
