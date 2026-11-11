-- Allow portfolio uploads and creator onboarding to ship independently of live
-- checkout. This also blocks older preview deployments at the database layer.
create table public.artisan_audio_config (
  id integer primary key check (id = 1),
  sales_enabled boolean not null default false
);
insert into public.artisan_audio_config(id, sales_enabled) values (1, false);
alter table public.artisan_audio_config enable row level security;
revoke all on public.artisan_audio_config from public, anon, authenticated, service_role;
grant select on public.artisan_audio_config to service_role;

create schema if not exists private;
create function private.guard_artisan_audio_sales()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.artisan_audio_config where id = 1 and sales_enabled) then
    raise exception 'Audio purchases await payment verification' using errcode = '55000';
  end if;
  return new;
end $$;
revoke all on function private.guard_artisan_audio_sales() from public, anon, authenticated;
grant execute on function private.guard_artisan_audio_sales() to service_role;

create trigger guard_new_artisan_audio_order before insert on public.artisan_audio_orders
  for each row execute function private.guard_artisan_audio_sales();
create trigger guard_enabled_artisan_audio_offer before insert or update on public.artisan_audio_offers
  for each row when (new.enabled) execute function private.guard_artisan_audio_sales();

-- Leave sales disabled. After a separate staging provider test passes, an
-- operator can enable the production row with a reviewed migration. The app
-- service role can read this setting but cannot change it.
