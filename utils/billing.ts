import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";
import { recordCommission, commissionTerms } from "@/utils/commissions";
import { applyCode, describeCode, redeemCode, resolveCode, type ResolvedCode } from "@/utils/discountCodes";
import { selfReferral } from "@/utils/coordinator";

/**
 * Card-paid monthly subscriptions (owner's model, 2026-11-02):
 *   festdash — a US vendor's FestDash listing. Listed and orderable only while
 *              active; the wallet-rail (Gambia) shops pay their coordinator
 *              instead and are not touched by this.
 *   store    — an embedded store's monthly fee; drives stores.billing_status.
 * Price: coordinator_program_settings.subscription_fee_cents ($30 by default).
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
export async function quote(admin: SupabaseClient, vendorId: number | null, kind: SubscriptionKind = "festdash", typedCode?: string | null) {
  const s = await settings(admin);
  const list_cents = kind === "bundle" ? s.bundle_fee_cents : s.subscription_fee_cents;
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
  };
}

/** Start Stripe Checkout for a subscription. The webhook finishes the job. */
export async function createSubscriptionCheckout(
  admin: SupabaseClient,
  args: { kind: SubscriptionKind; userId: string; email?: string | null; vendorId: number | null; storeId?: string | null; origin: string; returnPath: string; code?: string | null }
) {
  const q = await quote(admin, args.vendorId, args.kind, args.code);
  if (q.invalid_code) throw new Error("That code isn't valid or has already been used.");
  const stripe = getStripe();
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
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    adaptive_pricing: { enabled: true },
    customer_email: args.email ?? undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: q.list_cents,
        recurring: { interval: "month" },
        product_data: { name: `NorthEDM ${SUBSCRIPTION_LABEL[args.kind]}${args.kind === "bundle" ? " — buy one, get one half off" : ""}` },
      },
    }],
    ...(discounts.length ? { discounts } : {}),
    subscription_data: {
      metadata: {
        kind: args.kind, user_id: args.userId, vendor_id: args.vendorId ? String(args.vendorId) : "",
        store_id: args.storeId ?? "", promoter_user_id: q.promoter_user_id ?? "",
        discount_code_id: q.code?.kind === "discount" ? q.code.id : "", discount_code: q.code?.code ?? "",
      },
    },
    metadata: { kind: `subscription_${args.kind}`, discount_code_id: q.code?.kind === "discount" ? q.code.id : "", user_id: args.userId },
    success_url: `${args.origin}${args.returnPath}?billing=ok`,
    cancel_url: `${args.origin}${args.returnPath}?billing=canceled`,
  });
  return { url: session.url, amount_cents: q.amount_cents };
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

async function upsertFromSubscription(db: SupabaseClient, sub: SubLike) {
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
  const { error } = await db.from("stripe_subscriptions").upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) console.error("stripe_subscriptions upsert failed:", error.message);
  // A store's switch lives on the store row itself (checkout + storefront read it).
  // The bundle carries the store too.
  if ((kind === "store" || kind === "bundle") && row.store_id) {
    const billing = ACTIVE.has(sub.status) ? "active" : sub.status === "past_due" ? "past_due" : "canceled";
    await db.from("stores").update({ billing_status: billing, stripe_subscription_id: sub.id }).eq("id", row.store_id);
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
    await upsertFromSubscription(db, sub);
    // A discount code is spent when the checkout completes, not when it is typed.
    const codeId = session.metadata?.discount_code_id;
    if (codeId) await redeemCode(db, codeId, session.metadata?.user_id || null);
    return true;
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await upsertFromSubscription(db, event.data.object as SubLike);
    return true;
  }
  if (event.type === "invoice.paid") {
    const inv = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
    const raw = inv.subscription ?? (inv as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } }).parent?.subscription_details?.subscription;
    const subId = typeof raw === "string" ? raw : raw?.id;
    if (!subId) return false;
    const sub = (await stripe.subscriptions.retrieve(subId)) as SubLike;
    const row = await upsertFromSubscription(db, sub);
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
