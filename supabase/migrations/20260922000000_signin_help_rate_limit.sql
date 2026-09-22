-- Sign-in help is the one submission path open to guests, so it is the one
-- path a crawler can reach. Three crawler sessions hit it on 2026-09-21/22.
-- Recording the client IP is what makes a per-IP rate limit possible; without
-- it the only options are "open" or "closed".
alter table public.error_reports
  add column if not exists client_ip text;

-- The rate limit counts recent rows for one IP on one source. Without this the
-- check is a full scan on every submission.
create index if not exists error_reports_source_ip_created_idx
  on public.error_reports (source, client_ip, created_at desc);

comment on column public.error_reports.client_ip is
  'Client IP for guest submissions (source=signin-help), used only for rate limiting. Null when the proxy header was absent — never collapse nulls into one bucket.';
