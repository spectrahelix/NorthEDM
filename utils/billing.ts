import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";
import { recordCommission, commissionTerms } from "@/utils/commissions";
import { applyCode, describeCode, redeemCode, resolveCode, type ResolvedCode } from "@/utils/discountCodes";
import { selfReferral } from "@/utils/coordinator";
import { BUNDLE_STORE_SLOTS, STORE_PLAN_TERMS_VERSION, storeSlotPlan } from "@/utils/storePlans";
import { bindStorePlanCheckout, releaseStorePlanCheckout, reserveStorePlanCheckout } from "@/utils/storePlanCheckout";

/**
 * Card-paid monthly subscriptions (owner's model, 2026-11-02):
 *   festdash — a US vendor's FestDash listing. Listed and orderable only while
 *              active; the wallet-rail (Gambia) shops pay their coordinator
 *              instead and are not touched by this.
 *   store    — an embedded store's monthly fee; drives stores.billing_status.
 * FestDash and bundle fees use coordinator settings. Store-only plans use the
 * slot catalog in storePlans.ts, with the chosen terms and price sent to Stripe.
 * A shop that signed up with any promoter's code pays referral_fee_discount_bps
 * less, and that promoter is booked subscription_coordinator_bps of every
 * payment (paid out through Connect by the commissions cron). The rest is the
 * owner's and simply stays on the platform balance. Stripe is the source of
 * truth; the webhook mirrors status + period end into stripe_subscriptions.
 */
export type SubscriptionKind = "festdash" | "store" | "bundle";
export const SUBSCRIPTION_LABEL: Record<SubscriptionKind, string> = {
  festdash: "FestDash listing",
  store: "Store subscription",
  bundle: "FestDash + Store bundle",
};
export function asKind(v: unknown): SubscriptionKind { return v === "store" ? "store" : v === "bundle" ? "bundle" : "festdash"; }
const ACTIVE = new Set(["active", "trialing"]);
const GRACE_MS = 3 * 86400000; // a failed renewal retry gets a few days before the switch flips

type Settings = { subscription_fee_cents: number; subscription_coordinator_bps: number; referral_fee_discount_bps: number; bundle_fee_cents: number };
async function settings(admin: SupabaseClient): Promise<Settings> {
  const { data } = await admin
    .from("coordinator_program_settings")
    .select("subscription_fee_cents, subscription_coordinator_bps, referral_fee_discount_bps, bundle_fee_cents")
    .eq("id", 1)
    .maybeSingle();
  return { subscription_fee_cents: 3000, subscription_coordinator_bps: 1000, referral_fee_discount_bps: 1000, bundle_fee_cents: 4500, ...(data ?? {}) };
}

/** The promoter who referred this vendor and the code it signed up with, if any. */
async function vendorReferral(admin: SupabaseClient, vendorId: number | null): Promise<{ promoter: string | null; signupCode: string | null }> {
  if (!vendorId) return { promoter: null, signupCode: null };
  const { data } = await admin.from("vendors").select("user_id, coordinator_user_id, signup_code").eq("id", vendorId).maybeSingle();
  // A promoter's own shop counts as referred by them (10% off, they keep the share).
  const promoter = (data?.coordinator_user_id as string | null) ?? (await selfReferral(admin, data?.user_id as string | null))?.user_id ?? null;
  return { promoter, signupCode: (data?.signup_code as string | null) ?? null };
}

/**
 * What a checkout costs. Precedence: a code typed now → the code the shop
 * applied with → the shop's referring promoter (referral rate). The first
 * invoice is `amount_cents`; `recurring_cents` is every month after.
 */
