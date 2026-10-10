import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { canManageInventory } from "@/utils/marketplace";
import { isUndisplayableImage } from "@/utils/webImage";

// A vendor's own photo library: every image they have uploaded, and which of
// their items (if any) uses it.
//
// Exists because an upload and the item it was meant for can come apart — on
// 2026-10-10 a vendor's phone reloaded the page after the photo picker, the
// photo landed in storage and the item never got it, and nobody could see
// that from the dashboard. This makes every upload visible and either usable
// or deletable by its owner.
//
// Scoped by storage folder: uploads live under `<user id>/` in each bucket,
// and every path is checked against that prefix, so a vendor can only ever
// see or delete their own files.

const BUCKETS = ["shop-products", "products"] as const;

async function guard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canManageInventory(supabase, user))) {
    return { ok: false as const, res: NextResponse.json({ error: "Marketplace access required." }, { status: 403 }) };
  }
  const { data: prof } = await supabase.from("user_profiles").select("vendor_id").eq("id", user.id).maybeSingle();
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return { ok: true as const, user, admin, vendorId: (prof?.vendor_id as number | null) ?? null };
}

/** Strip a cache-busting ?t=… so a stored image_url matches its file. */
const bare = (url: string) => url.split("?")[0];

async function productsByImage(admin: SupabaseClient, vendorId: number | null) {
  const map = new Map<string, { id: number; name: string }[]>();
  if (!vendorId) return map;
  const { data } = await admin.from("products").select("id, name, image_url").eq("vendor_id", vendorId);
  for (const p of data ?? []) {
    if (!p.image_url) continue;
    const k = bare(p.image_url as string);
    map.set(k, [...(map.get(k) ?? []), { id: p.id as number, name: (p.name as string) || "Untitled item" }]);
  }
  return map;
}

export async function GET() {
  const g = await guard();
  if (!g.ok) return g.res;

  const used = await productsByImage(g.admin, g.vendorId);
  const photos: {
    bucket: string; path: string; url: string; uploadedAt: string | null; bytes: number | null;
    usedBy: { id: number; name: string }[]; displayable: boolean;
  }[] = [];

  for (const bucket of BUCKETS) {
    const { data } = await g.admin.storage.from(bucket).list(g.user.id, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    for (const f of data ?? []) {
      if (!f.id) continue; // folders
      const path = `${g.user.id}/${f.name}`;
      const url = g.admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      photos.push({
        bucket, path, url,
        uploadedAt: f.created_at ?? null,
        bytes: (f.metadata as { size?: number } | null)?.size ?? null,
        usedBy: used.get(url) ?? [],
        displayable: !isUndisplayableImage(f.name, (f.metadata as { mimetype?: string } | null)?.mimetype ?? ""),
      });
    }
  }
  photos.sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));
  return NextResponse.json({ photos });
}

// Delete one of your own photos. Refused while an item still shows it, so a
// delete can never leave a live listing with a broken image.
export async function DELETE(req: Request) {
  const g = await guard();
  if (!g.ok) return g.res;

  const { bucket, path } = (await req.json().catch(() => ({}))) as { bucket?: string; path?: string };
  if (!bucket || !(BUCKETS as readonly string[]).includes(bucket) || !path || !path.startsWith(`${g.user.id}/`) || path.includes("..")) {
    return NextResponse.json({ error: "That photo isn't yours to delete." }, { status: 403 });
  }
  const url = g.admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const usedBy = (await productsByImage(g.admin, g.vendorId)).get(url) ?? [];
  if (usedBy.length) {
    return NextResponse.json({ error: `“${usedBy[0].name}” still uses this photo. Give it a different photo first.` }, { status: 409 });
  }
  const { error } = await g.admin.storage.from(bucket).remove([path]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
