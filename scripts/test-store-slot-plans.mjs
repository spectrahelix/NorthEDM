import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
async function moduleSource(file, dependencies = {}) {
  const source = await readFile(file, 'utf8');
  let js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const [path, replacement] of Object.entries(dependencies)) js = js.replaceAll(path, replacement);
  return moduleUrl(js);
}

const plansUrl = await moduleSource('utils/storePlans.ts');
const { STORE_SLOT_PLANS, STORE_PLAN_TERMS_VERSION, listingGroupsForStore } = await import(plansUrl);
const catalogUrl = await moduleSource('utils/storeCatalog.ts', { '@/utils/storePlans': plansUrl });
const { isStoreListing } = await import(catalogUrl);
assert.deepEqual(STORE_SLOT_PLANS.map(p => [p.slots, p.cents]), [[5,500],[10,1000],[15,1500],[30,3000]]);
const selected = listingGroupsForStore({ slot_limit: 5, listing_groups: [1, 2, 3, 4, 5, 6] });
assert.equal(isStoreListing(selected, { id: 50, variant_of: 1 }), true);
assert.equal(isStoreListing(selected, { id: 6, variant_of: null }), false);
assert.equal(isStoreListing(listingGroupsForStore(null), { id: 6 }), true);

const db = new PGlite();
const store = '11111111-1111-4111-8111-111111111111';
const legacy = '22222222-2222-4222-8222-222222222222';
const attempt = '33333333-3333-4333-8333-333333333333';
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create table public.stores(id uuid primary key, billing_status text, stripe_subscription_id text);
  create table public.stripe_subscriptions(store_id uuid, vendor_id bigint, kind text, status text);
  insert into public.stores values ('${store}','unpaid',null), ('${legacy}','active',null);
  grant select, update on public.stores to service_role;
  grant select on public.stripe_subscriptions to service_role;`);
await db.exec(await readFile('supabase/migrations/20261111154907_store_slot_plans.sql', 'utf8'));
await db.exec(await readFile('supabase/migrations/20261111162723_store_slot_upgrades.sql', 'utf8'));
const reserve = id => `select public.reserve_store_plan_checkout('${id}',1,'store',5::smallint,'${attempt}',now() + interval '1 hour','5|500')`;
const sync = (paid, status = 'active', requested = attempt) => `select public.sync_store_plan_subscription('${store}',5::smallint,'${requested}','sub_test','${status}',${paid})`;
await db.exec('set role anon');
await assert.rejects(db.query('select * from public.store_catalog_plans'), /permission denied/);
await assert.rejects(db.query(reserve(store)), /permission denied/);
await db.exec('reset role; set role service_role');
await assert.rejects(db.query(reserve(legacy)), /already a plan/);
await db.exec(`insert into public.store_catalog_plans(store_id,listing_groups) values ('${store}',array[1,2,3,4,5,6]::bigint[])`);
await assert.rejects(db.query(reserve(store)), /at most 5/);
await db.exec(`update public.store_catalog_plans set listing_groups=array[1,2,3,4,5] where store_id='${store}'`);
await db.query(reserve(store));
await assert.rejects(db.query(reserve(store)), /already open/);
await assert.rejects(db.exec(`update public.store_catalog_plans set listing_groups=array[1,2,3,4,5,6] where store_id='${store}'`), /store_catalog_capacity/);
await db.query(sync(false));
assert.equal((await db.query(`select billing_status from public.stores where id='${store}'`)).rows[0].billing_status, 'unpaid');
await assert.rejects(db.query(sync(true)), /does not match its checkout/);
await db.exec(`update public.store_catalog_plans set checkout_session_id='cs_test' where store_id='${store}'`);
await assert.rejects(db.query(sync(true, 'active', legacy)), /does not match its checkout/);
await db.query(sync(true));
await db.query(sync(true));
const activated = (await db.query(`select * from public.store_catalog_plans where store_id='${store}'`)).rows[0];
assert.equal(activated.slot_limit, 5);
assert.equal(activated.checkout_attempt, null);
assert.deepEqual(activated.listing_groups, [1,2,3,4,5]);
await assert.rejects(db.query(reserve(store)), /already a plan/);
await db.query(sync(false, 'canceled'));
assert.equal((await db.query(`select slot_limit from public.store_catalog_plans where store_id='${store}'`)).rows[0].slot_limit, 5);
assert.equal((await db.query(`select billing_status from public.stores where id='${legacy}'`)).rows[0].billing_status, 'active');

// Execute the production checkout function without a network connection or a
// live Stripe key. Inspect exactly what the provider would receive.
let sent;
let bind;
let rpc;
let subscription;
globalThis.__storePlanStripe = {
  checkout: { sessions: { create: async (body, options) => {
    sent = { body, options };
    return { id: 'cs_test', url: 'https://checkout.test/checkout' };
  } } },
  subscriptions: { retrieve: async () => subscription },
};
globalThis.__storePlanBind = (...args) => { bind = args; };
const promoterUrl = moduleUrl('export const makeReferralCode = () => "TEST";');
const discountsUrl = await moduleSource('utils/discountCodes.ts', { '@/utils/promoters': promoterUrl });
const stripeUrl = moduleUrl('export const getStripe = () => globalThis.__storePlanStripe;');
const upgradeUrl = await moduleSource('utils/storePlanUpgrade.ts', {
  '@/utils/storePlans': plansUrl, '@/utils/storeCatalog': catalogUrl, '@/utils/stripe': stripeUrl,
});
const { createSubscriptionCheckout, handleSubscriptionEvent } = await import(await moduleSource('utils/billing.ts', {
  '@/utils/storePlans': plansUrl,
  '@/utils/stripe': stripeUrl,
  '@/utils/storePlanUpgrade': upgradeUrl,
  '@/utils/commissions': moduleUrl('export const recordCommission = () => {}; export const commissionTerms = () => ({holdDays: 0});'),
  '@/utils/discountCodes': discountsUrl,
  '@/utils/coordinator': moduleUrl('export const selfReferral = () => null;'),
  '@/utils/storePlanCheckout': moduleUrl(`export const reserveStorePlanCheckout = () => ({attempt: '${attempt}',expiresAt: 1794490000}); export const bindStorePlanCheckout = (...a) => globalThis.__storePlanBind(...a); export const releaseStorePlanCheckout = () => {};`),
}));
const adapter = { from() { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null }), upsert: async () => ({ error: null }) }; },
  rpc: async (name, args) => { rpc = { name, args }; return { error: null }; },
};
const base = { kind: 'store', userId: legacy, storeId: store, vendorId: null, origin: 'https://example.com', returnPath: '/store/manage' };
await assert.rejects(createSubscriptionCheckout(adapter, { ...base, slots: 30, consent: { version: STORE_PLAN_TERMS_VERSION, slots: 30, first_cents: 500, recurring_cents: 500 } }), /Review the current plan price/);
assert.equal(sent, undefined);
for (const { slots, cents } of STORE_SLOT_PLANS) {
  const consent = { version: STORE_PLAN_TERMS_VERSION, slots, first_cents: cents, recurring_cents: cents };
  await createSubscriptionCheckout(adapter, { ...base, slots, consent });
  assert.equal(sent.body.line_items[0].price_data.unit_amount, cents);
  assert.equal(sent.body.line_items[0].price_data.recurring.interval, 'month');
  assert.equal(sent.body.subscription_data.metadata.store_slots, String(slots));
  assert.equal(sent.body.subscription_data.metadata.store_plan_version, STORE_PLAN_TERMS_VERSION);
  assert.equal(bind[3], 'cs_test');
  subscription = { id: 'sub_test', status: 'active', customer: 'cus_test', metadata: sent.body.subscription_data.metadata,
    items: { data: [{ quantity: 1, price: { currency: 'usd', unit_amount: cents, recurring: { interval: 'month', interval_count: 1 } } }] },
  };
  await handleSubscriptionEvent(adapter, { type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_test', payment_status: 'unpaid' } } });
  assert.equal(rpc.args.p_can_activate, false);
  await handleSubscriptionEvent(adapter, { type: 'invoice.paid', data: { object: { status: 'paid', subscription: 'sub_test', amount_paid: cents } } });
  assert.equal(rpc.args.p_can_activate, true);
  assert.equal(rpc.args.p_slots, slots);
  subscription.items.data[0].price.unit_amount = cents - 1;
  await assert.rejects(handleSubscriptionEvent(adapter, { type: 'invoice.paid', data: { object: { status: 'paid', subscription: 'sub_test', amount_paid: cents } } }), /does not match the selected store plan/);
}

// Exercise upgrade reservations and activation against the migrated table.
const { requestStoreUpgrade, storeUpgradeStatus, cancelStoreUpgrade } = await import(upgradeUrl);
await db.query(sync(false, 'active'));
const upgradeDb = {
  from(table) {
    if (table === 'stripe_subscriptions') return { upsert: async () => ({ error: null }) };
    assert.equal(table, 'store_catalog_plans');
    const filters = [];
    const args = [];
    let changes;
    return {
      select() { return this; },
      update(values) { changes = values; return this; },
      eq(column, value) {
        filters.push(`${column === 'pending_upgrade->>id' ? "pending_upgrade->>'id'" : column} = $${args.push(value)}`);
        return this;
      },
      is(column, value) { assert.equal(value, null); filters.push(`${column} is null`); return this; },
      async maybeSingle() {
        const where = filters.join(' and ');
        const assignments = Object.entries(changes ?? {}).map(([column, value]) => {
          const json = column === 'pending_upgrade' && value !== null;
          return `${column} = $${args.push(json ? JSON.stringify(value) : value)}`;
        });
        const statement = changes
          ? `update public.store_catalog_plans set ${assignments.join(', ')} where ${where} returning *`
          : `select * from public.store_catalog_plans where ${where}`;
        return { data: (await db.query(statement, args)).rows[0] ?? null, error: null };
      },
    };
  },
  async rpc(name, values) {
    assert.equal(name, 'sync_store_plan_subscription');
    await db.query('select public.sync_store_plan_subscription($1, $2, $3, $4, $5, $6)', Object.values(values));
    return { error: null };
  },
};

const now = Math.floor(Date.now() / 1000);
const periodEnd = now + 15 * 86400;
const price = slots => ({
  id: `price_${slots}`, unit_amount: slots * 100, currency: 'usd',
  recurring: { interval: 'month', interval_count: 1 }, metadata: { northedm_upgrade_slots: String(slots) },
});
const targetPrices = STORE_SLOT_PLANS.map(plan => price(plan.slots));
subscription = {
  id: 'sub_test', status: 'active', collection_method: 'charge_automatically', customer: 'cus_test',
  metadata: { kind: 'store', user_id: legacy, store_id: store, store_plan_attempt: attempt,
    store_slots: '5', store_plan_list_cents: '500', store_plan_version: STORE_PLAN_TERMS_VERSION },
  items: { data: [{ id: 'si_test', quantity: 1, price: { ...price(5), metadata: {} },
    current_period_start: now - 15 * 86400, current_period_end: periodEnd }] },
  latest_invoice: { id: 'in_original', status: 'paid', total: 500 },
};
function previewLine(amount, date, priceId, proration) {
  return {
    amount, period: { start: date }, pricing: { price_details: { price: priceId } },
    parent: { subscription_item_details: { subscription_item: 'si_test', proration } },
  };
}
let updateCalls = 0;
let payImmediately = false;
let chargedPrice;
let adjustmentInvoice;
const stripe = globalThis.__storePlanStripe;
stripe.prices = { list: async ({ lookup_keys }) => ({ data: targetPrices.filter(p => lookup_keys[0] ===
  `northedm-store-monthly-${p.metadata.northedm_upgrade_slots}-${p.unit_amount}`) }) };
stripe.invoices = {
  createPreview: async ({ subscription_details: details, preview_mode: mode }) => {
    const newPrice = targetPrices.find(p => p.id === details.items[0].price);
    if (mode === 'recurring') return { total: newPrice.unit_amount };
    const oldPrice = subscription.items.data[0].price;
    return { currency: 'usd', starting_balance: 0, lines: { data: [
      previewLine(-oldPrice.unit_amount / 2, details.proration_date, oldPrice.id, true),
      previewLine(newPrice.unit_amount / 2, details.proration_date, newPrice.id, true),
      previewLine(newPrice.unit_amount, periodEnd, newPrice.id, false),
    ] } };
  },
  voidInvoice: async invoiceId => {
    assert.equal(invoiceId, adjustmentInvoice.id);
    adjustmentInvoice.status = 'void';
    subscription.pending_update = null;
  },
};
stripe.subscriptions.update = async (id, options, request) => {
  assert.equal(id, subscription.id);
  assert.equal(options.payment_behavior, 'pending_if_incomplete');
  assert.equal(options.proration_behavior, 'always_invoice');
  assert.equal(options.billing_cycle_anchor, 'unchanged');
  assert.match(request.idempotencyKey, /^store-upgrade-/);
  chargedPrice = targetPrices.find(p => p.id === options.items[0].price);
  adjustmentInvoice = { id: `in_upgrade_${++updateCalls}`, status: 'open', currency: 'usd',
    billing_reason: 'subscription_update', created: options.proration_date,
    parent: { subscription_details: { subscription: id } },
    hosted_invoice_url: 'https://invoice.test/upgrade',
    lines: { data: [previewLine(chargedPrice.unit_amount / 2, options.proration_date, chargedPrice.id, true)] } };
  subscription.latest_invoice = adjustmentInvoice;
  subscription.pending_update = payImmediately ? null : { expires_at: periodEnd };
  if (payImmediately) {
    adjustmentInvoice.status = 'paid';
    subscription.items.data[0].price = chargedPrice;
  }
  return subscription;
};

const sellerStore = { id: store, owner_user_id: legacy };
const { quote: firstUpgrade } = await requestStoreUpgrade(upgradeDb, sellerStore, 10);
assert.equal(firstUpgrade.adjustment_cents, 250);
assert.equal(firstUpgrade.recurring_cents, 1000);
assert.equal(firstUpgrade.period_end, periodEnd);
assert.equal(updateCalls, 0);
await assert.rejects(requestStoreUpgrade(upgradeDb, sellerStore, 10, { ...firstUpgrade, adjustment_cents: 1 }), /price changed/);
assert.equal(updateCalls, 0);
const requests = await Promise.allSettled([1, 2].map(() => requestStoreUpgrade(upgradeDb, sellerStore, 10, firstUpgrade)));
const pending = requests.find(result => result.status === 'fulfilled').value;
assert.equal(pending.pending, true);
assert.equal(pending.slots, 5);
assert.equal(pending.payment_url, 'https://invoice.test/upgrade');
assert.equal(updateCalls, 1);
assert.equal((await storeUpgradeStatus(upgradeDb, sellerStore)).slots, 5);
await assert.rejects(db.exec(`update public.store_catalog_plans set listing_groups=array[1,2,3,4,5,6] where store_id='${store}'`), /store_catalog_capacity/);

// A paid invoice without the price change is not sufficient. A later
// subscription update applies the confirmed entitlement and is idempotent.
adjustmentInvoice.status = 'paid';
const paidEvent = { type: 'invoice.paid', data: { object: adjustmentInvoice } };
await handleSubscriptionEvent(upgradeDb, paidEvent);
assert.equal((await storeUpgradeStatus(upgradeDb, sellerStore)).slots, 5);
subscription.items.data[0].price = chargedPrice;
subscription.pending_update = null;
await handleSubscriptionEvent(upgradeDb, { type: 'customer.subscription.updated', data: { object: subscription } });
await handleSubscriptionEvent(upgradeDb, paidEvent);
assert.deepEqual(await storeUpgradeStatus(upgradeDb, sellerStore), { slots: 10, pending: false });
await db.exec(`update public.store_catalog_plans set listing_groups=array[1,2,3,4,5,6] where store_id='${store}'`);
await assert.rejects(requestStoreUpgrade(upgradeDb, sellerStore, 5), /higher store plan/);
const { quote: secondUpgrade } = await requestStoreUpgrade(upgradeDb, sellerStore, 15);
assert.equal(secondUpgrade.adjustment_cents, 250);
await requestStoreUpgrade(upgradeDb, sellerStore, 15, secondUpgrade);
assert.deepEqual(await cancelStoreUpgrade(upgradeDb, sellerStore), { slots: 10, pending: false });
assert.equal(adjustmentInvoice.status, 'void');
stripe.invoices.list = async () => ({ data: [paidEvent.data.object] });
payImmediately = true;
const { quote: retryUpgrade } = await requestStoreUpgrade(upgradeDb, sellerStore, 15);
assert.deepEqual(await requestStoreUpgrade(upgradeDb, sellerStore, 15, retryUpgrade), { slots: 15, pending: false });
await db.close();

delete globalThis.__storePlanStripe;
delete globalThis.__storePlanBind;
console.log('Store plans: prices, consent, private access, listing capacity, duplicate checkout, verified activation, and paid upgrades passed.');