export async function quote(admin: SupabaseClient, vendorId: number | null, kind: SubscriptionKind = "festdash", typedCode?: string | null, slots?: unknown) {
  const s = await settings(admin);
  const plan = kind === "store" ? storeSlotPlan(slots ?? 5) : undefined;
  if (kind === "store" && !plan) throw new Error("Choose a 5, 10, 15, or 30 slot store plan.");
  const list_cents = kind === "bundle" ? s.bundle_fee_cents : plan?.cents ?? s.subscription_fee_cents;
  const ref = await vendorReferral(admin, vendorId);
  let code: ResolvedCode | null = (await resolveCode(admin, typedCode, s.referral_fee_discount_bps)) ?? (await resolveCode(admin, ref.signupCode, s.referral_fee_discount_bps));
  const invalidTyped = !!String(typedCode ?? "").trim() && !code;
  if (!code && ref.promoter) code = { kind: "referral", code: "", promoter_user_id: ref.promoter, percent_off: s.referral_fee_discount_bps / 100 };
  const amount_cents = applyCode(list_cents, code);
  const recurring_cents = code && code.kind === "discount" && code.once ? list_cents : amount_cents;
  const promoter_user_id = code?.promoter_user_id ?? ref.promoter;
  return {
    kind, amount_cents, recurring_cents, list_cents, promoter_user_id, code,
    discounted: amount_cents < list_cents, discount_label: code ? describeCode(code) : null, invalid_code: invalidTyped,
    bundle_cents: s.bundle_fee_cents, single_cents: s.subscription_fee_cents,
    store_slots: plan?.slots ?? (kind === "bundle" ? BUNDLE_STORE_SLOTS : null),
  };
}

/** Start Stripe Checkout for a subscription. The webhook finishes the job. */
export async function createSubscriptionCheckout(
  admin: SupabaseClient,
  args: { kind: SubscriptionKind; userId: string; email?: string | null; vendorId: number | null; storeId?: string | null; origin: string; returnPath: string; code?: string | null;
    slots?: unknown; consent?: { version?: unknown; first_cents?: unknown; recurring_cents?: unknown; slots?: unknown } }
) {
  const q = await quote(admin, args.vendorId, args.kind, args.code, args.slots);
  if (q.invalid_code) throw new Error("That code isn't valid or has already been used.");
  const stripe = getStripe();
  let reservation: { attempt: string; expiresAt: number } | undefined;
  if (args.kind !== "festdash") {
    if (!args.storeId || !q.store_slots) throw new Error("Store not found.");
    const consent = args.consent;
    if (consent?.version !== STORE_PLAN_TERMS_VERSION || consent.slots !== q.store_slots ||
        consent.first_cents !== q.amount_cents || consent.recurring_cents !== q.recurring_cents) {
      throw new Error("Review the current plan price and agree to monthly billing before continuing.");
    }
    const prepared = await reserveStorePlanCheckout(admin, {
      storeId: args.storeId, vendorId: args.vendorId, kind: args.kind, slots: q.store_slots,
      quoteKey: JSON.stringify([args.kind, q.store_slots, q.amount_cents, q.recurring_cents, q.code?.code, q.promoter_user_id]),
    });
    if ("url" in prepared) return { url: prepared.url, amount_cents: q.amount_cents };
    reservation = prepared;
  }
  let session: Stripe.Checkout.Session | undefined;
  try {
    // The list price is the subscription; the code becomes a Stripe coupon so the
    // invoice shows the discount and a one-time code really is one-time.
    const discounts: { coupon: string }[] = [];
    if (q.code && q.amount_cents < q.list_cents) {
      const once = q.code.kind === "discount" && q.code.once;
      const coupon = await stripe.coupons.create({
        name: q.code.code ? `Code ${q.code.code}` : "Referral rate",
        duration: once ? "once" : "forever",
        ...(q.code.kind === "referral" || q.code.percent_off != null
          ? { percent_off: q.code.kind === "referral" ? q.code.percent_off : q.code.percent_off! }
          : { amount_off: q.code.amount_off_cents!, currency: "usd" }),
      });
      discounts.push({ coupon: coupon.id });
    }
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      adaptive_pricing: { enabled: !reservation },
      ...(reservation ? { expires_at: reservation.expiresAt, payment_method_types: ["card"] } : {}),
      customer_email: args.email ?? undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: q.list_cents,
          recurring: { interval: "month" },
          product_data: { name: `NorthEDM ${SUBSCRIPTION_LABEL[args.kind]}${q.store_slots ? ` · ${q.store_slots} product slots` : ""}` },
        },
      }],
      ...(discounts.length ? { discounts } : {}),
      subscription_data: {
        metadata: {
          kind: args.kind, user_id: args.userId, vendor_id: args.vendorId ? String(args.vendorId) : "",
          store_id: args.storeId ?? "", promoter_user_id: q.promoter_user_id ?? "",
          discount_code_id: q.code?.kind === "discount" ? q.code.id : "", discount_code: q.code?.code ?? "",
          ...(reservation ? {
            store_plan_attempt: reservation.attempt, store_slots: String(q.store_slots),
            store_plan_version: STORE_PLAN_TERMS_VERSION, store_plan_list_cents: String(q.list_cents),
            store_plan_first_cents: String(q.amount_cents), store_plan_recurring_cents: String(q.recurring_cents),
          } : {}),
        },
      },
      metadata: { kind: `subscription_${args.kind}`, discount_code_id: q.code?.kind === "discount" ? q.code.id : "", user_id: args.userId },
      success_url: `${args.origin}${args.returnPath}?billing=ok`,
      cancel_url: `${args.origin}${args.returnPath}?billing=canceled`,
    }, reservation ? { idempotencyKey: `store-plan-${reservation.attempt}` } : undefined);
    if (reservation && args.storeId) await bindStorePlanCheckout(admin, args.storeId, reservation.attempt, session.id);
    return { url: session.url, amount_cents: q.amount_cents };
  } catch (error) {
    if (reservation && args.storeId && !session) {
      await releaseStorePlanCheckout(admin, args.storeId, reservation.attempt).catch(e => console.error("Store plan reservation release failed:", e));
    }
    throw error;
  }
}

