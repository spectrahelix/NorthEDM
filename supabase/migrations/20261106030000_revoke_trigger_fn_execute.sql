-- Site audit 2026-11-06 (Supabase advisor 0028/0029): two trigger functions
-- were callable through /rest/v1/rpc by anon and signed-in users. Trigger
-- functions don't need EXECUTE for the trigger to fire, so this only closes
-- the RPC door. (The other flagged SECURITY DEFINER helpers — is_site_admin,
-- my_vendor_id, can_manage_product, vendor_is_suspended, is_verified … — are
-- called inside RLS policies and must stay executable by those roles.)
revoke execute on function public.protect_runner_activation() from public, anon, authenticated;
revoke execute on function public.protect_vendor_admin_fields() from public, anon, authenticated;
