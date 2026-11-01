"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BackBar } from "@/app/components/BackBar";
import { formatMoney } from "@/utils/money";
import { METHOD_LABEL, LOCAL_METHODS, orderRef, type LocalMethod } from "@/utils/gambiaPay";

// The purse keeper's console. A regional coordinator collects shop fees and
// customers' wallet / cash payments, confirms wallet payments here, pays the
// shops their share, and logs what they send to NorthEDM. Nothing here moves
// money; it records it. Server: /api/festdash/purse*.

type Coordinator = {
  id: string; display_name: string | null; region: string | null;
  wave_number: string | null; qmoney_number: string | null; afrimoney_number: string | null;
  whatsapp_number: string | null; remitly_name: string | null;
};
type Settings = { sale_owner_bps: number; sale_coordinator_bps: number; subscription_fee_cents: number; subscription_coordinator_bps: number };
type Shop = {
  id: number; name: string | null; category: string | null; currency: string | null; whatsapp_number: string | null;
  suspended: boolean; festdash_active: boolean; paid_through: string | null; fee_current: boolean;
};
type Awaiting = {
  id: string; vendor_id: number; vendor_name: string; customer_name: string | null; total_cents: number; currency: string;
  payment_method: string; payment_ref: string | null; payment_to: string | null; created_at: string;
  items: { name: string; qty: number }[];
};
type LedgerRow = {
  id: string; kind: string; vendor_name: string | null; currency: string; gross_cents: number; shop_cents: number;
  owner_cents: number; coordinator_cents: number; method: string | null; reference: string | null; note: string | null;
  created_at: string; received_at: string | null; received_usd_cents: number | null;
};
type Totals = Record<string, { earned: number; owner_share: number; sent: number; owed: number }>;
type Data = { coordinator: Coordinator | null; settings?: Settings; shops?: Shop[]; awaiting?: Awaiting[]; ledger?: LedgerRow[]; totals?: Totals };

const input = "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none";
const label = "mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500";
const card = "rounded-2xl border border-white/8 bg-white/3 p-5";
const KIND_LABEL: Record<string, string> = { sale: "Sale", subscription: "Shop fee", remittance: "Sent to NorthEDM" };
const WALLET_KEYS = ["wave_number", "qmoney_number", "afrimoney_number", "whatsapp_number", "remitly_name"] as const;
type WalletForm = Record<(typeof WALLET_KEYS)[number], string>;

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, error: j.error };
}

