-- Richer bug reports: enough structure for the owner to actually action a report,
-- plus opt-in contact details for follow-up.
--
-- Adds the fields the triage flow was missing: a title, the page the reporter says
-- the bug happened on (manual entry — the auto-captured page_url is where the form
-- was opened, which isn't always the same), what they were doing, who they are, and
-- consented contact info. `source` distinguishes the 🐞 report tool from the
-- feedback form.

alter table public.error_reports
  add column if not exists title            text,
  add column if not exists page_manual      text,   -- reporter-stated location of the bug
  add column if not exists doing_what       text,   -- what they were doing when it happened
  add column if not exists reporter_name    text,
  add column if not exists contact_consent  boolean not null default false,
  add column if not exists contact_email    text,
  add column if not exists contact_phone    text,
  add column if not exists contact_dm       boolean not null default false,
  add column if not exists source           text not null default 'report';  -- report | feedback

create index if not exists error_reports_source_idx on public.error_reports (source, created_at desc);
