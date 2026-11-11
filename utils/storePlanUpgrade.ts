import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStripe } from '@/utils/stripe';
import { loadStoreCatalogPlan } from '@/utils/storeCatalog';
import {
  STORE_UPGRADE_TERMS_VERSION, storeSlotPlan, type StoreCatalogPlan,
  type StorePlanUpgradeAttempt, type StoreSlots, type StoreUpgradeQuote,
} from '@/utils/storePlans';

const QUOTE_SECONDS = 5 * 60;
const UPDATE_TIMEOUT_MS = 15_000;
type Plan = NonNullable<ReturnType<typeof storeSlotPlan>>;
type UpgradeState = { slots: StoreSlots; pending: boolean; payment_url?: string; can_cancel?: boolean };
type Store = { id: string; owner_user_id: string };

function objectId(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id;
}

export function upgradePricePlan(price: Stripe.Price | undefined) {
  const plan = storeSlotPlan(price?.metadata?.northedm_upgrade_slots);
  return plan && price?.unit_amount === plan.cents && price.currency === 'usd' &&
    price.recurring?.interval === 'month' && price.recurring.interval_count === 1 ? plan : undefined;
}

async function upgradePrice(plan: Plan) {
  const stripe = getStripe();
  const key = `northedm-store-monthly-${plan.slots}-${plan.cents}`;
  const { data } = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const price = data[0] ?? await stripe.prices.create({
    lookup_key: key, currency: 'usd', unit_amount: plan.cents, recurring: { interval: 'month' },
    product_data: { name: `NorthEDM Store subscription · ${plan.slots} product slots` },
    metadata: { northedm_upgrade_slots: String(plan.slots) },
  }, { idempotencyKey: key });
  if (upgradePricePlan(price)?.slots !== plan.slots) throw new Error('This upgrade price is unavailable.');
  return price;
}

async function latestInvoice(sub: Stripe.Subscription) {
  const invoice = sub.latest_invoice;
  return typeof invoice === 'string' ? getStripe().invoices.retrieve(invoice) : invoice;
}

function prorationLine(line: Stripe.InvoiceLineItem, date: number) {
  return line.period.start === date &&
    (line.parent?.subscription_item_details?.proration || line.parent?.invoice_item_details?.proration);
}

function lineTotal(line: Stripe.InvoiceLineItem) {
  const discounts = (line.discount_amounts ?? []).reduce((sum, discount) => sum + discount.amount, 0);
  const taxes = (line.taxes ?? []).reduce((sum, tax) => sum + (tax.tax_behavior === 'exclusive' ? tax.amount : 0), 0);
  return line.amount - discounts + taxes;
}

async function quoteUpgrade(sub: Stripe.Subscription, item: Stripe.SubscriptionItem, plan: Plan, date: number) {
  const price = await upgradePrice(plan);
  const items = [{ id: item.id, price: price.id, quantity: 1 }];
  const stripe = getStripe();
  const renews = !sub.cancel_at_period_end && !sub.cancel_at;
  const [preview, renewal] = await Promise.all([
    stripe.invoices.createPreview({
      subscription: sub.id,
      subscription_details: { items, proration_date: date, proration_behavior: 'always_invoice' },
    }),
    renews ? stripe.invoices.createPreview({
      subscription: sub.id, preview_mode: 'recurring',
      subscription_details: { items, proration_behavior: 'none' },
    }) : null,
  ]);
  const lines = preview.lines.data;
  const unrelated = lines.some(line => !prorationLine(line, date) &&
    (line.parent?.subscription_item_details?.subscription_item !== item.id ||
      line.parent.subscription_item_details.proration || line.period.start < item.current_period_end));
  if (preview.currency !== 'usd' || preview.starting_balance > 0 || preview.lines.has_more || unrelated) {
    throw new Error('Review the outstanding items in Manage billing before upgrading.');
  }
  const quote: StoreUpgradeQuote = {
    slots: plan.slots, proration_date: date, period_end: item.current_period_end,
    adjustment_cents: lines.filter(line => prorationLine(line, date)).reduce((sum, line) => sum + lineTotal(line), 0),
    recurring_cents: renewal?.total ?? null, version: STORE_UPGRADE_TERMS_VERSION,
  };
  return { quote, price, items };
}

function isUpgradeInvoice(invoice: Stripe.Invoice | null, sub: Stripe.Subscription, attempt: StorePlanUpgradeAttempt) {
  return !!invoice && invoice.id !== attempt.previous_invoice_id && invoice.billing_reason === 'subscription_update' &&
    invoice.currency === 'usd' && objectId(invoice.parent?.subscription_details?.subscription) === sub.id &&
    invoice.created >= attempt.proration_date &&
    (invoice.id === attempt.invoice_id ||
      invoice.lines.data.some(line => prorationLine(line, attempt.proration_date) &&
        objectId(line.pricing?.price_details?.price) === attempt.price_id));
}

