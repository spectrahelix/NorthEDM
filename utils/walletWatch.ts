import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyWalletIssue } from "@/utils/alerts";
import { formatMoney } from "@/utils/money";
import { orderRef } from "@/utils/gambiaPay";

/**
 * Guards for wallet (Wave / QMoney / Afrimoney) payments, which go to a
 * coordinator's own number and so can't be checked by the site. Nothing here
 * can stop a coordinator keeping a payment; it makes it visible within a day
 * and gives the customer and the shop a direct line to the owner.
 *   - a payment with a customer reference that is rejected → owner alerted now
 *   - one left unconfirmed 24h after the reference → owner alerted (daily cron)
 *   - the customer can report "I paid, it wasn't confirmed" → owner alerted
 *   - the owner's Wallet watch panel lists all of these until resolved
 */
export type WatchKind = "festdash" | "store";
export type WatchRow = {
  kind: WatchKind; id: string; ref: string; vendor_id: number | null; vendor_name: string | null; coordinator: string | null;
  amount_cents: number; currency: string; method: string | null; customer_ref: string; paid_to: string | null;
  state: "unconfirmed" | "rejected" | "reported"; created_at: string; ref_at: string | null; disputed_at: string | null; note: string | null; escalated_at: string | null;
};
const DAY = 24 * 3600e3;
const WALLETS = ["wave", "qmoney", "afrimoney"];

type Raw = { id: string; vendor_id: number | null; status: string; payment_status?: string | null; payment_method: string | null; payment_ref: string | null; payment_to: string | null; total_cents: number; currency: string | null; created_at: string; payment_ref_at: string | null; payment_disputed_at: string | null; payment_dispute_note: string | null; payment_escalated_at: string | null };
const COLS = "id, vendor_id, status, payment_method, payment_ref, payment_to, total_cents, currency, created_at, payment_ref_at, payment_disputed_at, payment_dispute_note, payment_escalated_at";

function stateOf(kind: WatchKind, r: Raw): WatchRow["state"] | null {
  if (r.payment_disputed_at) return "reported";
  const rejected = kind === "festdash" ? r.payment_status === "rejected" : r.status === "canceled";
  if (rejected) return "rejected";
  const since = new Date(r.payment_ref_at ?? r.created_at).getTime();
  if (r.status === "awaiting_confirmation" && Date.now() - since > DAY) return "unconfirmed";
  return null;
}

/** Every open wallet-payment concern, newest first (owner's panel). */
export async function loadWalletWatch(admin: SupabaseClient, opts: { vendorId?: number } = {}): Promise<WatchRow[]> {
  const q = (t: string, extra = "") => {
    let b = admin.from(t).select(COLS + extra).not("payment_ref", "is", null).in("payment_method", WALLETS).is("payment_watch_resolved_at", null).order("created_at", { ascending: false }).limit(300);
    if (opts.vendorId) b = b.eq("vendor_id", opts.vendorId);
    return b;
  };
  const [{ data: fd }, { data: st }] = await Promise.all([q("festdash_orders", ", payment_status"), q("store_orders")]);
  const raw: [WatchKind, Raw][] = [...((fd ?? []) as unknown as Raw[]).map((r) => ["festdash", r] as [WatchKind, Raw]), ...((st ?? []) as unknown as Raw[]).map((r) => ["store", r] as [WatchKind, Raw])];
  const open = raw.map(([k, r]) => ({ k, r, s: stateOf(k, r) })).filter((x) => x.s);
  const vids = [...new Set(open.map((x) => x.r.vendor_id).filter((v): v is number => v != null))];
  const { data: vend } = vids.length ? await admin.from("vendors").select("id, name, coordinator_user_id").in("id", vids) : { data: [] };
  const coordIds = [...new Set((vend ?? []).map((v) => v.coordinator_user_id).filter(Boolean))] as string[];
  const { data: coords } = coordIds.length ? await admin.from("festdash_promoters").select("user_id, display_name").in("user_id", coordIds) : { data: [] };
  const vmap = new Map((vend ?? []).map((v) => [Number(v.id), v]));
  const cname = new Map((coords ?? []).map((c) => [c.user_id as string, c.display_name as string | null]));
  return open.map(({ k, r, s }) => {
    const v = r.vendor_id != null ? vmap.get(Number(r.vendor_id)) : undefined;
    return {
      kind: k, id: r.id, ref: orderRef(r.id), vendor_id: r.vendor_id, vendor_name: (v?.name as string | null) ?? null,
      coordinator: v?.coordinator_user_id ? cname.get(v.coordinator_user_id as string) ?? "coordinator" : null,
      amount_cents: Number(r.total_cents ?? 0), currency: String(r.currency || "USD"), method: r.payment_method, customer_ref: String(r.payment_ref),
      paid_to: r.payment_to, state: s!, created_at: r.created_at, ref_at: r.payment_ref_at, disputed_at: r.payment_disputed_at, note: r.payment_dispute_note, escalated_at: r.payment_escalated_at,
    };
  });
}

