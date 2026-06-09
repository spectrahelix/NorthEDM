-- Enable RLS on invoices with no permissive policies.
-- The table is intentionally locked to anon/authenticated roles.
-- All invoice access must go through server-side routes using the service role key.
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
