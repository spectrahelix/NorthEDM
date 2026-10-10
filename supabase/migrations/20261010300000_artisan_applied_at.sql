-- Artisan applications had no "applied" timestamp. user_profiles.created_at is
-- when the ACCOUNT was made, so using it would show someone who joined in June
-- and applied today as having waited four months.
--
-- Artisans apply from the browser by setting artisan_status = 'pending'
-- directly, so a date sent from the client could be forged. The database
-- stamps it instead, at the moment the status becomes pending, and ignores any
-- value a client tries to write.
--
-- Verified in a rolled-back transaction: a forged date without applying is
-- ignored (NULL), applying stamps now(), and a later forged edit leaves the
-- stamp unchanged.
alter table public.user_profiles
  add column if not exists artisan_applied_at timestamptz;

comment on column public.user_profiles.artisan_applied_at is
  'When this person last applied to be an artisan. Set only by the stamp_artisan_applied_at trigger.';

create or replace function public.stamp_artisan_applied_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.artisan_applied_at := case when new.artisan_status = 'pending' then now() end;
  elsif new.artisan_status = 'pending' and old.artisan_status is distinct from 'pending' then
    new.artisan_applied_at := now();
  else
    -- Not a fresh application: keep whatever was there, regardless of input.
    new.artisan_applied_at := old.artisan_applied_at;
  end if;
  return new;
end;
$$;

create trigger stamp_artisan_applied_at
  before insert or update on public.user_profiles
  for each row execute function public.stamp_artisan_applied_at();