async function setAttempt(db: SupabaseClient, storeId: string, attempt: StorePlanUpgradeAttempt, changes: {
  pending_upgrade: StorePlanUpgradeAttempt | null; slot_limit?: StoreSlots;
}) {
  const { data, error } = await db.from('store_catalog_plans').update(changes).eq('store_id', storeId)
    .eq('stripe_subscription_id', attempt.subscription_id).eq('slot_limit', attempt.from_slots)
    .eq('pending_upgrade->>id', attempt.id).is('checkout_attempt', null).select('store_id').maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

async function reconcileUpgrade(db: SupabaseClient, storeId: string, sub: Stripe.Subscription, attempt: StorePlanUpgradeAttempt): Promise<UpgradeState> {
  const latest = await latestInvoice(sub);
  let invoice = attempt.invoice_id && latest?.id !== attempt.invoice_id
    ? await getStripe().invoices.retrieve(attempt.invoice_id) : latest;
  const item = sub.items.data[0];
  const priceApplied = sub.items.data.length === 1 && item?.quantity === 1 &&
    item.price.id === attempt.price_id && upgradePricePlan(item.price)?.slots === attempt.slots;
  if (priceApplied && !attempt.invoice_id && !isUpgradeInvoice(invoice, sub, attempt) &&
      invoice?.id !== attempt.previous_invoice_id) {
    // The update response can be lost, and a later renewal can replace
    // latest_invoice. Look for the original adjustment on this subscription.
    const { data } = await getStripe().invoices.list({
      subscription: sub.id, created: { gte: attempt.proration_date }, status: 'paid', limit: 10,
    });
    invoice = data.find(candidate => isUpgradeInvoice(candidate, sub, attempt)) ?? invoice;
  }
  const related = isUpgradeInvoice(invoice, sub, attempt);
  // Stripe can apply a zero adjustment without issuing an invoice. Any new
  // invoice must match the requested change and be marked paid by Stripe.
  const paid = (related && invoice?.status === 'paid') ||
    (attempt.adjustment_cents === 0 && invoice?.id === attempt.previous_invoice_id);
  if (priceApplied && sub.status === 'active' && !sub.pending_update && paid) {
    const applied = await setAttempt(db, storeId, attempt, { slot_limit: attempt.slots, pending_upgrade: null });
    const slots = applied ? attempt.slots : (await loadStoreCatalogPlan(db, storeId))?.slot_limit;
    return { slots: slots ?? attempt.from_slots, pending: false };
  }
  if (!priceApplied && !sub.pending_update &&
      ((related && (invoice?.status === 'void' || invoice?.status === 'uncollectible')) ||
        (!related && Date.now() / 1000 > attempt.started_at + QUOTE_SECONDS))) {
    await setAttempt(db, storeId, attempt, { pending_upgrade: null });
    return { slots: attempt.from_slots, pending: false };
  }
  return {
    slots: attempt.from_slots, pending: true,
    ...(related && sub.pending_update && invoice?.status === 'open'
      ? { payment_url: invoice.hosted_invoice_url ?? undefined, can_cancel: true } : {}),
  };
}

/** Called by the existing signed subscription and invoice webhooks. */
export async function syncUpgradedStoreSlots(db: SupabaseClient, storeId: string, sub: Stripe.Subscription, slots: StoreSlots) {
  const catalog = await loadStoreCatalogPlan(db, storeId);
  if (catalog?.stripe_subscription_id !== sub.id || !catalog.slot_limit) throw new Error('Store upgrade subscription mismatch.');
  if (catalog.slot_limit === slots) return slots;
  const attempt = catalog.pending_upgrade;
  if (attempt?.slots !== slots || attempt.subscription_id !== sub.id) throw new Error('Store upgrade was not authorized.');
  return (await reconcileUpgrade(db, storeId, sub, attempt)).slots;
}

async function storeSubscription(store: Store, catalog: StoreCatalogPlan | null) {
  if (!catalog?.stripe_subscription_id || !catalog.slot_limit) throw new Error('An active monthly store slot plan is required.');
  const sub = await getStripe().subscriptions.retrieve(catalog.stripe_subscription_id, { expand: ['latest_invoice'] });
  if (sub.metadata?.kind !== 'store' || sub.metadata.store_id !== store.id ||
      sub.metadata.user_id !== store.owner_user_id || !sub.metadata.store_plan_attempt) {
    throw new Error('Only the account that pays for this store can upgrade it.');
  }
  return { catalog, sub };
}

async function readUpgrade(db: SupabaseClient, store: Store) {
  return storeSubscription(store, await loadStoreCatalogPlan(db, store.id));
}

export async function storeUpgradeStatus(db: SupabaseClient, store: Store): Promise<UpgradeState> {
  const catalog = await loadStoreCatalogPlan(db, store.id);
  if (!catalog?.slot_limit) throw new Error('An active monthly store slot plan is required.');
  if (!catalog.pending_upgrade) return { slots: catalog.slot_limit, pending: false };
  const { sub } = await storeSubscription(store, catalog);
  return reconcileUpgrade(db, store.id, sub, catalog.pending_upgrade);
}

export async function cancelStoreUpgrade(db: SupabaseClient, store: Store) {
  const { catalog, sub } = await readUpgrade(db, store);
  const attempt = catalog.pending_upgrade;
  if (!attempt) return { slots: catalog.slot_limit, pending: false };
  const state = await reconcileUpgrade(db, store.id, sub, attempt);
  if (!state.pending) return state;
  const invoice = await latestInvoice(sub);
  if (!state.can_cancel || !invoice || (attempt.invoice_id && invoice.id !== attempt.invoice_id) ||
      !isUpgradeInvoice(invoice, sub, attempt) || invoice.status !== 'open') {
    throw new Error('Stripe is checking this upgrade. Try again shortly.');
  }
  await getStripe().invoices.voidInvoice(invoice.id);
  await setAttempt(db, store.id, attempt, { pending_upgrade: null });
  return { slots: attempt.from_slots, pending: false };
}

export async function requestStoreUpgrade(db: SupabaseClient, store: Store, slots: unknown, consent?: Partial<StoreUpgradeQuote>) {
  const { catalog, sub } = await readUpgrade(db, store);
  if (catalog.pending_upgrade) return reconcileUpgrade(db, store.id, sub, catalog.pending_upgrade);
  const currentPlan = storeSlotPlan(catalog.slot_limit);
  const plan = storeSlotPlan(slots);
  if (!plan || !currentPlan || plan.slots <= currentPlan.slots) throw new Error('Choose a higher store plan.');
  const item = sub.items.data[0];
  const invoice = await latestInvoice(sub);
  const now = Math.floor(Date.now() / 1000);
  if (sub.status !== 'active' || sub.collection_method !== 'charge_automatically' ||
      sub.pending_update || sub.schedule || sub.pause_collection || sub.items.data.length !== 1 ||
      item.quantity !== 1 || item.price.currency !== 'usd' || item.price.unit_amount !== currentPlan.cents ||
      item.price.recurring?.interval !== 'month' || item.price.recurring.interval_count !== 1 ||
      item.current_period_end <= now || !invoice) {
    throw new Error('Your current month must be paid before you can upgrade. Check Manage billing.');
  }
  if (invoice.status !== 'paid') {
    // Voiding an unfinished upgrade can leave its invoice as latest_invoice.
    // The current monthly payment still qualifies the store for another quote.
    const prior = invoice.status === 'void' && invoice.billing_reason === 'subscription_update'
      ? await getStripe().invoices.list({ subscription: sub.id, status: 'paid', created: { gte: item.current_period_start }, limit: 1 })
      : null;
    if (!prior?.data.length) throw new Error('Your current month must be paid before you can upgrade. Check Manage billing.');
  }
  const date = consent?.proration_date ?? now;
  if (!Number.isSafeInteger(date) || date < item.current_period_start || date > now || date < now - QUOTE_SECONDS) {
    throw new Error('The upgrade quote expired. Review a new quote.');
  }
  const { quote, price, items } = await quoteUpgrade(sub, item, plan, date);
  if (!consent) return { quote };
  if (consent.version !== quote.version || consent.slots !== quote.slots || consent.period_end !== quote.period_end ||
      consent.adjustment_cents !== quote.adjustment_cents || consent.recurring_cents !== quote.recurring_cents) {
    throw new Error('The upgrade price changed. Review a new quote before paying.');
  }
  const startedAt = Math.floor(Date.now() / 1000);
  if (startedAt >= quote.period_end || startedAt > date + QUOTE_SECONDS) {
    throw new Error('The upgrade quote expired. Review a new quote.');
  }
  const attempt: StorePlanUpgradeAttempt = {
    ...quote, id: crypto.randomUUID(), subscription_id: sub.id, price_id: price.id, from_slots: currentPlan.slots,
    started_at: startedAt, previous_invoice_id: invoice.id,
  };
  const { data, error } = await db.from('store_catalog_plans').update({ pending_upgrade: attempt })
    .eq('store_id', store.id).eq('stripe_subscription_id', sub.id).eq('slot_limit', currentPlan.slots)
    .is('checkout_attempt', null).is('pending_upgrade', null).select('store_id').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Billing changed. Refresh before trying again.');
  // Keep the reservation if the network response is lost. The status route
  // and webhook can recover from Stripe without submitting a second charge.
  const updated = await getStripe().subscriptions.update(sub.id, {
    items, proration_date: date, proration_behavior: 'always_invoice', payment_behavior: 'pending_if_incomplete',
    billing_cycle_anchor: 'unchanged', expand: ['latest_invoice'],
  }, { idempotencyKey: `store-upgrade-${attempt.id}`, timeout: UPDATE_TIMEOUT_MS, maxNetworkRetries: 1 });
  const invoiceId = objectId(updated.latest_invoice);
  if (invoiceId && invoiceId !== attempt.previous_invoice_id) {
    attempt.invoice_id = invoiceId;
    await setAttempt(db, store.id, attempt, { pending_upgrade: attempt });
  }
  return reconcileUpgrade(db, store.id, updated, attempt);
}