function describe(r: Pick<WatchRow, "ref" | "amount_cents" | "currency" | "method" | "customer_ref" | "paid_to" | "vendor_name" | "coordinator">) {
  return `${r.ref} · ${formatMoney(r.amount_cents, r.currency)} by ${r.method} to ${r.paid_to ?? "?"} · customer's reference ${r.customer_ref} · shop ${r.vendor_name ?? "?"} · coordinator ${r.coordinator ?? "?"}`;
}

/** Owner alert the moment a coordinator rejects a payment the customer gave a reference for. */
export async function alertRejectedWithRef(admin: SupabaseClient, kind: WatchKind, id: string) {
  const rows = await loadWalletWatch(admin);
  const r = rows.find((x) => x.kind === kind && x.id === id);
  if (!r) return;
  await notifyWalletIssue({ title: `Wallet payment rejected · ${r.ref}`, message: `A coordinator rejected a payment the customer says they sent: ${describe(r)}. Check it with the customer.` });
}

/** Daily: alert once for every payment still unconfirmed 24h after the customer's reference. */
export async function escalateStaleWalletPayments(admin: SupabaseClient) {
  const rows = (await loadWalletWatch(admin)).filter((r) => r.state === "unconfirmed" && !r.escalated_at);
  for (const r of rows) {
    await notifyWalletIssue({ title: `Wallet payment unconfirmed for 24h · ${r.ref}`, message: `Still waiting for the coordinator to confirm: ${describe(r)}.` });
    await admin.from(r.kind === "festdash" ? "festdash_orders" : "store_orders").update({ payment_escalated_at: new Date().toISOString() }).eq("id", r.id);
  }
  return { escalated: rows.length };
}

/** The customer reports a payment that wasn't confirmed. Returns an error string or null. */
export async function reportWalletPayment(admin: SupabaseClient, kind: WatchKind, id: string, userId: string, note: string): Promise<string | null> {
  const table = kind === "festdash" ? "festdash_orders" : "store_orders";
  const { data: o } = await admin.from(table).select(COLS + ", customer_id" + (kind === "festdash" ? ", payment_status" : "")).eq("id", id).maybeSingle();
  const r = o as unknown as (Raw & { customer_id: string | null }) | null;
  if (!r || r.customer_id !== userId) return "Order not found.";
  if (!r.payment_ref || !WALLETS.includes(String(r.payment_method))) return "Only a wallet payment with a transaction reference can be reported.";
  if (r.payment_disputed_at) return "Already reported — NorthEDM has it.";
  const rejected = kind === "festdash" ? r.payment_status === "rejected" : r.status === "canceled";
  const waited = Date.now() - new Date(r.payment_ref_at ?? r.created_at).getTime() > DAY;
  if (!(rejected || (r.status === "awaiting_confirmation" && waited))) return "You can report this once it has waited 24 hours, or if it was rejected.";
  await admin.from(table).update({ payment_disputed_at: new Date().toISOString(), payment_dispute_note: note.trim().slice(0, 600) || null, payment_watch_resolved_at: null }).eq("id", id);
  const rows = await loadWalletWatch(admin);
  const row = rows.find((x) => x.kind === kind && x.id === id);
  if (row) await notifyWalletIssue({ title: `Customer reports an unconfirmed payment · ${row.ref}`, message: `${describe(row)}${note.trim() ? ` · customer says: "${note.trim().slice(0, 300)}"` : ""}` });
  return null;
}
