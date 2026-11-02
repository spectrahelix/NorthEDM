-- Fee reminders for coordinator shops (utils/subscriptionReminders.ts) are sent
-- once per period per kind; these stamps make the daily cron idempotent.
alter table public.vendor_subscriptions
  add column if not exists reminded_week_at timestamptz,
  add column if not exists reminded_end_at timestamptz,
  add column if not exists reminded_lapsed_at timestamptz;
