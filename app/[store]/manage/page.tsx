"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AccentPicker } from "@/app/components/AccentPicker";
import { storeTheme } from "@/utils/storeThemes";
import { PillSwitch } from "@/app/components/PillSwitch";
import { SHOP_FONT_CHOICES } from "@/utils/storeFonts";

type Store = { id: string; slug: string; name: string; tagline: string | null; accent_color: string; operator_fee_bps: number; theme: string; font: string | null; allow_custom_font: boolean; allow_custom_theme: boolean; theme_options: string[] };
type Member = { vendor_id: number; status: string; name: string; category: string | null };
type Available = { id: number; name: string | null; category: string | null };

export default function StoreManagePage() {
  const slug = String(useParams().store || "");
  const [store, setStore] = useState<Store | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [available, setAvailable] = useState<Available[]>([]);
  const [state, setState] = useState<"loading" | "denied" | "ok">("loading");

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [accent, setAccent] = useState("#39FF14");
  const [addId, setAddId] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch(`/api/store/${slug}`);
    if (!res.ok) { setState("denied"); return; }
    const j = await res.json();
    setStore(j.store); setMembers(j.memberVendors ?? []); setAvailable(j.availableVendors ?? []);
    setName(j.store.name); setTagline(j.store.tagline || ""); setAccent(j.store.accent_color || "#39FF14");
    setState("ok");
  }
  useEffect(() => { if (slug) load(); }, [slug]);

  async function post(body: Record<string, unknown>, okMsg?: string) {
    const res = await fetch(`/api/store/${slug}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(j.error || "Failed."); return; }
    if (okMsg) setMsg(okMsg);
    load();
  }

  if (state === "loading") return <main className="flex min-h-screen items-center justify-center"><p className="font-dm-mono text-sm text-neutral-500">Loading…</p></main>;
  if (state === "denied") return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div><h1 className="font-bebas text-3xl tracking-wide text-white">Not your store</h1>
      <p className="mt-2 text-neutral-400">You don&apos;t have access to manage this store.</p></div>
    </main>
  );

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-dm-mono text-xs uppercase tracking-[0.3em]" style={{ color: store?.accent_color }}>Store operator</p>
            <h1 className="mt-2 font-bebas text-5xl tracking-wide">Manage {store?.name}</h1>
          </div>
          <Link href={`/${slug}`} className="shrink-0 rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5">View storefront →</Link>
        </div>

        {/* Branding */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Branding</p>
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Store name"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:outline-none" />
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:outline-none" />
            <div>
              <p className="mb-2 font-dm-mono text-xs text-neutral-500">Accent colour</p>
              <AccentPicker value={accent} onChange={setAccent} />
            </div>
          </div>
          <button onClick={() => post({ action: "branding", name, tagline, accentColor: accent }, "Saved.")}
            className="mt-4 rounded-xl bg-[#00D4FF] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90">Save branding</button>
        </div>

        {/* Look — choose a theme from the templates NorthEDM made for this store
            (or the standard backdrop), and switch theme/font between Custom and
            Standard. The font itself is set with NorthEDM at setup. */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Your shop&apos;s look</p>
          <div className="flex flex-wrap gap-2">
            <PillSwitch label="Store theme" value={!!store && store.allow_custom_theme && store.theme !== "northedm"}
              disabled={!store || store.theme === "northedm"}
              onChange={(on) => post({ action: "branding", allowCustomTheme: on }, on ? "Your theme is showing." : "Showing the standard NorthEDM backdrop.")} />
            <PillSwitch label="Store font" value={!!store?.font && store.allow_custom_font}
              disabled={!store?.font}
              onChange={(on) => post({ action: "branding", allowCustomFont: on }, on ? "Your font is showing." : "Showing the standard NorthEDM font.")} />
          </div>

          <p className="mt-5 mb-2 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Choose your theme</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {["northedm", ...(store?.theme_options ?? [])].map((key) => {
              const t = storeTheme(key);
              const active = store?.theme === key && (key === "northedm" || store?.allow_custom_theme);
              return (
                <button key={key} type="button"
                  onClick={() => post({ action: "branding", theme: key }, `${t.label} is now your look.`)}
                  className={`overflow-hidden rounded-xl border text-left transition ${active ? "border-white/70 ring-1 ring-white/40" : "border-white/10 hover:border-white/30"}`}>
                  <div className="relative h-20" style={{ background: key === "northedm" ? "#0a0a0a" : t.background }}>
                    {t.band === "awning" && <div aria-hidden className="store-awning absolute inset-x-0 bottom-3 !h-3 !mb-0" />}
                    <span className="absolute left-2 top-2 h-3 w-3 rounded-full" style={{ background: t.accent ?? store?.accent_color ?? "#39FF14" }} />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="truncate text-xs text-neutral-200">{key === "northedm" ? "Standard NorthEDM" : t.label}</span>
                    {active && <span className="font-dm-mono text-[10px] text-[#39FF14]">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {(store?.theme_options ?? []).length === 0 && (
            <p className="mt-2 text-xs text-neutral-500">Custom themes are designed with NorthEDM from your logo — ask us and they&apos;ll appear here.</p>
          )}
          <p className="mt-4 text-xs text-neutral-500">
            Font: <span className="text-neutral-300">{SHOP_FONT_CHOICES.find((f) => f.key === store?.font)?.label ?? "Standard NorthEDM"}</span>
            {" "}— set with NorthEDM. Customers can also switch shop fonts off for themselves.
          </p>
        </div>

        {/* Vendors */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Vendors in your store</p>
          <div className="flex gap-2">
            <select value={addId} onChange={(e) => setAddId(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-neutral-900 px-4 py-2.5 text-sm focus:outline-none">
              <option value="">Add a NorthEDM vendor…</option>
              {available.map((v) => <option key={v.id} value={v.id}>{v.name} {v.category ? `· ${v.category}` : ""}</option>)}
            </select>
            <button onClick={() => { if (addId) { post({ action: "addVendor", vendorId: Number(addId) }); setAddId(""); } }}
              className="rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90">Add</button>
          </div>

          <div className="mt-4 space-y-2">
            {members.length === 0 ? <p className="text-sm text-neutral-500">No vendors yet — add one above.</p> :
              members.map((m) => (
                <div key={m.vendor_id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">{m.name}{m.category ? <span className="text-neutral-500"> · {m.category}</span> : null}</span>
                  <button onClick={() => post({ action: "removeVendor", vendorId: m.vendor_id })}
                    className="rounded-lg bg-[#FF5C3A]/10 px-3 py-1 font-dm-mono text-[11px] text-[#FF5C3A]">remove</button>
                </div>
              ))}
          </div>
        </div>

        {msg && <p className="mt-4 font-dm-mono text-xs text-neutral-400">{msg}</p>}
      </div>
    </main>
  );
}
