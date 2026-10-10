-- Applicant's own name, separate from the business. vendors.name is the
-- BUSINESS title shown publicly; the first real vendor typed a person's name
-- into a field labelled only "Name", so his listing read as that person.
alter table public.vendors
  add column if not exists first_name text,
  add column if not exists last_name  text;

comment on column public.vendors.name is
  'Business or brand name — the public title of this vendor. Not a person''s name; see first_name / last_name.';

-- "vendor update own" lets a linked vendor update their own row, and nothing
-- protected the columns only an admin should set. A vendor could, with one
-- direct API call, approve themselves, make themselves public or featured,
-- mark themselves a founder, or CLEAR THEIR OWN SUSPENSION — which would make
-- suspending for an unpaid invoice meaningless.
--
-- The line is drawn on the request, not the role: everything arriving through
-- the API carries JWT claims (anon and signed-in alike), and only a direct
-- database session — migrations, the SQL editor — has none. A first version
-- exempted current_user = 'postgres', but inside a SECURITY DEFINER function
-- current_user is always the owner, so that exemption matched everyone and the
-- guard blocked nothing. Testing it as a vendor caught it.
--
-- Verified in a rolled-back transaction, a linked vendor editing their own row:
--   name, description      -> changed (allowed)
--   status, is_public,
--   vendor_type, is_founder -> unchanged
--   suspension             -> still suspended
-- and the service role (every admin action) can still approve and unsuspend.
create or replace function public.protect_vendor_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  via_api boolean := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '') <> '';
begin
  if via_api and coalesce(auth.role(), '') <> 'service_role' then
    new.status           := old.status;
    new.is_public        := old.is_public;
    new.is_founder       := old.is_founder;
    new.vendor_type      := old.vendor_type;
    new.suspended_at     := old.suspended_at;
    new.suspended_reason := old.suspended_reason;
    new.user_id          := old.user_id;
    new.created_at       := old.created_at;
  end if;
  return new;
end;
$$;

create trigger protect_vendor_admin_fields
  before update on public.vendors
  for each row execute function public.protect_vendor_admin_fields();
