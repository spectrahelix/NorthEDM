import type { SupabaseClient } from "@supabase/supabase-js";

// Square inventory sync (Phase 1). Talks to the Square REST API directly (no
// SDK dependency) against sandbox or production per the vendor's connection.
// One-way: Square catalog + inventory → NorthEDM `products`, one product per
// item variation. Square is the source of truth; synced rows are read-only here.

// Square's dated API version. Override with SQUARE_VERSION if needed.
const SQUARE_VERSION = process.env.SQUARE_VERSION || "2024-10-17";

export type SquareEnv = "sandbox" | "production";

export function squareBase(env: SquareEnv): string {
  return env === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

async function squareFetch(
  env: SquareEnv,
  token: string,
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${squareBase(env)}${path}`, {
    method: init?.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Validate a token by listing locations. Returns the vendor's locations so the
// connect flow can confirm the given location_id belongs to the account.
export async function verifySquare(
  env: SquareEnv,
  token: string
): Promise<{ ok: boolean; locations: { id: string; name: string }[]; error?: string }> {
  const r = await squareFetch(env, token, "/v2/locations");
  if (!r.ok) {
    const msg =
      (r.data?.errors as { detail?: string }[] | undefined)?.[0]?.detail ||
      `Square returned ${r.status}`;
    return { ok: false, locations: [], error: msg };
  }
  const locations = ((r.data?.locations as Record<string, unknown>[]) || []).map((l) => ({
    id: String(l.id),
    name: String(l.name ?? l.id),
  }));
  return { ok: true, locations };
}

type CatalogObject = Record<string, unknown>;

// Pull every catalog ITEM plus related images/categories (paginated).
async function fetchCatalogItems(
  env: SquareEnv,
  token: string
): Promise<{ items: CatalogObject[]; related: CatalogObject[] }> {
  const items: CatalogObject[] = [];
  const related: CatalogObject[] = [];
  let cursor: string | undefined;
  do {
    const r = await squareFetch(env, token, "/v2/catalog/search-catalog-objects", {
      method: "POST",
      body: { object_types: ["ITEM"], include_related_objects: true, cursor },
    });
    if (!r.ok) throw new Error(`catalog fetch failed (${r.status})`);
    for (const o of (r.data?.objects as CatalogObject[]) || []) items.push(o);
    for (const o of (r.data?.related_objects as CatalogObject[]) || []) related.push(o);
    cursor = r.data?.cursor as string | undefined;
  } while (cursor);
  return { items, related };
}

// Inventory counts (IN_STOCK) for the given variation ids at the location.
async function fetchInventoryCounts(
  env: SquareEnv,
  token: string,
  variationIds: string[],
  locationId: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  // batch-retrieve accepts up to 1000 ids per call
  for (let i = 0; i < variationIds.length; i += 500) {
    const batch = variationIds.slice(i, i + 500);
    if (!batch.length) break;
    const r = await squareFetch(env, token, "/v2/inventory/counts/batch-retrieve", {
      method: "POST",
      body: { catalog_object_ids: batch, location_ids: [locationId] },
    });
    if (!r.ok) continue; // inventory is best-effort; default to 0
    for (const c of (r.data?.counts as Record<string, unknown>[]) || []) {
      if (c.state !== "IN_STOCK") continue;
      const id = String(c.catalog_object_id);
      const qty = Math.max(0, Math.floor(Number(c.quantity) || 0));
      counts.set(id, (counts.get(id) || 0) + qty);
    }
  }
  return counts;
}

export type SquareSyncResult = {
  created: number;
  updated: number;
  unpublished: number;
  total: number;
};

type Connection = {
  vendor_id: number;
  access_token: string;
  location_id: string;
  environment: SquareEnv;
};

// Run a full sync for one vendor connection against a service-role client.
export async function runSquareSync(
  admin: SupabaseClient,
  conn: Connection
): Promise<SquareSyncResult> {
  const { items, related } = await fetchCatalogItems(conn.environment, conn.access_token);

  // Lookup tables for related images + categories.
  const imageUrlById = new Map<string, string>();
  const categoryNameById = new Map<string, string>();
  for (const o of related) {
    if (o.type === "IMAGE") {
      const url = (o.image_data as { url?: string } | undefined)?.url;
      if (url) imageUrlById.set(String(o.id), url);
    } else if (o.type === "CATEGORY") {
      const name = (o.category_data as { name?: string } | undefined)?.name;
      if (name) categoryNameById.set(String(o.id), name);
    }
  }

  // Flatten items → one desired row per variation.
  type Desired = {
    square_catalog_id: string;
    square_variation_id: string;
    name: string;
    description: string | null;
    price: number;
    category: string | null;
    image_url: string | null;
  };
  const desired: Desired[] = [];
  for (const item of items) {
    const d = (item.item_data as Record<string, unknown>) || {};
    const itemName = String(d.name ?? "Untitled");
    const description = d.description ? String(d.description) : null;
    const imageId = (d.image_ids as string[] | undefined)?.[0];
    const image_url = imageId ? imageUrlById.get(imageId) ?? null : null;
    const catId =
      (d.category_id as string | undefined) ||
      ((d.categories as { id?: string }[] | undefined)?.[0]?.id);
    const category = catId ? categoryNameById.get(catId) ?? null : null;
    const variations = (d.variations as CatalogObject[]) || [];
    for (const v of variations) {
      const vd = (v.item_variation_data as Record<string, unknown>) || {};
      const amount = Number(
        (vd.price_money as { amount?: number } | undefined)?.amount ?? 0
      );
      const varName = vd.name ? String(vd.name) : "";
      // Label with the variation only when the item has more than one.
      const name = variations.length > 1 && varName ? `${itemName} – ${varName}` : itemName;
      desired.push({
        square_catalog_id: String(item.id),
        square_variation_id: String(v.id),
        name,
        description,
        price: Math.round(amount) / 100, // cents → dollars
        category,
        image_url,
      });
    }
  }

  const invCounts = await fetchInventoryCounts(
    conn.environment,
    conn.access_token,
    desired.map((d) => d.square_variation_id),
    conn.location_id
  );

  // Existing Square-sourced rows for this vendor, to update / unpublish.
  const { data: existingRows } = await admin
    .from("products")
    .select("id, square_variation_id")
    .eq("vendor_id", conn.vendor_id)
    .eq("source", "square");
  const idByVariation = new Map<string, number>();
  for (const r of existingRows ?? []) {
    if (r.square_variation_id) idByVariation.set(r.square_variation_id as string, r.id as number);
  }

  const now = new Date().toISOString();
  const result: SquareSyncResult = { created: 0, updated: 0, unpublished: 0, total: desired.length };
  const seen = new Set<string>();

  for (const d of desired) {
    seen.add(d.square_variation_id);
    const inventory_count = invCounts.get(d.square_variation_id) ?? 0;
    const row = {
      vendor_id: conn.vendor_id,
      name: d.name,
      description: d.description,
      category: d.category,
      price: d.price,
      inventory_count,
      image_url: d.image_url,
      source: "square",
      square_catalog_id: d.square_catalog_id,
      square_variation_id: d.square_variation_id,
      is_public: true,
      status: "published",
      synced_at: now,
    };
    const existingId = idByVariation.get(d.square_variation_id);
    if (existingId) {
      await admin.from("products").update(row).eq("id", existingId);
      result.updated++;
    } else {
      await admin.from("products").insert(row);
      result.created++;
    }
  }

  // Anything previously synced but no longer in Square → hide (don't hard-delete).
  const stale = (existingRows ?? [])
    .filter((r) => r.square_variation_id && !seen.has(r.square_variation_id as string))
    .map((r) => r.id as number);
  if (stale.length) {
    await admin
      .from("products")
      .update({ is_public: false, status: "draft", synced_at: now })
      .in("id", stale);
    result.unpublished = stale.length;
  }

  await admin
    .from("vendor_square_connections")
    .update({
      last_synced_at: now,
      last_sync_status: `ok · ${result.created} new, ${result.updated} updated, ${result.unpublished} hidden`,
      updated_at: now,
    })
    .eq("vendor_id", conn.vendor_id);

  return result;
}
