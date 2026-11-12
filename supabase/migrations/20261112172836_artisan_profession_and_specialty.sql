alter table public.user_profiles
  add column artisan_profession text check (char_length(artisan_profession) <= 80),
  add column artisan_specialty text check (char_length(artisan_specialty) <= 120);

grant select (artisan_profession, artisan_specialty) on public.user_profiles to anon, authenticated;
