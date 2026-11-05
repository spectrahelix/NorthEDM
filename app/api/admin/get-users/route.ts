import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "archon" && profile?.role !== "warden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profiles, error: profilesError } = await adminClient
    .from("user_profiles")
    .select("id, display_name, username, avatar_url, role, created_at, is_founder, is_vendor, is_marketplace, is_festdash_vendor, is_promoter, is_artisan, is_driver, is_forager, extra_ranks, is_site_moderator, vendor_id")
    .order("created_at", { ascending: false });

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const {
    data: { users: authUsers },
    error: authError,
  } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const emailMap: Record<string, string> = {};
  for (const u of authUsers) {
    if (u.email) emailMap[u.id] = u.email;
  }

  // Each person's shop, for the Public shop switch: listing state and item
  // counts (so it's visible that switching never touches their items).
  const vendorIds = [...new Set((profiles ?? []).map((p) => p.vendor_id as number | null).filter((v): v is number => v != null))];
  const [{ data: vendors }, { data: items }] = await Promise.all([
    vendorIds.length ? adminClient.from("vendors").select("id, name, status, is_public, suspended_at, suspended_reason").in("id", vendorIds) : Promise.resolve({ data: [] }),
    vendorIds.length ? adminClient.from("products").select("vendor_id, status, is_public").in("vendor_id", vendorIds) : Promise.resolve({ data: [] }),
  ]);
  const shopOf = new Map<number, { id: number; name: string | null; status: string | null; is_public: boolean | null; suspended_at: string | null; suspended_reason: string | null; items: number; on_sale: number }>();
  for (const v of (vendors ?? []) as { id: number; name: string | null; status: string | null; is_public: boolean | null; suspended_at: string | null; suspended_reason: string | null }[]) {
    shopOf.set(v.id, { ...v, items: 0, on_sale: 0 });
  }
  for (const it of (items ?? []) as { vendor_id: number; status: string | null; is_public: boolean | null }[]) {
    const s = shopOf.get(it.vendor_id); if (!s) continue;
    s.items++; if (it.status === "published" && it.is_public) s.on_sale++;
  }

  const result = (profiles ?? []).map(
    (p: {
      id: string;
      display_name: string;
      username?: string | null;
      avatar_url: string | null;
      role: string;
      created_at: string;
      is_founder?: boolean;
      is_vendor?: boolean;
      is_marketplace?: boolean;
      is_festdash_vendor?: boolean;
      is_promoter?: boolean;
      is_artisan?: boolean;
      is_driver?: boolean;
      is_forager?: boolean;
      extra_ranks?: string[] | null;
      is_site_moderator?: boolean;
      vendor_id?: number | null;
    }) => ({
      ...p,
      email: emailMap[p.id] ?? "",
      shop: p.vendor_id != null ? shopOf.get(p.vendor_id) ?? null : null,
    })
  );

  return NextResponse.json({ users: result });
}
