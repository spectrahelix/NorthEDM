"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/utils/money";

type Promoter = {
  id: string; user_id: string; display_name: string | null; is_active: boolean; is_coordinator: boolean; region: string | null;
  wave_number: string | null; qmoney_number: string | null; afrimoney_number: string | null; whatsapp_number: string | null; remitly_name: string | null;
};
type Vendor = {
  id: number; name: string | null; is_public: boolean | null; suspended_at: string | null; coordinator_user_id: string | null;
  region: string | null; currency: string; whatsapp_number: string | null; paid_through: string | null;
};
type LedgerRow = {
  id: string; kind: string; coordinator_user_id: string; vendor_id: number | null; currency: string; gross_cents: number;
  shop_cents: number; owner_cents: number; coordinator_cents: number; runner_cents?: number | null; collected_by?: string | null; method: string | null; reference: string | null;
  note: string | null; created_at: string; received_at: string | null; received_usd_cents: number | null;
};
type Settings = { sale_owner_bps: number; sale_coordinator_bps: number; subscription_fee_cents: number; subscription_coordinator_bps: number; bundle_fee_cents?: number; mint_max_percent_off?: number; mint_max_amount_off_cents?: number };
type Data = {
  held_commissions?: Record<string, number>; promoters: Promoter[]; vendors: Vendor[]; ledger: LedgerRow[]; settings: Settings | null };

const input = "rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none";
const label = "mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500";
const card = "rounded-2xl border border-white/8 bg-white/3 p-5";

async function patch(body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/festdash/admin/coordinator", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, error: j.error };
}

