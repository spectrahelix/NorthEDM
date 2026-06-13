create table if not exists public.display_name_history (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  changed_at timestamptz not null default now()
);

create index if not exists display_name_history_user_id_idx on public.display_name_history(user_id, changed_at desc);

alter table public.display_name_history enable row level security;

create policy "Name history is public read"
  on public.display_name_history for select using (true);

create policy "Users insert own name history"
  on public.display_name_history for insert
  with check (auth.uid() = user_id);
