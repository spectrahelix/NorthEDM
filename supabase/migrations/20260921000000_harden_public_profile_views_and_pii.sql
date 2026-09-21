-- Two separate problems the Supabase advisor surfaced as one.
--
-- 1. THE VIEWS RAN AS DEFINER. public.vendors_public and
--    public.user_profiles_public executed with the owner's rights, bypassing
--    RLS for whoever queried them. Both base tables already carry public read
--    policies that permit exactly the rows these views expose, so running them
--    as the caller changes nothing about what is visible and makes the security
--    model honest — RLS is enforced once, in one place. Verified after the
--    change: anon still reads both views normally.
--
-- 2. THE PROJECTION WASN'T PROTECTING ANYTHING. user_profiles_public exists to
--    publish a safe subset of columns, but the "public read profiles" policy
--    (roles {public}, USING true) let anon SELECT the base table directly,
--    columns and all. full_name, phone, address_line1/2, city, region,
--    postal_code, pending_email and email_change_token were all reachable with
--    the anon key that ships in the site's own JavaScript.
--
--    They are null for every user today, so nothing has leaked — but the first
--    store checkout that saves a shipping address would have published it.
--
--    Fixed with a column-level grant rather than by touching the row policies:
--    the app reads profiles for display names all over the place, and those
--    reads must keep working. anon keeps exactly the columns the public site
--    renders and loses the rest.
--
-- STILL OPEN, deliberately: `authenticated` retains full column access to
-- user_profiles, so a signed-in user could read another user's contact columns
-- once any exist. Closing that means routing cross-user reads through
-- user_profiles_public, which overlaps the pending profiles/user_profiles
-- consolidation — see docs/CODE_AUDIT.md. Tracked, not forgotten.

alter view public.vendors_public set (security_invoker = true);
alter view public.user_profiles_public set (security_invoker = true);

comment on view public.user_profiles_public is
  'Safe public projection of user_profiles: identity and badges only, no contact or address columns. security_invoker=true so RLS is enforced as the caller.';
comment on view public.vendors_public is
  'Approved, public vendors with phone masked unless show_phone. security_invoker=true so RLS is enforced as the caller.';

revoke select on public.user_profiles from anon;
grant select (
  id, display_name, avatar_url, avatar_border, bio, home_city, role, created_at,
  avatar_config, stage_name, pronouns, website, socials, hidden_tags, hide_shows,
  is_artisan, artisan_craft, artisan_statement, is_vendor, is_festdash_vendor,
  is_promoter, is_founder, is_verified, is_forager, is_driver
) on public.user_profiles to anon;