export default function CoordinatorsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [regionDraft, setRegionDraft] = useState<Record<string, string>>({});
  const [assign, setAssign] = useState<Record<number, { coordinator: string; currency: string; region: string; whatsapp: string }>>({});
  const [received, setReceived] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      const res = await fetch("/api/festdash/admin/coordinator");
      const j = (await res.json()) as Data;
      if (!on) return;
      setData(j);
      setSettings(j.settings);
      const a: typeof assign = {};
      for (const v of j.vendors) a[v.id] = { coordinator: v.coordinator_user_id ?? "", currency: v.currency ?? "USD", region: v.region ?? "", whatsapp: v.whatsapp_number ?? "" };
      setAssign(a);
    })();
    return () => { on = false; };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 4000); }
  async function run(key: string, body: unknown, okText: string) {
    setBusy(key);
    const r = await patch(body);
    setBusy(null);
    flash(r.ok ? okText : r.error ?? "Failed.");
    if (r.ok) reload();
  }

  if (!data) return <main className="flex min-h-screen items-center justify-center"><span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" /></main>;

  const coordinators = data.promoters.filter((p) => p.is_coordinator);
  void coordinators;
  const nameOf = new Map(data.promoters.map((p) => [p.user_id, p.display_name ?? p.user_id.slice(0, 8)]));
  const vendorName = new Map(data.vendors.map((v) => [v.id, v.name ?? `Vendor #${v.id}`]));
  const pendingRemits = data.ledger.filter((r) => r.kind === "remittance" && !r.received_at);

  // Two directions, per coordinator, per currency:
  //  they owe you  — your share of what the coordinator collected, minus remittances
  //  you owe them  — shop + coordinator + runner shares of card sales you collected
  //                  (collected_by = 'owner'), minus payouts you've logged
  const owed: Record<string, Record<string, { share: number; sent: number }>> = {};
  const youOwe: Record<string, Record<string, { due: number; paid: number }>> = {};
  for (const r of data.ledger) {
    if (r.collected_by === "owner") {
      const byCur = (youOwe[r.coordinator_user_id] ??= {});
      const t = (byCur[r.currency] ??= { due: 0, paid: 0 });
      if (r.kind === "payout") t.paid += Number(r.gross_cents);
      else t.due += Number(r.shop_cents) + Number(r.coordinator_cents) + Number(r.runner_cents ?? 0);
      continue;
    }
    const byCur = (owed[r.coordinator_user_id] ??= {});
    const t = (byCur[r.currency] ??= { share: 0, sent: 0 });
    if (r.kind === "remittance") t.sent += Number(r.gross_cents); else t.share += Number(r.owner_cents);
  }
  async function logPayout(coordinatorUserId: string, currency: string, suggested: number) {
    const amt = prompt(`Amount in ${currency} you sent by Remitly (what landed in their wallet):`, (suggested / 100).toFixed(2));
    if (amt === null) return;
    const reference = prompt("Remitly reference (optional):") ?? "";
    await run(coordinatorUserId, { action: "log_payout", coordinatorUserId, currency, amount: Number(amt), reference }, "Payout logged.");
  }

  return (
    <main className="min-h-screen px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <Link href="/admin/festdash" className="font-dm-mono text-xs text-neutral-500 hover:text-white">← FestDash admin</Link>
          <h1 className="mt-2 font-bebas text-4xl tracking-wide">Coordinators <span className="text-orange-400">&amp; regional shops</span></h1>
          <p className="text-sm text-neutral-400">Purse keepers collect fees and payments locally and remit your share. Everything here is a record; no money moves through the site.</p>
        </div>
        {msg && <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">{msg}</p>}

        {/* Settings */}
        {settings && (
          <section className={card}>
            <p className={label}>Splits &amp; fee — one setting for every FestDash sale, card or wallet</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div><span className={label}>NorthEDM % of sale</span><input className={input + " w-full"} value={settings.sale_owner_bps / 100} onChange={(e) => setSettings({ ...settings, sale_owner_bps: Math.round(Number(e.target.value) * 100) })} /></div>
              <div><span className={label}>Coordinator % of sale</span><input className={input + " w-full"} value={settings.sale_coordinator_bps / 100} onChange={(e) => setSettings({ ...settings, sale_coordinator_bps: Math.round(Number(e.target.value) * 100) })} /></div>
              <div><span className={label}>Shop fee $/month</span><input className={input + " w-full"} value={settings.subscription_fee_cents / 100} onChange={(e) => setSettings({ ...settings, subscription_fee_cents: Math.round(Number(e.target.value) * 100) })} /></div>
              <div><span className={label}>Coordinator % of fee</span><input className={input + " w-full"} value={settings.subscription_coordinator_bps / 100} onChange={(e) => setSettings({ ...settings, subscription_coordinator_bps: Math.round(Number(e.target.value) * 100) })} /></div>
              <div><span className={label}>Bundle $/month (both)</span><input className={input + " w-full"} value={(settings.bundle_fee_cents ?? 4500) / 100} onChange={(e) => setSettings({ ...settings, bundle_fee_cents: Math.round(Number(e.target.value) * 100) })} /></div>
              <div><span className={label}>Promoter codes: max % off</span><input className={input + " w-full"} value={settings.mint_max_percent_off ?? 50} onChange={(e) => setSettings({ ...settings, mint_max_percent_off: Math.round(Number(e.target.value)) })} /></div>
              <div><span className={label}>Promoter codes: max $ off</span><input className={input + " w-full"} value={(settings.mint_max_amount_off_cents ?? 2000) / 100} onChange={(e) => setSettings({ ...settings, mint_max_amount_off_cents: Math.round(Number(e.target.value) * 100) })} /></div>
            </div>
            <p className="mt-2 text-xs text-neutral-500">Shop keeps {100 - (settings.sale_owner_bps + settings.sale_coordinator_bps) / 100}% of each sale. On card orders the two percentages together are taken as the Stripe platform fee when the order is delivered; the coordinator&apos;s part is paid to them through Stripe after the hold window, or stays with NorthEDM when the vendor has no coordinator. On wallet sales the coordinator keeps it from what they collected. Of each {formatMoney(settings.subscription_fee_cents, "USD")} fee you get {formatMoney(settings.subscription_fee_cents - Math.round(settings.subscription_fee_cents * settings.subscription_coordinator_bps / 10000), "USD")}.</p>
            <button onClick={() => run("settings", { action: "set_settings", ...settings }, "Settings saved.")} disabled={busy === "settings"} className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold hover:bg-orange-400 disabled:opacity-50">Save settings</button>
          </section>
        )}

        {/* Remittances to confirm */}
        <section className={card}>
          <p className={label}>Money sent to you, awaiting your confirmation ({pendingRemits.length})</p>
          {pendingRemits.length === 0 ? <p className="text-sm text-neutral-500">Nothing pending.</p> : (
            <div className="space-y-2">
              {pendingRemits.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
                  <div>
                    <p className="text-sm font-semibold">{formatMoney(r.gross_cents, r.currency)} from {nameOf.get(r.coordinator_user_id) ?? r.coordinator_user_id.slice(0, 8)}</p>
                    <p className="font-dm-mono text-[11px] text-neutral-500">{new Date(r.created_at).toLocaleString()} · {r.method ?? "—"}{r.reference ? ` · ${r.reference}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input className={input + " w-28"} inputMode="decimal" placeholder="USD landed" value={received[r.id] ?? ""} onChange={(e) => setReceived({ ...received, [r.id]: e.target.value })} />
                    <button onClick={() => run(r.id, { action: "confirm_remittance", id: r.id, receivedUsd: Number(received[r.id]) }, "Confirmed.")} disabled={busy === r.id || !received[r.id]} className="rounded-xl bg-green-500 px-3 py-2 text-xs font-semibold text-black hover:bg-green-400 disabled:opacity-50">Confirm</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Coordinators */}
        <section className={card}>
          <p className={label}>Coordinators ({coordinators.length}) — switch on any active promoter</p>
          <div className="space-y-2">
            {data.promoters.map((p) => (
              <div key={p.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2 ${p.is_coordinator ? "bg-green-500/5 border border-green-500/20" : "bg-white/5"}`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.display_name ?? p.user_id.slice(0, 8)} {!p.is_active && <span className="font-normal text-neutral-500">(promoter inactive)</span>}</p>
                  {p.is_coordinator && (
                    <p className="font-dm-mono text-[11px] text-neutral-500">
                      {p.region ?? "no region"} · Wave {p.wave_number ?? "—"} · QMoney {p.qmoney_number ?? "—"} · Afrimoney {p.afrimoney_number ?? "—"} · WhatsApp {p.whatsapp_number ?? "—"}
                    </p>
                  )}
                  {p.is_coordinator && owed[p.user_id] && (
                    <p className="font-dm-mono text-[11px] text-neutral-400">
                      They owe you · {Object.entries(owed[p.user_id]).map(([cur, t]) => `${cur}: share ${formatMoney(t.share, cur)} · sent ${formatMoney(t.sent, cur)} · owed ${formatMoney(t.share - t.sent, cur)}`).join("  |  ")}
                    </p>
                  )}
                  {p.is_coordinator && (() => {
                    // Net per currency: what you owe them (card sales + held commissions) minus what they owe you (wallet sales/fees).
                    const curs = new Set([...Object.keys(youOwe[p.user_id] ?? {}), ...Object.keys(owed[p.user_id] ?? {})]);
                    const held = data.held_commissions?.[p.user_id] ?? 0;
                    if (held > 0) curs.add("USD");
                    const lines = [...curs].map((cur) => {
                      const theyOwe = (owed[p.user_id]?.[cur]?.share ?? 0) - (owed[p.user_id]?.[cur]?.sent ?? 0);
                      const youOweThem = (youOwe[p.user_id]?.[cur]?.due ?? 0) - (youOwe[p.user_id]?.[cur]?.paid ?? 0) + (cur === "USD" ? held : 0);
                      const net = youOweThem - theyOwe;
                      return { cur, net };
                    }).filter((l) => l.net !== 0);
                    if (!lines.length) return null;
                    return (
                      <p className="mt-1 rounded-lg bg-white/5 px-2 py-1 font-dm-mono text-[11px] text-white">
                        Settle net · {lines.map((l) => `${l.cur}: ${l.net > 0 ? `you send ${formatMoney(l.net, l.cur)}` : `they send ${formatMoney(-l.net, l.cur)}`}`).join("  |  ")}
                        <span className="text-neutral-500"> — one transfer, one direction; held commissions included in USD.</span>
                      </p>
                    );
                  })()}
                  {p.is_coordinator && youOwe[p.user_id] && Object.entries(youOwe[p.user_id]).map(([cur, t]) => (
                    <p key={cur} className="font-dm-mono text-[11px] text-orange-300">
                      You owe them (card sales) · {cur}: due {formatMoney(t.due, cur)} · sent {formatMoney(t.paid, cur)} · <span className="font-semibold">owed {formatMoney(t.due - t.paid, cur)}</span>
                      {t.due - t.paid > 0 && (
                        <button onClick={() => logPayout(p.user_id, cur, t.due - t.paid)} className="ml-2 rounded-lg border border-orange-400/40 px-2 py-0.5 text-[11px] text-orange-200 hover:bg-orange-500/10">Sent by Remitly</button>
                      )}
                    </p>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {!p.is_coordinator && <input className={input + " w-28"} placeholder="region (gambia)" value={regionDraft[p.id] ?? ""} onChange={(e) => setRegionDraft({ ...regionDraft, [p.id]: e.target.value })} />}
                  <button
                    onClick={() => run(p.id, { action: "set_coordinator", promoterId: p.id, isCoordinator: !p.is_coordinator, region: regionDraft[p.id] ?? p.region ?? "" }, p.is_coordinator ? "Coordinator switched off." : "Coordinator switched on.")}
                    disabled={busy === p.id}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50 ${p.is_coordinator ? "border border-white/10 text-neutral-300 hover:bg-white/5" : "bg-green-500 text-black hover:bg-green-400"}`}
                  >{p.is_coordinator ? "Switch off" : "Make coordinator"}</button>
                </div>
              </div>
            ))}
            {data.promoters.length === 0 && <p className="text-sm text-neutral-500">No promoters yet. A coordinator is an approved promoter first (they apply at /promote).</p>}
          </div>
        </section>

        {/* Shops */}
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={label}>Shops — assign to a coordinator, set currency &amp; WhatsApp</p>
            <button
              onClick={async () => {
                setBusy("reminders");
                const r = await fetch("/api/cron/subscription-reminders");
                const j = await r.json().catch(() => ({}));
                setBusy(null);
                flash(r.ok ? `Fee reminders sent — due soon: ${j.week ?? 0}, last day: ${j.end ?? 0}, lapsed: ${j.lapsed ?? 0}` : j.error ?? "Failed.");
              }}
              disabled={busy === "reminders"}
              title="Runs the daily fee-reminder job now (it also runs on its own every morning)"
              className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5 disabled:opacity-50"
            >{busy === "reminders" ? "Running…" : "Run fee reminders now"}</button>
          </div>
          <div className="space-y-2">
            {data.vendors.map((v) => {
              const a = assign[v.id] ?? { coordinator: "", currency: "USD", region: "", whatsapp: "" };
              return (
                <div key={v.id} className="rounded-xl bg-white/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{v.name ?? `Vendor #${v.id}`} <span className="font-normal text-neutral-500">#{v.id}{v.suspended_at ? " · lights out" : ""}{v.is_public ? "" : " · not listed"}</span></p>
                    {v.coordinator_user_id && (
                      <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] ${v.paid_through ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>{v.paid_through ? `fee through ${v.paid_through}` : "no current fee"}</span>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-5">
                    <select className={input} value={a.coordinator} onChange={(e) => {
                      // Picking a Gambian coordinator switches a still-USD shop to GMD, which is what
                      // puts it on the wallet/cash rail; a USD shop with a coordinator keeps card checkout.
                      const cid = e.target.value;
                      const c = coordinators.find((x) => x.user_id === cid);
                      const currency = cid && a.currency === "USD" && c?.region === "gambia" ? "GMD" : a.currency;
                      setAssign({ ...assign, [v.id]: { ...a, coordinator: cid, currency } });
                    }}>
                      <option value="">no coordinator</option>
                      {coordinators.map((c) => <option key={c.user_id} value={c.user_id}>{c.display_name ?? c.user_id.slice(0, 8)}</option>)}
                    </select>
                    <select className={input} value={a.currency} onChange={(e) => setAssign({ ...assign, [v.id]: { ...a, currency: e.target.value } })}><option value="USD">USD · card checkout; coordinator paid their % via Stripe</option><option value="GMD">GMD · Wave / QMoney / Afrimoney / cash via coordinator</option></select>
                    <input className={input} placeholder="region" value={a.region} onChange={(e) => setAssign({ ...assign, [v.id]: { ...a, region: e.target.value } })} />
                    <input className={input} placeholder="shop WhatsApp" value={a.whatsapp} onChange={(e) => setAssign({ ...assign, [v.id]: { ...a, whatsapp: e.target.value } })} />
                    <button onClick={() => run(`v${v.id}`, { action: "assign_vendor", vendorId: v.id, coordinatorUserId: a.coordinator || null, currency: a.currency, region: a.region, whatsapp: a.whatsapp }, "Shop updated.")} disabled={busy === `v${v.id}`} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-200 hover:bg-white/5 disabled:opacity-50">Save</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Ledger */}
        <section className={card}>
          <p className={label}>Ledger (latest {Math.min(data.ledger.length, 300)})</p>
          {data.ledger.length === 0 ? <p className="text-sm text-neutral-500">Empty.</p> : (
            <div className="space-y-1">
              {data.ledger.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-1.5 text-xs">
                  <span className="text-neutral-300">{new Date(r.created_at).toLocaleDateString()} · {r.kind} · {nameOf.get(r.coordinator_user_id) ?? "?"}{r.vendor_id ? ` · ${vendorName.get(r.vendor_id) ?? `#${r.vendor_id}`}` : ""}{r.reference ? ` · ${r.reference}` : ""}</span>
                  <span className="font-dm-mono text-neutral-400">
                    {formatMoney(r.gross_cents, r.currency)}
                    {r.kind !== "remittance" ? ` (you ${formatMoney(r.owner_cents, r.currency)} · coord ${formatMoney(r.coordinator_cents, r.currency)})` : r.received_at ? ` · landed ${formatMoney(r.received_usd_cents ?? 0, "USD")}` : " · pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
