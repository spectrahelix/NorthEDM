"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

/**
 * A vendor's own business details, editable by them.
 *
 * Safe to expose because the database guards the fields only an admin may set
 * (protect_vendor_admin_fields): approval, public listing, featured, founder
 * and suspension cannot be changed from here even by a direct API call. This
 * form only ever sends the fields below, and the status panel is read-only.
 */

type VendorRow = {
  id: number;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  business_email: string | null;
  phone: string | null;
  show_phone: boolean | null;
  website: string | null;
  category: string | null;
  capacity: string | null;
  description: string | null;
  wants_public: boolean | null;
  status: string | null;
  is_public: boolean | null;
  vendor_type: string | null;
  suspended_at: string | null;
};

const EDITABLE = [
  "name", "first_name", "last_name", "email", "business_email", "phone",
  "show_phone", "website", "category", "capacity", "description", "wants_public",
] as const;

const input =
  "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-[#3AFFD4]/50";
const label = "mb-1.5 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500";

export function VendorEditor({ vendorId }: { vendorId: number }) {
  const [v, setV] = useState<VendorRow | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    createClient()
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setLoadError(error.message);
        else if (!data) setLoadError("We couldn't find your vendor record. Contact NorthEDM.");
        else setV(data as VendorRow);
      });
  }, [vendorId]);

  function set<K extends keyof VendorRow>(key: K, value: VendorRow[K]) {
    setV((cur) => (cur ? { ...cur, [key]: value } : cur));
  }

  async function save() {
    if (!v) return;
    if (!v.name?.trim()) {
      setErr("Your business name can't be empty — it's the title customers see.");
      return;
    }
    setSaving(true);
    setErr("");
    setMsg("");
    const patch: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      const val = v[k];
      patch[k] = typeof val === "string" ? val.trim() || null : val;
    }
    const { error } = await createClient().from("vendors").update(patch).eq("id", v.id);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg("Saved.");
    setTimeout(() => setMsg(""), 3000);
  }

  if (loadError) {
    return <p className="text-sm text-[#FF5C3A]">{loadError}</p>;
  }
  if (!v) return <p className="text-sm text-neutral-500">Loading your business…</p>;

  const listing = v.suspended_at
    ? { text: "Hidden from public — contact NorthEDM", tone: "text-orange-300" }
    : v.status !== "approved"
      ? { text: `Application ${v.status ?? "pending"}`, tone: "text-[#FFC93C]" }
      : v.is_public
        ? { text: v.vendor_type === "featured" ? "Live — featured" : "Live in the public directory", tone: "text-[#39FF14]" }
        : { text: "Approved — not listed publicly", tone: "text-neutral-300" };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="font-bebas text-3xl tracking-wide text-white">Your vendor business</h2>
      <p className="mb-5 mt-1 text-sm text-neutral-400">
        Everything customers and NorthEDM see about your business. Your inventory is on your{" "}
        <Link href="/vendor/dashboard" className="text-[#3AFFD4] hover:opacity-80">vendor dashboard</Link>.
      </p>

      {/* Read-only: these are NorthEDM's to set. */}
      <div className="mb-6 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
        <span className="text-neutral-500">Listing status: </span>
        <span className={listing.tone}>{listing.text}</span>
      </div>

      <div className="space-y-4">
        <div>
          <label className={label}>Business name</label>
          <input className={input} value={v.name ?? ""} maxLength={120}
            onChange={(e) => set("name", e.target.value)} placeholder="The name customers see" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Your first name</label>
            <input className={input} value={v.first_name ?? ""} maxLength={60}
              onChange={(e) => set("first_name", e.target.value)} />
          </div>
          <div>
            <label className={label}>Your last name</label>
            <input className={input} value={v.last_name ?? ""} maxLength={60}
              onChange={(e) => set("last_name", e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Personal email</label>
            <input className={input} type="email" value={v.email ?? ""} maxLength={160}
              onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className={label}>Business email (optional)</label>
            <input className={input} type="email" value={v.business_email ?? ""} maxLength={160}
              onChange={(e) => set("business_email", e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Phone</label>
            <input className={input} value={v.phone ?? ""} maxLength={40}
              onChange={(e) => set("phone", e.target.value)} />
            <label className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
              <input type="checkbox" checked={!!v.show_phone}
                onChange={(e) => set("show_phone", e.target.checked)} />
              Show my phone on my public listing
            </label>
          </div>
          <div>
            <label className={label}>Website</label>
            <input className={input} value={v.website ?? ""} maxLength={200}
              onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Category</label>
            <input className={input} value={v.category ?? ""} maxLength={80}
              onChange={(e) => set("category", e.target.value)} />
          </div>
          <div>
            <label className={label}>Capacity</label>
            <input className={input} value={v.capacity ?? ""} maxLength={60}
              onChange={(e) => set("capacity", e.target.value)} placeholder="low, medium, high" />
          </div>
        </div>

        <div>
          <label className={label}>Purpose — what you offer</label>
          <textarea className={input} rows={4} value={v.description ?? ""} maxLength={4000}
            onChange={(e) => set("description", e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={!!v.wants_public}
            onChange={(e) => set("wants_public", e.target.checked)} />
          I&apos;d like to be listed in the public vendor directory
          <span className="text-xs text-neutral-500">(NorthEDM confirms this)</span>
        </label>
      </div>

      {err && <p className="mt-4 text-sm text-[#FF5C3A]">{err}</p>}
      <div className="mt-5 flex items-center justify-end gap-3">
        {msg && <span className="text-sm text-[#39FF14]">{msg}</span>}
        <button onClick={save} disabled={saving}
          className="rounded-xl bg-[#39FF14] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : "Save business details"}
        </button>
      </div>
    </div>
  );
}
