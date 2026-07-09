-- Personal info on the profile, used to auto-fill checkout screens (FestDash
-- orders, shop). User-owned data on their own row (standard RLS applies).
alter table public.user_profiles
  add column if not exists full_name     text,
  add column if not exists phone         text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city          text,
  add column if not exists region        text,   -- state / province
  add column if not exists postal_code   text;
