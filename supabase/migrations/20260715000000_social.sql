-- Socials: a first-class /social hub + an admin broadcast composer.
--
-- social_accounts drives the public /social page (the accounts you choose to
-- show). Broadcasting to external platforms is done by connectors configured via
-- env (Buffer for the mainstream networks that require approved apps; Discord /
-- Telegram / Mastodon webhooks/APIs for direct posting). social_posts logs each
-- broadcast + its per-connector result.

create table if not exists public.social_accounts (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null,                 -- instagram | tiktok | youtube | facebook | x | discord | ...
  label       text,                          -- handle / display text, e.g. "@northedm"
  url         text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.social_accounts enable row level security;
-- Public may read the accounts shown on /social. Writes are admin-only (service role).
drop policy if exists "public read active social accounts" on public.social_accounts;
create policy "public read active social accounts" on public.social_accounts
  for select using (active = true);

create table if not exists public.social_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid,
  text        text not null,
  image_url   text,
  results     jsonb not null default '[]',   -- [{platform, ok, detail}]
  created_at  timestamptz not null default now()
);

-- Broadcast log is admin-only (service role); no public policies.
alter table public.social_posts enable row level security;
