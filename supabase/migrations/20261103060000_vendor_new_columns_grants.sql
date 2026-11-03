-- vendors has column-level SELECT grants (the private columns are revoked), so
-- every NEW column is invisible to anon/authenticated until granted. The
-- pickup columns shipped without a grant and the FestDash vendor list, which
-- embeds vendors through the user's session, came back empty for everyone
-- (2026-11-03, caught within the hour). Public-safe columns get the grant;
-- signup_code and stripe_account_id stay service-role only.
grant select (pickup_location, fulfillment_modes, area) on public.vendors to anon, authenticated;
