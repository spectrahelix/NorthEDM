-- Security hardening surfaced by the post-change audit (Supabase advisors).
--
-- 1. Pin search_path on SECURITY DEFINER / trigger functions. A mutable search_path
--    lets a caller shadow a referenced object and run their own code with the
--    function's privileges. This matters most on commission_release_guard, which is
--    what enforces the refund-protection window.
alter function public.commission_release_guard()           set search_path = public;
alter function public.protect_privileged_profile_columns() set search_path = public;
alter function public.normalize_vendor_website()           set search_path = public;
alter function public.touch_local_events_updated_at()      set search_path = public;

-- 2. Trigger functions should not be callable as PostgREST RPCs. Postgres grants
--    EXECUTE to PUBLIC by default (which anon/authenticated inherit), so these were
--    reachable at /rest/v1/rpc/<fn>. Revoking from PUBLIC closes that surface.
--    Triggers are unaffected: they fire as the table owner, not the calling role
--    (verified live — a user_profiles update still runs its triggers afterwards).
revoke execute on function public.handle_new_user()               from public, anon, authenticated;
revoke execute on function public.increment_thread_reply_count()  from public, anon, authenticated;
revoke execute on function public.notify_thread_author_on_reply() from public, anon, authenticated;
revoke execute on function public.protect_artisan_verification()  from public, anon, authenticated;
revoke execute on function public.protect_role_flags()            from public, anon, authenticated;
revoke execute on function public.commission_release_guard()      from public, anon, authenticated;
