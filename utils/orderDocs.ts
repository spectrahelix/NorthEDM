import { createHmac } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { loadShippingSettings, type ShipFrom } from "@/utils/shipping";

/**
 * One shape for every order document, whichever table the order lives in:
 *   shop  — NorthEDM's own shop (shop_orders / shop_products)
 *   store — a vendor's embedded store (store_orders / products)
 * Invoice, receipt and label all render from this.
 */
export type DocKind = "shop" | "store";
export type Party = ShipFrom & { name?: string };
export type DocLine = { name: string; qty: number; unit_cents: number; total_cents: number; hs_code?: string | null; origin?: string | null; weight_g?: number | null };
export type OrderDoc = {
  kind: DocKind; id: string; number: string; created_at: string; paid_at: string | null; fulfilled_at: string | null; status: string;
  seller: Party; buyer: Party; lines: DocLine[];
  subtotal_cents: number; discount_cents: number; shipping_cents: number; total_cents: number; currency: string;
  shipping: { country: string | null; zone: string | null; service: string | null; eta: string | null; weight_g: number | null; tracking: string | null };
  payment: string; paid: boolean; international: boolean; store_slug: string | null;
};

const DEFAULT_SELLER: Party = { name: "NorthEDM", city: "Nescopeck", region: "PA", country: "US", email: "cjblue27@gmail.com" };

/** Unguessable link token so a customer can open their receipt from an email without an account. */
export function docToken(kind: DocKind, id: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.STRIPE_WEBHOOK_SECRET ?? "northedm";
  return createHmac("sha256", secret).update(`${kind}:${id}`).digest("hex").slice(0, 24);
}
export function docPath(kind: DocKind, id: string, doc: "invoice" | "receipt" | "label", withToken = true): string {
  return `/orders/${kind}/${id}/${doc}${withToken ? `?t=${docToken(kind, id)}` : ""}`;
}

function shortNumber(kind: DocKind, id: string, created: string): string {
  return `${kind === "shop" ? "NE" : "ST"}-${created.slice(2, 4)}${created.slice(5, 7)}-${id.slice(0, 6).toUpperCase()}`;
}
function addressFromStripe(a: Record<string, string> | null | undefined): Party {
  if (!a) return {};
  return { line1: a.line1 ?? undefined, line2: a.line2 ?? undefined, city: a.city ?? undefined, region: a.state ?? undefined, postal_code: a.postal_code ?? undefined, country: a.country ?? undefined };
}

