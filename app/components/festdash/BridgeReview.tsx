"use client";
import { useEffect, useState } from "react";

type Row = Record<string, string | boolean | null> & { id: string; user_id: string; display_name: string | null; provider: string; status: string };
const KEYS: [string, string][] = [["business_name", "Business"], ["registration_number", "Reg. no."], ["tin", "TIN"], ["business_address", "Address"], ["bank_name", "Bank"], ["bank_account_name", "Account name"], ["bank_account_number", "Account no."], ["bank_swift", "SWIFT"], ["merchant_id", "Merchant ID"], ["api_key", "API key"], ["webhook_secret", "Webhook secret"], ["provider_contact", "Provider contact"], ["notes", "Their notes"]];

/** Owner's view of each coordinator's payment-bridge intake, secrets masked; set status and leave a note. */
export function BridgeReview() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const load = () => fetch("/api/festdash/admin/bridge").then((r) => (r.ok ? r.json() : { bridges: [] })).then((j) => setRows(j.bridges ?? [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  async function set(id: string, status?: string) {
    const r = await fetch("/api/festdash/admin/bridge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, owner_notes: notes[id] }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Saved." : j.error ?? "Failed."); if (r.ok) load();
  }
  if (!rows) return null;
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Payment bridge intake (Waychit → Modem Pay)</p>
      <p className="mt-1 text-xs text-neutral-500">What each coordinator and shop has entered for the payment bridge. Secrets and account numbers show their last four characters only. Mark <em>verified</em> once you&apos;ve checked the business and bank with them; <em>live</em> once the provider is wired in.</p>
      {msg && <p className="mt-2 text-sm text-neutral-300">{msg}</p>}
      {rows.length === 0 ? <p className="mt-3 text-sm text-neutral-600">Nothing entered yet.</p> : rows.map((r) => (
        <div key={r.id} className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-white">{r.display_name ?? r.user_id.slice(0, 8)} · {r.provider === "modempay" ? "Modem Pay" : "Waychit"}</p>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-300">{r.status}{r.submitted_at ? ` · submitted ${new Date(String(r.submitted_at)).toLocaleDateString()}` : ""}</span>
          </div>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {KEYS.map(([k, l]) => <div key={k} className="flex gap-2"><dt className="w-32 shrink-0 text-neutral-500">{l}</dt><dd className="text-neutral-200">{typeof r[k] === "string" && r[k] ? String(r[k]) : <span className="text-neutral-700">—</span>}</dd></div>)}
            <div className="flex gap-2"><dt className="w-32 shrink-0 text-neutral-500">Bank sends USD</dt><dd className="text-neutral-200">{r.bank_can_send_usd === true ? "yes" : r.bank_can_send_usd === false ? "no" : "not asked yet"}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input value={notes[r.id] ?? (typeof r.owner_notes === "string" ? r.owner_notes : "")} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Note back to them (shown on their purse page)" className="min-w-[16rem] flex-1 rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-100 outline-none" />
            <button onClick={() => set(r.id)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/5">Save note</button>
            <button onClick={() => set(r.id, "verified")} className="rounded-lg border border-[#3AFFD4]/40 px-3 py-1.5 text-xs text-[#3AFFD4] hover:bg-[#3AFFD4]/10">Verified</button>
            <button onClick={() => set(r.id, "live")} className="rounded-lg border border-green-500/40 px-3 py-1.5 text-xs text-green-300 hover:bg-green-500/10">Live</button>
            <button onClick={() => set(r.id, "draft")} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/5">Back to draft</button>
          </div>
        </div>
      ))}
    </section>
  );
}