export async function billingPortalUrl(customerId: string, returnUrl: string): Promise<string> {
  const portal = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return portal.url;
}

export function isActiveRow(row: { status: string; current_period_end: string | null } | null | undefined): boolean {
  if (!row) return false;
  if (!ACTIVE.has(row.status)) return false;
  if (!row.current_period_end) return true;
  return new Date(row.current_period_end).getTime() + GRACE_MS > Date.now();
}

/** Which of these (card-rail) vendors currently hold an active FestDash listing. */
export async function festdashListingActive(admin: SupabaseClient, vendorIds: number[]): Promise<Set<number>> {
  const out = new Set<number>();
  if (!vendorIds.length) return out;
  const { data } = await admin
    .from("stripe_subscriptions")
    .select("vendor_id, status, current_period_end")
    .in("kind", ["festdash", "bundle"])
    .in("vendor_id", vendorIds);
  for (const r of data ?? []) if (isActiveRow(r) && r.vendor_id != null) out.add(Number(r.vendor_id));
  return out;
}

// ── webhook side ─────────────────────────────────────────────────────────────
type SubLike = Stripe.Subscription & { current_period_end?: number };
function periodEnd(sub: SubLike): string | null {
  const ts = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

async function upsertFromSubscription(db: SupabaseClient, sub: SubLike, paidCheckout = false) {
  const m = sub.metadata ?? {};
  const kind = m.kind === "store" ? "store" : m.kind === "festdash" ? "festdash" : m.kind === "bundle" ? "bundle" : null;
  if (!kind) return null;
  const row = {
    kind,
    vendor_id: m.vendor_id ? Number(m.vendor_id) : null,
    store_id: m.store_id || null,
    user_id: m.user_id || null,
    promoter_user_id: m.promoter_user_id || null,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_end: periodEnd(sub),
    amount_cents: sub.items?.data?.[0]?.price?.unit_amount ?? null,
    updated_at: new Date().toISOString(),
  };
  const billing = ACTIVE.has(sub.status) ? "active" : sub.status === "past_due" ? "past_due" : "canceled";
  if (m.store_plan_attempt) {
    const plan = storeSlotPlan(m.store_slots);
    const item = sub.items.data[0];
    const price = item?.price;
    const acceptedPrice = Number(m.store_plan_list_cents);
    if (!row.store_id || !plan || kind === "festdash" || (kind === "bundle" && plan.slots !== BUNDLE_STORE_SLOTS) ||
        (kind === "store" && acceptedPrice !== plan.cents) || !m.store_plan_version ||
        sub.items.data.length !== 1 || !item || !price || item.quantity !== 1 || price.currency !== "usd" || price.unit_amount !== acceptedPrice ||
        price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) {
      throw new Error("Stripe subscription does not match the selected store plan.");
    }
    const { error } = await db.rpc("sync_store_plan_subscription", {
      p_store_id: row.store_id, p_slots: plan.slots, p_attempt: m.store_plan_attempt,
      p_subscription_id: sub.id, p_billing_status: billing, p_can_activate: paidCheckout && sub.status === "active",
    });
    if (error) throw new Error(error.message);
  }
  const { error } = await db.from("stripe_subscriptions").upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) throw new Error(error.message);
  // A store's switch lives on the store row itself (checkout + storefront read it).
  // The bundle carries the store too.
  if (!m.store_plan_attempt && (kind === "store" || kind === "bundle") && row.store_id) {
    const { error } = await db.from("stores").update({ billing_status: billing, stripe_subscription_id: sub.id })
      .eq("id", row.store_id).or(`stripe_subscription_id.is.null,stripe_subscription_id.eq.${sub.id}`);
    if (error) throw new Error(error.message);
  }
  return row;
}