export async function loadOrderDoc(admin: SupabaseClient, kind: DocKind, id: string): Promise<OrderDoc | null> {
  if (kind === "shop") {
    const { data: o } = await admin.from("shop_orders").select("*").eq("id", id).maybeSingle();
    if (!o) return null;
    const items = (o.items ?? []) as { product_id: string; name: string; price_cents: number; qty: number }[];
    const { data: prods } = items.length ? await admin.from("shop_products").select("id, hs_code, origin_country, weight_g").in("id", items.map((i) => i.product_id)) : { data: [] };
    const byId = new Map((prods ?? []).map((p) => [p.id as string, p]));
    const settings = await loadShippingSettings(admin);
    const seller: Party = { ...DEFAULT_SELLER, ...(settings.ship_from ?? {}) };
    const buyer: Party = { name: o.ship_name ?? undefined, email: o.email ?? undefined, ...addressFromStripe(o.ship_address) };
    const country = (o.ship_country as string | null) ?? buyer.country ?? null;
    return {
      kind, id, number: shortNumber(kind, id, o.created_at), created_at: o.created_at, paid_at: o.paid_at ?? null, fulfilled_at: o.fulfilled_at ?? null, status: o.status,
      seller, buyer,
      lines: items.map((i) => ({ name: i.name, qty: i.qty, unit_cents: i.price_cents, total_cents: i.price_cents * i.qty, hs_code: byId.get(i.product_id)?.hs_code ?? null, origin: byId.get(i.product_id)?.origin_country ?? "US", weight_g: byId.get(i.product_id)?.weight_g ?? null })),
      subtotal_cents: Number(o.subtotal_cents ?? 0), discount_cents: Number(o.discount_cents ?? 0), shipping_cents: Number(o.shipping_cents ?? 0), total_cents: Number(o.total_cents ?? 0), currency: "USD",
      shipping: { country, zone: o.shipping_zone ?? null, service: o.shipping_service ?? null, eta: o.shipping_eta ?? null, weight_g: o.package_weight_g ?? null, tracking: o.tracking_number ?? null },
      payment: o.status === "paid" || o.status === "shipped" || o.status === "delivered" ? "Paid by card (Stripe)" : "Unpaid", paid: ["paid", "shipped", "delivered", "fulfilled"].includes(o.status),
      international: !!country && country !== (seller.country ?? "US"), store_slug: null,
    };
  }
  const { data: o } = await admin.from("store_orders").select("*").eq("id", id).maybeSingle();
  if (!o) return null;
  const { data: st } = await admin.from("stores").select("slug, name, owner_user_id, ship_from").eq("id", o.store_id).maybeSingle();
  const items = (o.items ?? []) as { product_id: number; vendor_id: number; name: string; price_cents: number; qty: number }[];
  const { data: prods } = items.length ? await admin.from("products").select("id, hs_code, origin_country, weight_g").in("id", items.map((i) => i.product_id)) : { data: [] };
  const byId = new Map((prods ?? []).map((p) => [Number(p.id), p]));
  let seller: Party = { name: st?.name ?? "Store", ...((st?.ship_from as Party | null) ?? {}) };
  if (!seller.country) {
    const { data: v } = o.vendor_id ? await admin.from("vendors").select("name, area, region, currency").eq("id", o.vendor_id).maybeSingle() : { data: null };
    seller = { ...seller, city: seller.city ?? v?.area ?? undefined, country: v?.currency === "GMD" ? "GM" : "US" };
  }
  const buyer: Party = { name: o.ship_name ?? undefined, email: o.email ?? undefined, ...addressFromStripe(o.ship_address) };
  const country = (o.ship_country as string | null) ?? buyer.country ?? null;
  const paidStatuses = ["paid", "fulfilled", "shipped"];
  const wallet = o.payment_method && o.payment_method !== "card";
  return {
    kind, id, number: shortNumber(kind, id, o.created_at), created_at: o.created_at, paid_at: o.paid_at ?? o.payment_confirmed_at ?? null, fulfilled_at: o.fulfilled_at ?? null, status: o.status,
    seller, buyer,
    lines: items.map((i) => ({ name: i.name, qty: i.qty, unit_cents: i.price_cents, total_cents: i.price_cents * i.qty, hs_code: byId.get(Number(i.product_id))?.hs_code ?? null, origin: byId.get(Number(i.product_id))?.origin_country ?? seller.country ?? "US", weight_g: byId.get(Number(i.product_id))?.weight_g ?? null })),
    subtotal_cents: Number(o.subtotal_cents ?? 0), discount_cents: 0, shipping_cents: Number(o.shipping_cents ?? 0), total_cents: Number(o.total_cents ?? 0) + Number(o.shipping_cents ?? 0), currency: String(o.currency || "USD"),
    shipping: { country, zone: o.shipping_zone ?? null, service: o.shipping_service ?? null, eta: o.shipping_eta ?? null, weight_g: o.package_weight_g ?? null, tracking: o.tracking_number ?? null },
    payment: paidStatuses.includes(o.status) ? (wallet ? `Paid by ${o.payment_method}${o.payment_ref ? ` · ref ${o.payment_ref}` : ""}` : "Paid by card (Stripe)") : o.status === "authorized" ? "Card held — charged at handover" : "Unpaid",
    paid: paidStatuses.includes(o.status), international: !!country && !!seller.country && country !== seller.country, store_slug: st?.slug ?? null,
  };
}

/** Who may open a document: a valid link token, an admin, the buyer, or (store) the operator. */
export async function canViewDoc(admin: SupabaseClient, user: User | null, kind: DocKind, id: string, token: string | null): Promise<boolean> {
  if (token && token === docToken(kind, id)) return true;
  if (!user) return false;
  const { data: me } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role === "archon" || me?.role === "warden" || user.email === "cjblue27@gmail.com") return true;
  const table = kind === "shop" ? "shop_orders" : "store_orders";
  const { data: o } = await admin.from(table).select("customer_id, email, store_id").eq("id", id).maybeSingle();
  if (!o) return false;
  if (o.customer_id === user.id || (o.email && o.email === user.email)) return true;
  if (kind === "store" && o.store_id) {
    const { data: st } = await admin.from("stores").select("owner_user_id").eq("id", o.store_id).maybeSingle();
    if (st?.owner_user_id === user.id) return true;
  }
  return false;
}
