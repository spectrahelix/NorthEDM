"use client";
import { useEffect, useState } from "react";
import { BRIDGE_PROVIDERS } from "@/utils/bridge";

type Bridge = Record<string, string | boolean | null> & { status?: string; provider?: string };
const label = "mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500";
const input = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none";
const F = (k: string, l: string, ph = "") => ({ k, l, ph });
const BUSINESS = [F("business_name", "Registered business name"), F("registration_number", "Registration number (Registrar of Companies)"), F("tin", "GRA tax number (TIN)"), F("business_address", "Business address")];
const BANK = [F("bank_name", "Bank", "e.g. GTBank, Ecobank, Trust Bank, Access"), F("bank_account_name", "Name on the account"), F("bank_account_number", "Account number"), F("bank_swift", "SWIFT / BIC (for USD transfers out)")];
const PROVIDER = [F("merchant_id", "Merchant ID"), F("api_key", "API key"), F("webhook_secret", "Webhook secret"), F("provider_contact", "Your contact at the provider (name, email, phone)")];
const STATUS_TEXT: Record<string, string> = { draft: "Not submitted yet", submitted: "Submitted — NorthEDM is reviewing", verified: "Verified by NorthEDM — the bridge is being built", live: "Live" };

/**
 * The coordinator's intake for the Gambian payment bridge: business, bank and
 * aggregator details (Waychit first, Modem Pay second). Saved values that are
 * secrets show as •••• and are replaced only when a new value is typed.
 */
export function BridgeIntake({ scope = "coordinator" }: { scope?: "coordinator" | "shop" }) {
  const endpoint = scope === "shop" ? "/api/vendor/bridge" : "/api/festdash/purse/bridge";
  const [bridge, setBridge] = useState<Bridge | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState<"waychit" | "modempay">("waychit");
  const [canUsd, setCanUsd] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const load = () => fetch(endpoint).then((r) => (r.ok ? r.json() : { bridge: null })).then((j) => { setBridge(j.bridge); if (j.bridge?.provider) setProvider(j.bridge.provider); if (typeof j.bridge?.bank_can_send_usd === "boolean") setCanUsd(j.bridge.bank_can_send_usd); }).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [endpoint]);
  async function send(action: "save" | "submit") {
    setBusy(action); setMsg("");
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, provider, bank_can_send_usd: canUsd, action }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    setMsg(r.ok ? (action === "submit" ? "Submitted. NorthEDM has been told and will confirm the next step." : "Saved.") : j.error ?? "Failed.");
    if (r.ok) { setForm({}); load(); }
  }
  const saved = (k: string) => { const v = bridge?.[k]; return typeof v === "string" && v ? v : ""; };
  const field = (f: { k: string; l: string; ph: string }) => (
    <div key={f.k}>
      <span className={label}>{f.l}</span>
      <input className={input} value={form[f.k] ?? ""} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} placeholder={saved(f.k) ? `${saved(f.k)} (saved — type to replace)` : f.ph} />
    </div>
  );
  const status = String(bridge?.status ?? "draft");
  return (
    <div className="rounded-2xl border border-orange-500/20 bg-orange-950/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-dm-mono text-xs uppercase tracking-widest text-orange-300">{scope === "shop" ? "Payment bridge — get paid straight to your own bank account" : "Payment bridge — so customers\u2019 payments can reach NorthEDM directly"}</p>
        <span className={`rounded-full px-2.5 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest ${status === "live" ? "bg-green-500/15 text-green-300" : status === "verified" ? "bg-[#3AFFD4]/15 text-[#3AFFD4]" : status === "submitted" ? "bg-yellow-500/15 text-yellow-300" : "bg-white/10 text-neutral-400"}`}>{STATUS_TEXT[status] ?? status}</span>
      </div>
      <p className="mt-2 text-sm text-neutral-400">{scope === "shop" ? "Right now wallet payments for your orders go to your coordinator, who pays you your share. The bridge replaces that:" : "Right now customers pay your wallet and you keep the shop\u2019s and NorthEDM\u2019s shares until they are settled. The bridge replaces that:"} a licensed Gambian payment provider collects Wave, QMoney, Afrimoney and card payments, settles them to a business bank account, and the site pays each share out automatically. Fill in what you have — you can save and come back. Nothing here is shown to customers.</p>
      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-3 text-sm text-orange-300 underline-offset-2 hover:underline">{open ? "Hide the form" : "Open the form"}</button>
      {open && (
        <div className="mt-4 space-y-5">
          <div>
            <p className={label}>Provider — in this order</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {BRIDGE_PROVIDERS.map((p) => (
                <button type="button" key={p.id} onClick={() => setProvider(p.id)} className={`rounded-xl border p-3 text-left text-sm ${provider === p.id ? "border-orange-400/60 bg-orange-500/10 text-white" : "border-white/10 text-neutral-300 hover:bg-white/5"}`}>
                  <span className="font-semibold">{p.name}</span><span className="block text-xs text-neutral-500">{p.note}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-500">Ask Waychit first for a merchant account, fees, settlement time and the documents they need. If they can&apos;t open one, ask Modem Pay. Put what they tell you in the notes.</p>
          </div>
          <div><p className={label}>1 · The business</p><div className="grid gap-3 sm:grid-cols-2">{BUSINESS.map(field)}</div></div>
          <div>
            <p className={label}>2 · The business bank account (where the provider settles)</p>
            <div className="grid gap-3 sm:grid-cols-2">{BANK.map(field)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-300">
              <span>Can this account send US dollars abroad?</span>
              {[["yes", true], ["no", false], ["not asked yet", null]].map(([t, v]) => (
                <button type="button" key={String(t)} onClick={() => setCanUsd(v as boolean | null)} className={`rounded-lg border px-3 py-1 text-xs ${canUsd === v ? "border-white/60 bg-white/10 text-white" : "border-white/10 text-neutral-400"}`}>{t as string}</button>
              ))}
            </div>
          </div>
          <div><p className={label}>3 · From the provider, once the merchant account exists</p><div className="grid gap-3 sm:grid-cols-2">{PROVIDER.map(field)}</div></div>
          <div><span className={label}>Notes — fees quoted, settlement time, documents asked for, who you spoke to</span><textarea rows={3} className={input} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={saved("notes") || ""} /></div>
          {typeof bridge?.owner_notes === "string" && bridge.owner_notes && <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300"><span className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">From NorthEDM · </span>{bridge.owner_notes}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => send("save")} disabled={!!busy} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50">{busy === "save" ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => send("submit")} disabled={!!busy} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">{busy === "submit" ? "Sending…" : "Submit to NorthEDM"}</button>
            {msg && <span className="text-sm text-neutral-300">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
