-- Live updates for the notification bell and messages.
--
-- NotificationBell and MessagesBadge / the messages page subscribe to
-- postgres_changes on these tables, but supabase_realtime only published
-- festdash_orders, so no INSERT was ever broadcast and the bell only changed
-- on a page refresh. Verified 2026-10-18 as the test account: subscribed,
-- notification inserted, 0 events in 63s; after this change the event arrived
-- the same second, and a logged-out listener received nothing (Realtime
-- applies each table's SELECT RLS: own notifications only; DMs to sender and
-- recipient only).
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.direct_messages;
