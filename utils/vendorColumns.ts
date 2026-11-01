/**
 * Columns of `vendors` that every visitor may read.
 *
 * The personal contact columns (email, first_name, last_name) are
 * grant-protected in the database: a `select("*")` on vendors fails for
 * everyone but the service role, and those three come back only through the
 * `vendor_private_contact(p_vendor_id)` RPC, to the vendor's own account and
 * site admins. The public contact address is `business_email`.
 */
export const VENDOR_PUBLIC_COLUMNS =
  "id, name, category, description, capacity, contact, vendor_type, is_public, is_founder, status, created_at, user_id, phone, show_phone, website, wants_public, suspended_at, suspended_reason, business_email, accent_color";
