-- RLS fix: bookings + requests had RLS enabled with ZERO policies, so both the
-- public submit forms (anon INSERT via the SSR client) and the admin dashboards
-- (authenticated SELECT) were silently denied — same class of bug as products.
--
-- Fix: anyone may submit (these are open intake forms, like contact forms); only
-- admins may read/manage them (they contain PII, so no public reads).

drop policy if exists "public submit booking" on public.bookings;
drop policy if exists "admin read bookings" on public.bookings;
drop policy if exists "admin manage bookings" on public.bookings;
drop policy if exists "public submit request" on public.requests;
drop policy if exists "admin read requests" on public.requests;
drop policy if exists "admin manage requests" on public.requests;

-- bookings
create policy "public submit booking" on public.bookings
  for insert with check (true);
create policy "admin read bookings" on public.bookings
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role in ('archon', 'warden'))
    or (auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
  );
create policy "admin manage bookings" on public.bookings
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role in ('archon', 'warden'))
    or (auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
  );

-- requests
create policy "public submit request" on public.requests
  for insert with check (true);
create policy "admin read requests" on public.requests
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role in ('archon', 'warden'))
    or (auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
  );
create policy "admin manage requests" on public.requests
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role in ('archon', 'warden'))
    or (auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
  );
