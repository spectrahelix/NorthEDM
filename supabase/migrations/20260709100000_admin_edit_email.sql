-- Admin "take the wheel": support an email change that is verified at the NEW
-- address before it hard-saves. The admin flow stores a pending email + token
-- (service role only); the verify endpoint confirms and swaps the auth email.

alter table public.user_profiles
  add column if not exists pending_email        text,
  add column if not exists email_change_token   text,
  add column if not exists email_change_expires timestamptz;

-- Extend the role-flag guard to also protect the pending-email fields so users
-- can't self-populate them and skip the "verify at the new address" step.
create or replace function public.protect_role_flags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.is_artisan          := old.is_artisan;
    new.is_vendor           := old.is_vendor;
    new.is_festdash_vendor  := old.is_festdash_vendor;
    new.is_promoter         := old.is_promoter;
    new.is_founder          := old.is_founder;
    new.pending_email        := old.pending_email;
    new.email_change_token   := old.email_change_token;
    new.email_change_expires := old.email_change_expires;
  end if;
  return new;
end $$;
