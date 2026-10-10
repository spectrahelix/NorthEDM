-- A vendor's own accent colour, used on their marketplace page and listings.
-- Self-editable (not one of protect_vendor_admin_fields' guarded columns).
-- The UI only offers the readable palette in utils/accent.ts; the database
-- just insists on a well-formed hex so nothing malformed reaches a style attr.
alter table public.vendors add column if not exists accent_color text
  check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$');
