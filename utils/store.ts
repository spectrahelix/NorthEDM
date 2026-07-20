import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";

const OWNER_EMAIL = "cjblue27@gmail.com";

// Top-level route names a store slug must never shadow.
export const RESERVED_SLUGS = new Set([
  "admin", "api", "marketplace", "shop", "forum", "feed", "events", "social",
  "crowdwave", "vendors", "vendor", "artisans", "foraging", "festdash", "profile",
  "messages", "login", "signup", "avatar", "portfolio", "privacy", "terms",
  "feedback", "requests", "offline", "quote", "h", "store", "wook-world",
  "reset-password", "forgot-password", "verify-email", "links",
]);

export function storeAdminClient(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type StoreRow = { id: string; slug: string; owner_user_id: string };

// Authorize the caller to manage a given store: they must be the store's operator
// (owner) or a NorthEDM admin. Returns a service-role client for the writes.
export async function guardStoreOperator(slug: string): Promise<
  | { ok: true; store: StoreRow; admin: SupabaseClient; userId: string }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const admin = storeAdminClient();
  const { data: store } = await admin
    .from("stores").select("id, slug, owner_user_id").eq("slug", slug).maybeSingle();
  if (!store) return { ok: false, status: 404, error: "Store not found." };

  let isNorthedmAdmin = user.email === OWNER_EMAIL;
  if (!isNorthedmAdmin) {
    const { data: up } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
    isNorthedmAdmin = up?.role === "archon" || up?.role === "warden";
  }
  if (store.owner_user_id !== user.id && !isNorthedmAdmin) {
    return { ok: false, status: 403, error: "You don't manage this store." };
  }
  return { ok: true, store: store as StoreRow, admin, userId: user.id };
}