export default function PursePage() {
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "anon" | "ready">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [wallets, setWallets] = useState<WalletForm>({ wave_number: "", qmoney_number: "", afrimoney_number: "", whatsapp_number: "", remitly_name: "" });
  const [fee, setFee] = useState<{ vendorId: string; months: number; collectedAmount: string; collectedCurrency: string; method: LocalMethod; reference: string }>(
    { vendorId: "", months: 1, collectedAmount: "", collectedCurrency: "GMD", method: "wave", reference: "" }
  );
  const [send, setSend] = useState({ amount: "", currency: "GMD", method: "remitly", reference: "", note: "" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      const res = await fetch("/api/festdash/purse");
      if (!on) return;
      if (res.status === 401) { setState("anon"); return; }
      const j = (await res.json()) as Data;
      if (!on) return;
      setData(j);
      if (j.coordinator) {
        const c = j.coordinator;
        setWallets({
          wave_number: c.wave_number ?? "", qmoney_number: c.qmoney_number ?? "", afrimoney_number: c.afrimoney_number ?? "",
          whatsapp_number: c.whatsapp_number ?? "", remitly_name: c.remitly_name ?? "",
        });
      }
      setState("ready");
    })();
    return () => { on = false; };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(""), 4000); }

  async function saveWallets() {
    setBusy("wallets");
    const r = await post("/api/festdash/purse", wallets);
    setBusy(null);
    flash(r.ok ? "Wallets saved." : r.error ?? "Couldn't save.");
    if (r.ok) reload();
  }
  async function decide(id: string, action: "confirm" | "reject") {
    if (action === "reject" && !confirm("Reject this payment? The order will be declined.")) return;
    setBusy(id);
    const r = await post(`/api/festdash/orders/${id}/confirm-payment`, { action });
    setBusy(null);
    flash(r.ok ? (action === "confirm" ? "Payment confirmed — the shop has the order." : "Payment rejected.") : r.error ?? "Couldn't update.");
    if (r.ok) reload();
  }
  async function logFee() {
    if (!fee.vendorId) { flash("Pick a shop."); return; }
    setBusy("fee");
    const r = await post("/api/festdash/purse/subscription", { ...fee, vendorId: Number(fee.vendorId), collectedAmount: Number(fee.collectedAmount) });
    setBusy(null);
    flash(r.ok ? "Fee logged — the shop's listing is current." : r.error ?? "Couldn't log the fee.");
    if (r.ok) { setFee((f) => ({ ...f, collectedAmount: "", reference: "" })); reload(); }
  }
  async function logSend() {
    setBusy("send");
    const r = await post("/api/festdash/purse/remittance", { ...send, amount: Number(send.amount) });
    setBusy(null);
    flash(r.ok ? "Logged. NorthEDM will confirm when it lands." : r.error ?? "Couldn't log it.");
    if (r.ok) { setSend((s) => ({ ...s, amount: "", reference: "", note: "" })); reload(); }
  }

  if (state === "loading") {
    return <main className="flex min-h-screen items-center justify-center"><span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" /></main>;
  }
  if (state === "anon") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="mb-2 font-bebas text-3xl tracking-wide text-white">Sign in</h1>
          <Link href={`/signup?next=${encodeURIComponent("/festdash/purse")}`} className="inline-block rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-400">Sign in</Link>
        </div>
      </main>
    );
  }
  if (!data?.coordinator) {
    return (
      <main className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-md">
          <BackBar crumbs={[{ label: "FestDash", href: "/festdash" }]} fallback="/festdash" />
          <h1 className="mb-2 font-bebas text-4xl tracking-wide text-white">Purse keeper console</h1>
          <p className="text-neutral-400">This console is for regional coordinators who collect shop fees and customer payments for FestDash in their area. If that&apos;s you, NorthEDM switches it on for your account.</p>
        </div>
      </main>
    );
  }

  const c = data.coordinator;
  const shops = data.shops ?? [];
  const awaiting = data.awaiting ?? [];
  const ledger = data.ledger ?? [];
  const totals = data.totals ?? {};
  const s = data.settings;
  const feeMonths = fee.months;
  const feeCents = (s?.subscription_fee_cents ?? 3000) * feeMonths;

  return (
    <main className="min-h-screen p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <BackBar crumbs={[{ label: "FestDash", href: "/festdash" }]} fallback="/festdash" />
        <div>
          <h1 className="font-bebas text-4xl tracking-wide text-white">Purse <span className="text-orange-400">Keeper</span></h1>
          <p className="font-dm-mono text-xs text-neutral-500">{c.display_name}{c.region ? ` · ${c.region}` : ""}</p>
        </div>
        {msg && <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-200">{msg}</p>}

        {/* Money at a glance */}
        <div className={card}>
          <p className={label}>Your book</p>
          {Object.keys(totals).length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing booked yet. Confirmed sales and logged fees show up here.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(totals).map(([cur, t]) => (
                <div key={cur} className="rounded-xl bg-white/5 p-3">
                  <p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">{cur}</p>
                  <p className="mt-1 text-sm text-neutral-300">You earned <span className="font-semibold text-white">{formatMoney(t.earned, cur)}</span></p>
                  <p className="text-sm text-neutral-300">NorthEDM&apos;s share <span className="font-semibold text-white">{formatMoney(t.owner_share, cur)}</span></p>
                  <p className="text-sm text-neutral-300">Sent so far <span className="font-semibold text-white">{formatMoney(t.sent, cur)}</span></p>
                  <p className={`mt-1 text-sm font-semibold ${t.owed > 0 ? "text-orange-400" : "text-green-400"}`}>{t.owed > 0 ? `Owed: ${formatMoney(t.owed, cur)}` : "All settled"}</p>
                </div>
              ))}
            </div>
          )}
          {s && (
            <p className="mt-3 text-xs text-neutral-600">
              Split per sale: shop {100 - (s.sale_owner_bps + s.sale_coordinator_bps) / 100}% · NorthEDM {s.sale_owner_bps / 100}% · you {s.sale_coordinator_bps / 100}%.
              Shop fee {formatMoney(s.subscription_fee_cents, "USD")}/month, of which you keep {s.subscription_coordinator_bps / 100}%.
            </p>
          )}
        </div>

        {/* Awaiting confirmation */}
        <div className={card}>
          <p className={label}>Wallet payments to confirm ({awaiting.length})</p>
          {awaiting.length === 0 ? (
            <p className="text-sm text-neutral-500">No wallet orders waiting. Cash orders settle at handover and don&apos;t appear here.</p>
          ) : (
            <div className="space-y-3">
              {awaiting.map((o) => (
                <div key={o.id} className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{formatMoney(o.total_cents, o.currency)} by {METHOD_LABEL[o.payment_method as LocalMethod] ?? o.payment_method}</p>
                      <p className="text-xs text-neutral-400">{o.vendor_name} · {o.customer_name ?? "customer"} · {new Date(o.created_at).toLocaleString()}</p>
                      <p className="mt-1 font-dm-mono text-xs text-neutral-300">Ref {orderRef(o.id)} → {o.payment_to ?? "your wallet"}</p>
                      <p className="font-dm-mono text-xs text-neutral-400">Customer&apos;s transaction ref: <span className="text-white">{o.payment_ref ?? "not entered yet"}</span></p>
                      <p className="mt-1 text-xs text-neutral-500">{o.items.map((i) => `${i.qty}× ${i.name}`).join(" · ")}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => decide(o.id, "reject")} disabled={busy === o.id} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/5 disabled:opacity-50">Reject</button>
                      <button onClick={() => decide(o.id, "confirm")} disabled={busy === o.id} className="rounded-xl bg-green-500 px-3 py-2 text-xs font-semibold text-black hover:bg-green-400 disabled:opacity-50">{busy === o.id ? "…" : "Money arrived ✓"}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-neutral-600">Check your wallet app for the reference before tapping. Confirming moves the order to the shop and books the split.</p>
        </div>

        {/* Shops + fees */}
        <div className={card}>
          <p className={label}>Your shops ({shops.length})</p>
          {shops.length === 0 ? (
            <p className="text-sm text-neutral-500">No shops assigned to you yet — NorthEDM links each shop you sign up to your account.</p>
          ) : (
            <div className="space-y-2">
              {shops.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{v.name ?? `Shop #${v.id}`} <span className="font-normal text-neutral-500">{v.category ?? ""}</span></p>
                    <p className="font-dm-mono text-[11px] text-neutral-500">
                      {v.fee_current ? `fee paid through ${v.paid_through}` : v.paid_through ? `lapsed ${v.paid_through}` : "no fee logged yet"}
                      {!v.festdash_active ? " · not enrolled on FestDash" : ""}{v.suspended ? " · lights out" : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] ${v.fee_current && v.festdash_active && !v.suspended ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {v.fee_current && v.festdash_active && !v.suspended ? "Listed" : "Hidden"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-white/10 p-4">
            <p className={label}>Log a shop fee you collected</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <select value={fee.vendorId} onChange={(e) => setFee({ ...fee, vendorId: e.target.value })} className={input}>
                  <option value="">Which shop?</option>
                  {shops.map((v) => <option key={v.id} value={v.id}>{v.name ?? `Shop #${v.id}`}</option>)}
                </select>
              </div>
              <div>
                <span className={label}>Months</span>
                <input type="number" min={1} max={12} value={fee.months} onChange={(e) => setFee({ ...fee, months: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} className={input} />
              </div>
              <div>
                <span className={label}>Paid how</span>
                <select value={fee.method} onChange={(e) => setFee({ ...fee, method: e.target.value as LocalMethod })} className={input}>
                  {LOCAL_METHODS.map((m) => <option key={m} value={m}>{m === "cash" ? "Cash" : METHOD_LABEL[m]}</option>)}
                </select>
              </div>
              <div>
                <span className={label}>Amount you received</span>
                <input inputMode="decimal" value={fee.collectedAmount} onChange={(e) => setFee({ ...fee, collectedAmount: e.target.value })} placeholder="e.g. 2100" className={input} />
              </div>
              <div>
                <span className={label}>Currency</span>
                <select value={fee.collectedCurrency} onChange={(e) => setFee({ ...fee, collectedCurrency: e.target.value })} className={input}>
                  <option value="GMD">GMD (dalasi)</option><option value="USD">USD</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <span className={label}>Reference (optional)</span>
                <input value={fee.reference} onChange={(e) => setFee({ ...fee, reference: e.target.value })} placeholder="wallet transaction ID or receipt no." className={input} />
              </div>
            </div>
            <p className="mt-2 text-xs text-neutral-500">Books {formatMoney(feeCents, "USD")} ({feeMonths} month{feeMonths === 1 ? "" : "s"}) and extends the shop&apos;s listing.</p>
            <button onClick={logFee} disabled={busy === "fee"} className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">{busy === "fee" ? "Logging…" : "Log fee"}</button>
          </div>
        </div>

        {/* Send to NorthEDM */}
        <div className={card}>
          <p className={label}>Log money you sent to NorthEDM</p>
          <p className="mb-3 text-xs text-neutral-500">Send it on Remitly (or however you agreed), then record it here with the reference. NorthEDM confirms the amount that landed.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><span className={label}>Amount sent</span><input inputMode="decimal" value={send.amount} onChange={(e) => setSend({ ...send, amount: e.target.value })} placeholder="e.g. 5000" className={input} /></div>
            <div><span className={label}>Currency</span>
              <select value={send.currency} onChange={(e) => setSend({ ...send, currency: e.target.value })} className={input}><option value="GMD">GMD</option><option value="USD">USD</option></select>
            </div>
            <div><span className={label}>Sent via</span>
              <select value={send.method} onChange={(e) => setSend({ ...send, method: e.target.value })} className={input}><option value="remitly">Remitly</option><option value="wave">Wave</option><option value="other">Other</option></select>
            </div>
            <div><span className={label}>Reference</span><input value={send.reference} onChange={(e) => setSend({ ...send, reference: e.target.value })} placeholder="Remitly transfer no." className={input} /></div>
            <div className="sm:col-span-2"><span className={label}>What it covers</span><input value={send.note} onChange={(e) => setSend({ ...send, note: e.target.value })} placeholder="e.g. October fees for 3 shops + sales 1–15 Nov" className={input} /></div>
          </div>
          <button onClick={logSend} disabled={busy === "send" || !send.amount} className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">{busy === "send" ? "Logging…" : "Log what I sent"}</button>
        </div>

        {/* Wallets */}
        <div className={card}>
          <p className={label}>Your wallets (shown to customers at checkout)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {WALLET_KEYS.map((k) => (
              <div key={k}>
                <span className={label}>{k === "remitly_name" ? "Name on Remitly" : k.replace("_number", "").replace(/^\w/, (ch) => ch.toUpperCase()) + " number"}</span>
                <input value={wallets[k]} onChange={(e) => setWallets({ ...wallets, [k]: e.target.value })} className={input} placeholder={k === "remitly_name" ? "as it appears for the sender" : "+220 …"} />
              </div>
            ))}
          </div>
          <button onClick={saveWallets} disabled={busy === "wallets"} className="mt-3 rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50">{busy === "wallets" ? "Saving…" : "Save wallets"}</button>
        </div>

        {/* Ledger */}
        <div className={card}>
          <p className={label}>Ledger</p>
          {ledger.length === 0 ? <p className="text-sm text-neutral-500">Empty so far.</p> : (
            <div className="space-y-1.5">
              {ledger.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2 text-sm">
                  <div>
                    <p className="text-white">{KIND_LABEL[r.kind] ?? r.kind}{r.vendor_name ? ` · ${r.vendor_name}` : ""}</p>
                    <p className="font-dm-mono text-[11px] text-neutral-500">{new Date(r.created_at).toLocaleDateString()}{r.method ? ` · ${r.method}` : ""}{r.reference ? ` · ${r.reference}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
                  </div>
                  <div className="text-right font-dm-mono text-xs">
                    {r.kind === "remittance" ? (
                      <>
                        <p className="text-white">{formatMoney(r.gross_cents, r.currency)}</p>
                        <p className={r.received_at ? "text-green-400" : "text-yellow-400"}>{r.received_at ? `received ${formatMoney(r.received_usd_cents ?? 0, "USD")}` : "awaiting confirmation"}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-white">{formatMoney(r.gross_cents, r.currency)}</p>
                        <p className="text-neutral-500">you {formatMoney(r.coordinator_cents, r.currency)} · NorthEDM {formatMoney(r.owner_cents, r.currency)}{r.kind === "sale" ? ` · shop ${formatMoney(r.shop_cents, r.currency)}` : ""}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
