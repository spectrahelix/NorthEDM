import { NextResponse } from 'next/server';
import { guardStoreOperator } from '@/utils/store';
import { availableSlots, loadStoreCatalogPlan } from '@/utils/storeCatalog';
import { groupVariants } from '@/utils/productVariants';
import { safeOrigin } from '@/utils/safeRedirect';
import type { SupabaseClient } from '@supabase/supabase-js';

type Params = { params: Promise<{ slug: string }> };

async function catalogOptions(db: SupabaseClient, storeId: string) {
  const { data: members, error: memberError } = await db.from('store_vendors').select('vendor_id').eq('store_id', storeId).eq('status', 'approved');
  if (memberError) throw new Error(memberError.message);
  const vendorIds = (members ?? []).map(row => Number(row.vendor_id));
  if (!vendorIds.length) return [];
  const { data, error } = await db.from('products').select('id,name,variant_of,variant_label').in('vendor_id', vendorIds).order('id');
  if (error) throw new Error(error.message);
  return groupVariants(data ?? []).map(group => ({ id: group.key, name: group.title, sizes: group.options.length }));
}

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guardStoreOperator(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  try {
    const [plan, options] = await Promise.all([loadStoreCatalogPlan(g.admin, g.store.id), catalogOptions(g.admin, g.store.id)]);
    return NextResponse.json({ options, selected: plan?.listing_groups ?? [], limit: availableSlots(plan),
      active_limit: plan?.slot_limit ?? null, pending_limit: plan?.checkout_slots ?? null });
  } catch (e) {
    console.error('Store catalog read failed:', e);
    return NextResponse.json({ error: 'Could not load storefront listings.' }, { status: 503 });
  }
}

export async function POST(req: Request, { params }: Params) {
  const origin = req.headers.get('origin');
  if (origin && origin !== safeOrigin(origin, req.url)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const { slug } = await params;
  const g = await guardStoreOperator(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.groups) || body.groups.length > 30 || body.groups.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) <= 0))
    return NextResponse.json({ error: 'Choose up to 30 valid product listings.' }, { status: 400 });
  const groups = [...new Set<number>(body.groups)];
  try {
    const [plan, options] = await Promise.all([loadStoreCatalogPlan(g.admin, g.store.id), catalogOptions(g.admin, g.store.id)]);
    const limit = availableSlots(plan);
    if (groups.length > limit) return NextResponse.json({ error: `This plan has ${limit} slots. Remove a listing before adding another.` }, { status: 409 });
    const valid = new Set(options.map(option => option.id));
    if (groups.some(id => !valid.has(id))) return NextResponse.json({ error: 'One of those products is no longer in your store inventory. Refresh the list.' }, { status: 400 });
    const { error } = await g.admin.from('store_catalog_plans').upsert({ store_id: g.store.id, listing_groups: groups }, { onConflict: 'store_id' });
    if (error?.code === '23514') return NextResponse.json({ error: 'Your slot limit changed. Refresh before saving.' }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ saved: true, selected: groups });
  } catch (e) {
    console.error('Store catalog save failed:', e);
    return NextResponse.json({ error: 'Could not save storefront listings.' }, { status: 503 });
  }
}
