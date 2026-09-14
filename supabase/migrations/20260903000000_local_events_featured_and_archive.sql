-- Local Events: catch the schema up to what production already has, and index
-- for the two queries the ingest and the public page actually run.
--
-- `featured` and `vendor_ids` were added directly to production while wiring up
-- the Karnival of the Arts highlight, so a fresh environment (or a Supabase
-- branch) would come up without them and break /events. This file is the
-- missing record — written idempotently so it's a no-op against production.

alter table public.local_events
  add column if not exists featured   boolean not null default false,
  add column if not exists vendor_ids bigint[];

comment on column public.local_events.featured is
  'Pinned to the top of /events with a ★ badge. Cleared automatically when the event is archived.';
comment on column public.local_events.vendor_ids is
  'NorthEDM vendor ids with a booth on site, rendered as the "vendors on site" callout.';

-- The nightly ingest archives finished events by scanning approved rows by
-- date, and the public page reads approved rows ordered by featured then date.
create index if not exists local_events_status_end_idx
  on public.local_events (status, end_date);

create index if not exists local_events_featured_idx
  on public.local_events (status, featured desc, start_date);

-- 'archived' joins 'pending' | 'approved' | 'hidden' as a status. It is not a
-- CHECK constraint (the column never had one) — this comment is the contract.
comment on column public.local_events.status is
  'pending | approved | hidden | archived. Public RLS exposes approved only; archived rows are kept as the standing venue/show record.';

-- Structural guard against duplicate listings. dedup_key is the ingest's own
-- idea of identity, but a hand-written INSERT can compute it differently — that
-- is exactly how a second "Karnival of the Arts" nearly reached /events. This
-- index makes the real-world identity (same name, same town, same day) unique
-- regardless of how the caller derived its key.
create unique index if not exists local_events_identity_uidx
  on public.local_events (
    lower(btrim(name)),
    coalesce(lower(btrim(city)), ''),
    coalesce(start_date, date '1900-01-01')
  );
