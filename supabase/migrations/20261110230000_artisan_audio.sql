-- Portfolio audio is public; purchased originals and payout identifiers are private.
alter table public.artisan_works drop constraint if exists artisan_works_kind_check;
alter table public.artisan_works add constraint artisan_works_kind_check
  check (kind in ('image', 'embed', 'link', 'audio'));

create table public.artisan_sellers (
  user_id uuid primary key references auth.users(id),
  stripe_account_id text not null unique,
  country text not null check (country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now()
);
create table public.artisan_audio_offers (
  work_id bigint primary key references public.artisan_works(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id),
  private_path text not null,
  filename text not null,
  price_cents integer not null check (price_cents between 50 and 1000000),
  currency text not null default 'usd' check (currency = 'usd'),
  license text not null check (length(license) between 10 and 3000),
  enabled boolean not null default false,
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  fee_bps integer not null check (fee_bps between 0 and 10000),
  updated_at timestamptz not null default now()
);
create table public.artisan_audio_orders (
  id uuid primary key default gen_random_uuid(),
  work_id bigint references public.artisan_works(id) on delete set null,
  buyer_user_id uuid references auth.users(id) on delete set null,
  seller_user_id uuid references auth.users(id),
  title text not null,
  private_path text not null,
  filename text not null,
  license text not null,
  terms_version text not null,
  price_cents integer not null check (price_cents between 50 and 1000000),
  immediate_delivery_requested boolean not null check (immediate_delivery_requested),
  fee_cents integer not null check (fee_cents >= 0 and fee_cents <= price_cents),
  currency text not null check (currency = 'usd'),
  stripe_account_id text not null,
  checkout_session_id text unique,
  payment_intent_id text unique,
  refund_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'refund_pending', 'refunded', 'partially_refunded', 'disputed', 'canceled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create unique index artisan_audio_one_purchase on public.artisan_audio_orders(buyer_user_id, work_id)
  where work_id is not null and status in ('pending', 'paid', 'refund_pending');
create index artisan_audio_buyer on public.artisan_audio_orders(buyer_user_id, created_at desc);
create index artisan_audio_seller on public.artisan_audio_orders(seller_user_id, created_at desc);

alter table public.artisan_sellers enable row level security;
alter table public.artisan_audio_offers enable row level security;
alter table public.artisan_audio_orders enable row level security;
revoke all on public.artisan_sellers, public.artisan_audio_offers, public.artisan_audio_orders from anon, authenticated;
grant all on public.artisan_sellers, public.artisan_audio_offers, public.artisan_audio_orders to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
 ('artisan-audio-previews', 'artisan-audio-previews', true, 15728640,
  array['audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/flac','audio/aac','audio/webm']),
 ('artisan-audio-originals', 'artisan-audio-originals', false, 52428800,
  array['audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/flac','audio/aac','audio/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "artisan audio preview read" on storage.objects for select
  using (bucket_id = 'artisan-audio-previews');
create policy "artisan audio owner upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('artisan-audio-previews','artisan-audio-originals')
    and (storage.foldername(name))[1] = auth.uid()::text);
create policy "artisan audio original owner read" on storage.objects for select to authenticated
  using (bucket_id = 'artisan-audio-originals' and (storage.foldername(name))[1] = auth.uid()::text);
-- No user update/delete policy for originals: existing purchases retain their immutable file.
create policy "artisan audio preview owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'artisan-audio-previews' and (storage.foldername(name))[1] = auth.uid()::text);
