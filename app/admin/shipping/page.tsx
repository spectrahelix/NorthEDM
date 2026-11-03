"use client";
import { useEffect, useState } from "react";
import { BackBar } from "@/app/components/BackBar";
import { COUNTRIES, ZONE_LABEL, type Rates, type Zone } from "@/utils/shipping";

const input = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none";
type From = { name?: string; line1?: string; line2?: string; city?: string; region?: string; postal_code?: string; country?: string; phone?: string; email?: string };

export default function AdminShippingPage() {
  const [from, setFrom] = useState<From>({ country: "US" });
  const [handling, setHandling] = useState("0");
  const [rates, setRates] = useState<Rates | null>(null);
  const [defaults, setDefaults] = useState<Rates | null>(null);
  const [ratesText, setRatesText] = useState("");
  const [msg, setMsg] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [quoteCountry, setQuoteCountry] = useState("GM");
  const [quoteWeight, setQuoteWeight] = useState("500");
  const [quote, setQuote] = useState<{ zone_label: string; options: { name: string; cents: number; eta: string }[] } | null>(null);

  useEffect(() => {
    fetch("/api/admin/shipping").then(async (r) => {
      if (r.status === 401 || r.status === 403) { setForbidden(true); return; }
      const j = await r.json();
      setFrom({ country: "US", ...(j.ship_from ?? {}) }); setHandling(String((j.handling_cents ?? 0) / 100)); setDefaults(j.defaults); setRates(j.rates); setRatesText(JSON.stringify(j.rates ?? j.defaults, null, 2));
    });
  }, []);
  async function save() {
    setMsg("");
    let parsed: Rates | null = null;
    try { parsed = ratesText.trim() ? JSON.parse(ratesText) : null; } catch { setMsg("Rates JSON doesn't parse."); return; }
    const r = await fetch("/api/admin/shipping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ship_from: from, handling_cents: Math.round(Number(handling) * 100), rates: parsed }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Saved." : j.error ?? "Failed.");
    if (r.ok) setRates(parsed);
  }
  async function tryQuote() {
    // The public quote route needs product ids; a quick weight-only preview uses the same maths client-side.
    const { quoteShipping } = await import("@/utils/shipping");
    const q = quoteShipping({ items: [{ weight_g: Number(quoteWeight) || 0, qty: 1 }], country: quoteCountry, rates: rates ?? undefined, handlingCents: Math.round(Number(handling) * 100) });
    setQuote(q);
  }
  if (forbidden) return <main className="flex min-h-screen items-center justify-center text-neutral-400">Forbidden.</main>;
  const f = (k: keyof From, label: string, ph = "") => (
    <div><span className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">{label}</span><input className={input} value={from[k] ?? ""} placeholder={ph} onChange={(e) => setFrom({ ...from, [k]: e.target.value })} /></div>
  );
  return (
    <main className="min-h-screen px-6 py-14 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-4xl">
        <BackBar fallback="/admin" />
        <p className="mt-4 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#E8FF47]">Admin · Shipping</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-wide">Shipping</h1>
        <p className="mt-2 text-sm text-neutral-400">Where your parcels ship from (printed on invoices and labels), a handling fee added to every shipment, and the rate table used for every shop that ships from the US. Rates are estimates shown to the customer at checkout; postage is bought from the carrier.</p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Ship from (your return address)</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {f("name", "Name", "NorthEDM")}{f("phone", "Phone")}{f("email", "Email")}
            <div className="sm:col-span-2">{f("line1", "Street")}</div>{f("line2", "Unit (optional)")}
            {f("city", "City")}{f("region", "State")}{f("postal_code", "ZIP")}
            <div><span className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Country</span><select className={input} value={from.country ?? "US"} onChange={(e) => setFrom({ ...from, country: e.target.value })}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
            <div><span className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Handling fee $ per shipment</span><input className={input} value={handling} inputMode="decimal" onChange={(e) => setHandling(e.target.value)} /></div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between"><p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Rate table (JSON, cents; per zone: {Object.values(ZONE_LABEL).join(" · ")})</p><button onClick={() => defaults && setRatesText(JSON.stringify(defaults, null, 2))} className="text-xs text-[#3AFFD4]">Reset to defaults</button></div>
          <textarea value={ratesText} onChange={(e) => setRatesText(e.target.value)} rows={18} className={input + " mt-3 font-dm-mono text-xs"} spellCheck={false} />
          <p className="mt-2 text-xs text-neutral-500">Each service: id, name, base_cents, per_kg_cents, optional max_kg, eta text, eta_days [min, max]. Price = base + per-kg × weight (rounded up to 100 g) + handling.</p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Try a quote</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div><span className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Destination</span><select className={input} value={quoteCountry} onChange={(e) => setQuoteCountry(e.target.value)}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
            <div><span className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Item weight (g)</span><input className={input} value={quoteWeight} inputMode="numeric" onChange={(e) => setQuoteWeight(e.target.value)} /></div>
            <button onClick={tryQuote} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-200 hover:bg-white/5">Quote</button>
          </div>
          {quote && <div className="mt-3 text-sm text-neutral-300">{quote.zone_label}: {quote.options.map((o) => `${o.name} $${(o.cents / 100).toFixed(2)} (${o.eta})`).join(" · ")}</div>}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} className="rounded-xl bg-[#39FF14] px-5 py-2 text-sm font-semibold text-black">Save</button>
          {msg && <span className="text-sm text-neutral-400">{msg}</span>}
        </div>
        <p className="mt-6 text-xs text-neutral-600">Zones: {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => `${z} = ${ZONE_LABEL[z]}`).join(", ")}.</p>
      </div>
    </main>
  );
}
