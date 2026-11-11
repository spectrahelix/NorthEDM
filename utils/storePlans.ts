/** One slot is one storefront product group, including all of its sizes. */
export const STORE_SLOT_PLANS = [
  { slots: 5, cents: 500 },
  { slots: 10, cents: 1000 },
  { slots: 15, cents: 1500 },
  { slots: 30, cents: 3000 },
] as const;
export type StoreSlots = (typeof STORE_SLOT_PLANS)[number]['slots'];
export const STORE_PLAN_TERMS_VERSION = '2026-11-11';
export const STORE_UPGRADE_TERMS_VERSION = '2026-11-11-upgrade';
export const BUNDLE_STORE_SLOTS: StoreSlots = 30;

export function storeSlotPlan(value: unknown) {
  return STORE_SLOT_PLANS.find(plan => String(plan.slots) === String(value));
}

export type StoreCatalogPlan = {
  store_id: string;
  slot_limit: StoreSlots | null;
  listing_groups: number[];
  checkout_attempt: string | null;
  checkout_slots: StoreSlots | null;
  checkout_session_id: string | null;
  checkout_expires_at: string | null;
  checkout_quote_key: string | null;
  stripe_subscription_id: string | null;
  pending_upgrade: StorePlanUpgradeAttempt | null;
};

export type StoreUpgradeQuote = {
  slots: StoreSlots;
  proration_date: number;
  adjustment_cents: number;
  recurring_cents: number | null;
  period_end: number;
  version: typeof STORE_UPGRADE_TERMS_VERSION;
};

export type StorePlanUpgradeAttempt = StoreUpgradeQuote & {
  id: string;
  subscription_id: string;
  from_slots: StoreSlots;
  price_id: string;
  previous_invoice_id: string;
  started_at: number;
  invoice_id?: string;
};

export function listingGroupsForStore(plan: StoreCatalogPlan | null): Set<number> | null {
  if (plan?.slot_limit == null) return null;
  return new Set(plan.listing_groups.map(Number).slice(0, plan.slot_limit));
}
