import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Waychit — The Gambia's payment aggregator (Wave, QMoney, Afrimoney, banks,
 * cards) — into NorthEDM's OWN merchant account (owner's decision, 2026-11-04).
 * Customers pay on Waychit's hosted page; the signed webhook confirms the
 * order; NorthEDM then pays the shop / coordinator / runner their shares from
 * the same account with Waychit Payouts. Docs: waychit.com/developers,
 * waychit.com/developers/payouts, waychit.com/merchant-agreement.
 *
 * SWITCHED OFF until all three hold: WAYCHIT_API_KEY and
 * WAYCHIT_WEBHOOK_SECRET are set in Vercel, and
 * coordinator_program_settings.waychit_enabled is on (/admin/festdash/coordinators).
 * There is NO sandbox: every call with a real key moves real dalasi.
 *
 * Amounts are WHOLE GMD (dalasi) at Waychit; the site stores bututs (×100).
 */
const BASE = "https://api.waychit.com";
export { WAYCHIT_MIN_GMD, waychitCharge } from "@/utils/waychitFee";
export const WAYCHIT_MAX_GMD = 300_000;
export const PAYOUT_CHANNELS = ["wave", "qmoney", "afrimoney", "bank"] as const;
export type PayoutChannel = (typeof PAYOUT_CHANNELS)[number];

export function waychitKeysPresent(): boolean {
  return !!process.env.WAYCHIT_API_KEY && !!process.env.WAYCHIT_WEBHOOK_SECRET;
}

export type WaychitState = { enabled: boolean; keys: boolean; fee_bps: number };
/** Live only when the keys exist AND the owner switched it on. */
export async function waychitState(admin: SupabaseClient): Promise<WaychitState> {
  const { data } = await admin.from("coordinator_program_settings").select("waychit_enabled, waychit_fee_bps").eq("id", 1).maybeSingle();
  const keys = waychitKeysPresent();
  return { enabled: keys && data?.waychit_enabled === true, keys, fee_bps: Number(data?.waychit_fee_bps ?? 300) };
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  const key = process.env.WAYCHIT_API_KEY;
  if (!key) throw new Error("Waychit isn't configured.");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json", ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(`Waychit ${res.status}: ${json?.message ?? "request failed"}`);
  return json;
}

export type PaymentRequest = { id: string; amount: number; currency: string; status: string; waychitLaunchUrl: string; expiresAt?: string; metadata?: Record<string, string> };

/** POST /v1/payment-requests — the hosted page for Wave / QMoney / Afrimoney / bank. */
export async function createPaymentRequest(input: {
  amountGmd: number; description: string; clientReference: string; successRedirectUrl: string; failureRedirectUrl: string; metadata: Record<string, string>;
}): Promise<PaymentRequest> {
  const j = await call<{ success: boolean; paymentRequest: PaymentRequest | null; message?: string }>("POST", "/v1/payment-requests", {
    amount: input.amountGmd, description: input.description.slice(0, 120), clientReference: input.clientReference,
    successRedirectUrl: input.successRedirectUrl, failureRedirectUrl: input.failureRedirectUrl, metadata: input.metadata,
  });
  if (!j.paymentRequest?.waychitLaunchUrl) throw new Error(j.message || "Waychit returned no payment page.");
  return j.paymentRequest;
}

/** GET /v1/payment-requests/{id} — re-read the request before trusting a webhook. */
export async function getPaymentRequest(id: string): Promise<PaymentRequest & { paymentStatus?: string }> {
  const j = await call<{ paymentRequest: PaymentRequest & { paymentStatus?: string } }>("GET", `/v1/payment-requests/${encodeURIComponent(id)}`);
  return j.paymentRequest;
}

/**
 * Waychit-Signature: `t=<unix>,v1=<hex>[,v1=<hex>]`; HMAC-SHA256 of
 * `${t}.${rawBody}` with the webhook secret, hex. Reject anything over 5 min old.
 */
export function verifyWaychitSignature(rawBody: string, header: string | null, secret = process.env.WAYCHIT_WEBHOOK_SECRET ?? "", nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  let t = "";
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.trim().split("=");
    if (k === "t") t = v ?? "";
    else if (k === "v1" && v) sigs.push(v);
  }
  if (!t || !sigs.length || !/^\d+$/.test(t) || Math.abs(nowSec - Number(t)) > 300) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"));
  return sigs.some((s) => { const b = Buffer.from(s); return b.length === expected.length && crypto.timingSafeEqual(b, expected); });
}

export type Payout = { id: string; status: string; amount: number; fee?: number; totalDebit?: number };

/** POST /v1/payouts — needs the key's `payouts` scope; idempotent per key. */
export async function createPayout(input: {
  channel: PayoutChannel; amountGmd: number; destination: string; name?: string | null; clientReference: string; reason: string; idempotencyKey: string;
}): Promise<Payout> {
  const destination = input.channel === "bank"
    ? { accountNumber: input.destination, ...(input.name ? { name: input.name } : {}) }
    : { phoneNumber: toGambianPhone(input.destination), ...(input.name ? { name: input.name } : {}) };
  const j = await call<{ data: Payout }>("POST", "/v1/payouts", {
    channel: input.channel, amount: input.amountGmd, destination, clientReference: input.clientReference, reason: input.reason.slice(0, 40),
  }, { "Idempotency-Key": input.idempotencyKey });
  return j.data;
}

/** Waychit wants +220 and 7 digits. Accepts "3123456", "220 312 3456", "+2203123456". */
export function toGambianPhone(raw: string): string {
  const d = String(raw).replace(/\D/g, "");
  const local = d.startsWith("220") && d.length > 7 ? d.slice(3) : d;
  return `+220${local}`;
}
