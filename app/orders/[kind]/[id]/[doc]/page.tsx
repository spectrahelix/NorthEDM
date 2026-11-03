import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { canViewDoc, loadOrderDoc, type DocKind, type OrderDoc, type Party } from "@/utils/orderDocs";
import { formatMoney } from "@/utils/money";
import { COUNTRIES } from "@/utils/shipping";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const countryName = (c?: string | null) => COUNTRIES.find((x) => x.code === c)?.name ?? c ?? "";
const addr = (p: Party) => [p.line1, p.line2, [p.city, p.region, p.postal_code].filter(Boolean).join(", "), countryName(p.country)].filter(Boolean);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—");

/**
 * Printable order documents, one route for every shop:
 *   /orders/shop/<id>/invoice|receipt|label   — NorthEDM's own shop
 *   /orders/store/<id>/invoice|receipt|label  — a vendor's store
 * Opened by the buyer (receipt link in their email), the seller (pack sheet)
 * or an admin. The `?t=` token lets an email link work without an account.
 */
export default async function OrderDocPage({ params, searchParams }: { params: Promise<{ kind: string; id: string; doc: string }>; searchParams: Promise<{ t?: string }> }) {
  const { kind, id, doc } = await params;
  const { t } = await searchParams;
  if ((kind !== "shop" && kind !== "store") || !["invoice", "receipt", "label"].includes(doc)) notFound();
  const admin = serviceClient();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await canViewDoc(admin, user, kind as DocKind, id, t ?? null))) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-neutral-800">
        <div className="max-w-sm text-center"><p className="text-lg font-semibold">This document isn&apos;t available.</p><p className="mt-2 text-sm text-neutral-500">Open it from the link in your order email, or sign in to the account that placed the order.</p></div>
      </main>
    );
  }
  const d = await loadOrderDoc(admin, kind as DocKind, id);
  if (!d) notFound();
  return doc === "label" ? <Label d={d} /> : <InvoiceOrReceipt d={d} receipt={doc === "receipt"} />;
}

/** Print just the document: the site header, footer and report button live in the root layout. */
const PRINT_ONLY = `@media print { body * { visibility: hidden !important; } #doc, #doc * { visibility: visible !important; } #doc { position: absolute; left: 0; top: 0; margin: 0 !important; box-shadow: none !important; } }`;
const page = "mx-auto my-6 max-w-3xl bg-white p-8 text-[13px] text-neutral-900 shadow print:my-0 print:max-w-none print:p-0 print:shadow-none";
const head = "text-[10px] font-semibold uppercase tracking-widest text-neutral-500";