/** Returns true when the event was a subscription event and has been handled. */
export async function handleSubscriptionEvent(db: SupabaseClient, event: Stripe.Event): Promise<boolean> {
  const stripe = getStripe();
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || !session.subscription) return false;
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const sub = (await stripe.subscriptions.retrieve(subId)) as SubLike;
    await upsertFromSubscription(db, sub, session.payment_status === "paid" || session.payment_status === "no_payment_required");
    // A discount code is spent when the checkout completes, not when it is typed.
    const codeId = session.metadata?.discount_code_id;
    if (codeId) await redeemCode(db, codeId, session.metadata?.user_id || null);
    return true;
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const received = event.data.object as SubLike;
    const current = received.metadata?.store_plan_attempt ? await stripe.subscriptions.retrieve(received.id) : received;
    await upsertFromSubscription(db, current as SubLike);
    return true;
  }
  if (event.type === "invoice.paid") {
    const inv = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
    const raw = inv.subscription ?? (inv as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } }).parent?.subscription_details?.subscription;
    const subId = typeof raw === "string" ? raw : raw?.id;
    if (!subId) return false;
    const sub = (await stripe.subscriptions.retrieve(subId)) as SubLike;
    const row = await upsertFromSubscription(db, sub, inv.status === "paid");
    if (!row) return false;
    // The referring promoter's share of this payment — never when the promoter
    // is the owner (an archon), who already keeps the rest.
    const paid = Number(inv.amount_paid ?? 0);
    if (row.promoter_user_id && paid > 0) {
      const { data: prof } = await db.from("user_profiles").select("role").eq("id", row.promoter_user_id).maybeSingle();
      if (prof?.role !== "archon") {
        const s = await settings(db);
        const { holdDays } = await commissionTerms(db, "vendor_listing");
        await recordCommission(db, {
          promoterUserId: row.promoter_user_id,
          referredUserId: row.user_id,
          source: "vendor_listing",
          sourceId: inv.id,
          baseCents: paid,
          rateBps: s.subscription_coordinator_bps,
          holdDays,
        });
      }
    }
    return true;
  }
  return false;
}
