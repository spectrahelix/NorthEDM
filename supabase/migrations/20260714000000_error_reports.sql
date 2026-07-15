-- User error reports ("Report a problem"). A reporter uploads a screenshot +
-- note; the app auto-attaches page URL, browser, viewport, the logged-in user
-- (if any), and any JS errors captured on the page. Reports land here and are
-- triaged in /admin/bug-reports. Anyone (incl. logged-out) can report.

create table if not exists public.error_reports (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid,                               -- nullable: anon reports allowed
  email            text,
  description      text,
  screenshot_url   text,
  page_url         text,
  user_agent       text,
  viewport         text,
  console_errors   jsonb not null default '[]',
  status           text not null default 'new',        -- new | triaged | fixed | dismissed
  github_issue_url text,
  created_at       timestamptz not null default now()
);

create index if not exists error_reports_status_idx on public.error_reports (status, created_at desc);

-- Service-role only: the /api/report route inserts via the service role (so anon
-- users can report), and /admin/bug-reports reads via the service role.
alter table public.error_reports enable row level security;
