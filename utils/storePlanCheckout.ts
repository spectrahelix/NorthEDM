import type { SupabaseClient } from '@supabase/supabase-js';
import { getStripe } from '@/utils/stripe';
import { loadStoreCatalogPlan } from '@/utils/storeCatalog';
import type { StoreCatalogPlan, StoreSlots } from '@/utils/storePlans';

export async function releaseStorePlanCheckout(db: SupabaseClient, storeId: string, attempt: string) {
  const { error } = await db.from('store_catalog_plans').update({ checkout_attempt: null, checkout_slots: null,
    checkout_session_id: null, checkout_expires_at: null, checkout_quote_key: null,
  }).eq('store_id', storeId).eq('checkout_attempt', attempt);
  if (error) throw new Error(error.message);
}

function stillPreparing(plan: StoreCatalogPlan) {
  return !plan.checkout_expires_at || new Date(plan.checkout_expires_at).getTime() > Date.now();
}

export async function cancelStorePlanCheckout(db: SupabaseClient, storeId: string) {
  const plan = await loadStoreCatalogPlan(db, storeId);
  if (!plan?.checkout_attempt) return;
  if (plan.checkout_session_id) {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(plan.checkout_session_id);
    if (session.status === 'complete') throw new Error('This checkout completed. Refresh billing to see the subscription.');
    if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
  } else if (stillPreparing(plan)) {
    throw new Error('Checkout is being prepared. Try again shortly.');
  }
  await releaseStorePlanCheckout(db, storeId, plan.checkout_attempt);
}

export async function reserveStorePlanCheckout(db: SupabaseClient, args: {
  storeId: string; vendorId: number | null; kind: 'store' | 'bundle'; slots: StoreSlots; quoteKey: string;
}): Promise<{ url: string } | { attempt: string; expiresAt: number }> {
  const plan = await loadStoreCatalogPlan(db, args.storeId);
  if (plan?.checkout_attempt) {
    if (plan.checkout_session_id) {
      const session = await getStripe().checkout.sessions.retrieve(plan.checkout_session_id);
      if (session.status === 'open' && session.url && plan.checkout_quote_key === args.quoteKey) return { url: session.url };
      if (session.status !== 'expired') throw new Error('A checkout is already open. Resume it or cancel it before choosing a different plan.');
    } else if (stillPreparing(plan)) {
      throw new Error('Checkout is being prepared. Try again shortly.');
    }
    await releaseStorePlanCheckout(db, args.storeId, plan.checkout_attempt);
  }
  const attempt = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const { error } = await db.rpc('reserve_store_plan_checkout', {
    p_store_id: args.storeId, p_vendor_id: args.vendorId, p_kind: args.kind, p_slots: args.slots,
    p_attempt: attempt, p_expires_at: new Date(expiresAt * 1000).toISOString(), p_quote_key: args.quoteKey,
  });
  if (error) throw new Error(error.message);
  return { attempt, expiresAt };
}

export async function bindStorePlanCheckout(db: SupabaseClient, storeId: string, attempt: string, sessionId: string) {
  const { data, error } = await db.from('store_catalog_plans').update({ checkout_session_id: sessionId })
    .eq('store_id', storeId).eq('checkout_attempt', attempt).select('store_id').maybeSingle();
  if (error || !data) throw new Error('The checkout could not be saved. Please try again later.');
}
