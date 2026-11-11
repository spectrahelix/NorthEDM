import type { SupabaseClient } from '@supabase/supabase-js';
import { listingGroupsForStore, type StoreCatalogPlan } from '@/utils/storePlans';

export async function loadStoreCatalogPlan(db: SupabaseClient, storeId: string): Promise<StoreCatalogPlan | null> {
  const { data, error } = await db.from('store_catalog_plans').select('*').eq('store_id', storeId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as StoreCatalogPlan | null;
}

export async function storeListingGroups(db: SupabaseClient, storeId: string) {
  return listingGroupsForStore(await loadStoreCatalogPlan(db, storeId));
}

/** Apply the same product grouping as the storefront's size selector. */
export function isStoreListing(groupIds: Set<number> | null, product: { id: number; variant_of?: number | null }) {
  return groupIds === null || groupIds.has(Number(product.variant_of ?? product.id));
}

export function availableSlots(plan: StoreCatalogPlan | null) {
  return Math.min(plan?.slot_limit ?? 30, plan?.checkout_slots ?? 30);
}

export function storeGroupFilter(groupIds: Set<number> | null) {
  if (groupIds === null) return null;
  if (groupIds.size === 0) return 'id.eq.0';
  const ids = [...groupIds].join(',');
  return `id.in.(${ids}),variant_of.in.(${ids})`;
}
