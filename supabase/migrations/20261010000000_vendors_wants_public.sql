-- The vendor application form offers "Public Vendor" or "Private Supplier",
-- and sent that straight into vendors.is_public. The RLS insert policy
-- ("public apply as vendor") requires is_public = false, because letting an
-- applicant publish themselves into the public directory is exactly what that
-- policy exists to prevent. So every applicant who chose "Public Vendor" was
-- refused with "new row violates row-level security policy for table
-- vendors" — a real high-value applicant hit it on 2026-10-10.
--
-- The policy is right; the form was writing to the wrong column. is_public is
-- a listing decision made at approval. What the applicant picks is a REQUEST,
-- so it gets its own column and the admin promotes it on approval.
alter table public.vendors
  add column if not exists wants_public boolean not null default false;

comment on column public.vendors.wants_public is
  'What the applicant asked for on /vendors/apply. is_public is the actual listing flag and is set by an admin at approval — an applicant can never set it, per the "public apply as vendor" policy.';