function InvoiceOrReceipt({ d, receipt }: { d: OrderDoc; receipt: boolean }) {
  const money = (c: number) => formatMoney(c, d.currency);
  return (
    <main className="min-h-screen bg-neutral-200 print:bg-white">
      <PrintButton />
      <style>{PRINT_ONLY}</style>
      <div id="doc" className={page}>
        <div className="flex items-start justify-between gap-6 border-b border-neutral-200 pb-5">
          <div>
            <p className="text-2xl font-bold tracking-tight">{d.seller.name}</p>
            {addr(d.seller).map((l) => <p key={l} className="text-neutral-600">{l}</p>)}
            {d.seller.email && <p className="text-neutral-600">{d.seller.email}</p>}
            {d.seller.phone && <p className="text-neutral-600">{d.seller.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-black uppercase tracking-tight">{receipt ? "Receipt" : "Invoice"}</p>
            <p className="mt-1 font-mono text-sm">{d.number}</p>
            <p className="text-neutral-600">Order date {fmtDate(d.created_at)}</p>
            {receipt && <p className="text-neutral-600">Paid {fmtDate(d.paid_at ?? d.created_at)}</p>}
            {receipt ? (
              <p className={`mt-2 inline-block rounded border-2 px-2 py-0.5 text-xs font-black uppercase tracking-widest ${d.paid ? "border-green-600 text-green-700" : "border-neutral-400 text-neutral-500"}`}>{d.paid ? "Paid" : d.status}</p>
            ) : (
              <p className={`mt-2 inline-block rounded border-2 px-2 py-0.5 text-xs font-black uppercase tracking-widest ${d.paid ? "border-green-600 text-green-700" : "border-orange-500 text-orange-600"}`}>{d.paid ? "Paid" : "Due on receipt"}</p>
            )}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-6">
          <div><p className={head}>Bill to</p><p className="mt-1 font-semibold">{d.buyer.name ?? "Customer"}</p>{d.buyer.email && <p className="text-neutral-600">{d.buyer.email}</p>}</div>
          <div><p className={head}>Ship to</p><p className="mt-1 font-semibold">{d.buyer.name ?? "Customer"}</p>{addr(d.buyer).map((l) => <p key={l} className="text-neutral-600">{l}</p>)}</div>
        </div>
        <table className="mt-6 w-full border-collapse">
          <thead><tr className="border-b-2 border-neutral-800 text-left"><th className={head + " py-1.5"}>Item</th>{d.international && <th className={head + " py-1.5"}>HS · Origin</th>}<th className={head + " py-1.5 text-right"}>Qty</th><th className={head + " py-1.5 text-right"}>Unit</th><th className={head + " py-1.5 text-right"}>Amount</th></tr></thead>
          <tbody>
            {d.lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-200"><td className="py-2 pr-3">{l.name}</td>{d.international && <td className="py-2 pr-3 font-mono text-xs text-neutral-600">{l.hs_code ?? "—"} · {l.origin ?? "US"}</td>}<td className="py-2 text-right">{l.qty}</td><td className="py-2 text-right">{money(l.unit_cents)}</td><td className="py-2 text-right">{money(l.total_cents)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-72 space-y-1">
          <div className="flex justify-between"><span className="text-neutral-600">Subtotal</span><span>{money(d.subtotal_cents)}</span></div>
          {d.discount_cents > 0 && <div className="flex justify-between"><span className="text-neutral-600">Discount</span><span>−{money(d.discount_cents)}</span></div>}
          <div className="flex justify-between"><span className="text-neutral-600">Shipping{d.shipping.service ? ` · ${d.shipping.service}` : ""}</span><span>{money(d.shipping_cents)}</span></div>
          <div className="flex justify-between border-t-2 border-neutral-800 pt-1.5 text-base font-bold"><span>Total</span><span>{money(d.total_cents)}</span></div>
          <div className="flex justify-between pt-1 text-xs text-neutral-600"><span>Payment</span><span>{d.payment}</span></div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-neutral-200 pt-5 text-xs text-neutral-600">
          <div><p className={head}>Shipping</p><p className="mt-1">{d.shipping.service ?? "Arranged with the shop"}{d.shipping.eta ? ` · est. ${d.shipping.eta} after dispatch` : ""}</p>{d.shipping.tracking && <p>Tracking: <span className="font-mono">{d.shipping.tracking}</span></p>}{d.shipping.weight_g ? <p>Package {d.shipping.weight_g} g</p> : null}</div>
          <div><p className={head}>Notes</p><p className="mt-1">{d.international ? "International shipment: duties, VAT or import fees charged at the destination are paid by the recipient. Delivery times are estimates and exclude customs delays." : "Delivery times are estimates."} Questions: {d.seller.email ?? "reply to your order email"}.</p></div>
        </div>
      </div>
    </main>
  );
}

function Label({ d }: { d: OrderDoc }) {
  const money = (c: number) => formatMoney(c, d.currency);
  const weightLb = d.shipping.weight_g ? `${(d.shipping.weight_g / 453.592).toFixed(2)} lb` : "";
  const totalValue = d.lines.reduce((s, l) => s + l.total_cents, 0);
  return (
    <main className="min-h-screen bg-neutral-200 print:bg-white">
      <PrintButton note="Prints at 4 × 6 in. Buy postage at the counter or online and stick it beside this label." />
      <style>{`@media print { @page { size: 4in 6in; margin: 0.15in; } } ${PRINT_ONLY}`}</style>
      <div id="doc" className="mx-auto my-6 w-[4in] bg-white p-[0.15in] text-neutral-900 shadow print:my-0 print:shadow-none" style={{ minHeight: "6in" }}>
        <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-1.5">
          <div className="text-[9px] leading-tight">
            <p className="font-bold uppercase">From</p>
            <p className="font-semibold">{d.seller.name}</p>
            {addr(d.seller).map((l) => <p key={l}>{l}</p>)}
            {d.seller.phone && <p>{d.seller.phone}</p>}
          </div>
          <div className="text-right text-[9px] leading-tight">
            <p className="font-mono text-[11px] font-bold">{d.number}</p>
            <p>{fmtDate(d.paid_at ?? d.created_at)}</p>
            {weightLb && <p>{weightLb} · {d.shipping.weight_g} g</p>}
          </div>
        </div>
        <div className="border-b-2 border-neutral-900 py-2">
          <p className="text-[9px] font-bold uppercase">Ship to</p>
          <p className="text-[15px] font-black uppercase leading-tight">{d.buyer.name ?? "Customer"}</p>
          {addr(d.buyer).map((l, i) => <p key={l} className={`text-[13px] font-bold uppercase leading-tight ${i === addr(d.buyer).length - 1 ? "text-[15px]" : ""}`}>{l}</p>)}
          {d.buyer.phone && <p className="text-[10px]">{d.buyer.phone}</p>}
        </div>
        <div className="flex items-center justify-between border-b border-neutral-400 py-1.5 text-[10px]">
          <span className="font-bold uppercase">{d.shipping.service ?? "Standard"}</span>
          <span>{d.shipping.eta ? `Est. ${d.shipping.eta}` : ""}</span>
        </div>
        <p className="py-1.5 text-center font-mono text-[18px] font-black tracking-[0.3em]">{d.number}</p>
        {d.shipping.tracking && <p className="text-center font-mono text-[10px]">Tracking {d.shipping.tracking}</p>}
        {d.international ? (
          <div className="mt-1 border-2 border-neutral-900 p-1.5 text-[8px] leading-tight">
            <p className="text-center text-[9px] font-black uppercase">Customs declaration · CN22 · Merchandise</p>
            <table className="mt-1 w-full">
              <thead><tr className="border-b border-neutral-500 text-left"><th>Description</th><th className="text-right">Qty</th><th className="text-right">Value</th><th className="text-right">HS</th><th className="text-right">Origin</th></tr></thead>
              <tbody>{d.lines.map((l, i) => <tr key={i}><td className="pr-1">{l.name.slice(0, 32)}</td><td className="text-right">{l.qty}</td><td className="text-right">{money(l.total_cents)}</td><td className="text-right font-mono">{l.hs_code ?? ""}</td><td className="text-right">{l.origin ?? "US"}</td></tr>)}</tbody>
            </table>
            <div className="mt-1 flex justify-between border-t border-neutral-500 pt-1"><span>Total value {money(totalValue)}{d.currency !== "USD" ? ` (${d.currency})` : ""} · gross {d.shipping.weight_g ?? "—"} g</span><span>Not a gift · no dangerous goods</span></div>
            <p className="mt-1">I certify the particulars given are correct and this item contains no dangerous or prohibited articles.</p>
            <div className="mt-2 flex items-end justify-between"><span className="w-1/2 border-b border-neutral-900 pb-0.5">Signature</span><span>Date {fmtDate(new Date().toISOString())}</span></div>
          </div>
        ) : null}
        <div className="mt-1.5 flex items-center justify-between text-[8px] text-neutral-600">
          <span>{d.lines.reduce((s, l) => s + l.qty, 0)} item(s) · {d.lines.map((l) => `${l.qty}× ${l.name}`).join(", ").slice(0, 90)}</span>
        </div>
        <div className="mt-2 flex h-[1.15in] items-center justify-center border-2 border-dashed border-neutral-400 text-center text-[9px] text-neutral-500">Affix postage here</div>
      </div>
    </main>
  );
}
