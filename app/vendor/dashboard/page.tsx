"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Product = {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  price: number;
  inventory_count: number;
  image_url: string | null;
  is_public: boolean;
  status: string;
  source?: string;
};

type SquareStatus = {
  connected: boolean;
  environment?: string;
  location_id?: string;
  last_synced_at?: string | null;
  last_sync_status?: string | null;
};

const EMPTY = {
  name: "", category: "", description: "", price: "", inventoryCount: "", imageUrl: "", isPublic: true,
};

export default function VendorDashboard() {
  const [access, setAccess] = useState<"loading" | "no-vendor" | "no-access" | "ok">("loading");
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Square sync
  const [square, setSquare] = useState<SquareStatus | null>(null);
  const [sqToken, setSqToken] = useState("");
  const [sqLocation, setSqLocation] = useState("");
  const [sqEnv, setSqEnv] = useState<"sandbox" | "production">("sandbox");
  const [sqBusy, setSqBusy] = useState(false);
  const [sqMsg, setSqMsg] = useState("");
  const [showSquare, setShowSquare] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAccess("no-vendor"); return; }
      const [{ data: prof }, { data: me }] = await Promise.all([
        supabase.from("profiles").select("vendor_id").eq("id", user.id).single(),
        supabase.from("user_profiles").select("is_marketplace, role").eq("id", user.id).single(),
      ]);
      if (!prof?.vendor_id) { setAccess("no-vendor"); return; }
      setVendorId(prof.vendor_id);
      const isAdmin = me?.role === "archon" || me?.role === "warden" || user.email === "cjblue27@gmail.com";
      if (!me?.is_marketplace && !isAdmin) { setAccess("no-access"); return; }
      setAccess("ok");
      loadProducts();
      loadSquareStatus();
    })();
  }, []);

  async function loadProducts() {
    const res = await fetch("/api/vendor/products");
    const j = await res.json().catch(() => ({}));
    if (res.ok) setProducts(j.products ?? []);
  }

  async function loadSquareStatus() {
    const res = await fetch("/api/vendor/square/status");
    const j = await res.json().catch(() => ({}));
    if (res.ok) setSquare(j);
  }

  async function connectSquare(e: React.FormEvent) {
    e.preventDefault();
    if (!sqToken.trim()) { setSqMsg("Paste your Square access token."); return; }
    setSqBusy(true); setSqMsg("");
    const res = await fetch("/api/vendor/square/connect", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: sqToken, locationId: sqLocation, environment: sqEnv }),
    });
    const j = await res.json().catch(() => ({}));
    setSqBusy(false);
    if (!res.ok) { setSqMsg(j.error || "Connect failed."); return; }
    setSqToken(""); setSqLocation("");
    setSqMsg(j.sync ? `Connected — synced ${j.sync.created} new, ${j.sync.updated} updated.` : (j.syncError || "Connected."));
    loadSquareStatus(); loadProducts();
  }

  async function syncSquare() {
    setSqBusy(true); setSqMsg("");
    const res = await fetch("/api/vendor/square/sync", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setSqBusy(false);
    if (!res.ok) { setSqMsg(j.error || "Sync failed."); return; }
    setSqMsg(`Synced ${j.sync.created} new, ${j.sync.updated} updated, ${j.sync.unpublished} hidden.`);
    loadSquareStatus(); loadProducts();
  }

  async function disconnectSquare() {
    if (!window.confirm("Disconnect Square? Synced products will be hidden (not deleted).")) return;
    setSqBusy(true); setSqMsg("");
    await fetch("/api/vendor/square/disconnect", { method: "POST" });
    setSqBusy(false);
    loadSquareStatus(); loadProducts();
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/vendor/products/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) { setError(j.error || "Upload failed."); return; }
    setForm((f) => ({ ...f, imageUrl: j.url }));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Product name is required."); return; }
    setSaving(true); setError("");
    const payload = {
      name: form.name, category: form.category, description: form.description,
      price: form.price, inventoryCount: form.inventoryCount, imageUrl: form.imageUrl || null,
      isPublic: form.isPublic, status: form.isPublic ? "published" : "draft",
    };
    const res = editingId
      ? await fetch(`/api/vendor/products/${editingId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/vendor/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(j.error || "Save failed."); return; }
    setForm({ ...EMPTY }); setEditingId(null);
    loadProducts();
  }

  function edit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name, category: p.category || "", description: p.description || "",
      price: String(p.price ?? ""), inventoryCount: String(p.inventory_count ?? ""),
      imageUrl: p.image_url || "", isPublic: p.is_public,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(id: number) {
    if (!window.confirm("Delete this product?")) return;
    const res = await fetch(`/api/vendor/products/${id}`, { method: "DELETE" });
    if (res.ok) loadProducts();
  }

  if (access === "loading") {
    return <main className="flex min-h-screen items-center justify-center"><p className="font-dm-mono text-sm text-neutral-500">Loading…</p></main>;
  }
  if (access === "no-vendor") {
    return <Gate title="Become a Vendor first" body="You need an approved NorthEDM vendor account to manage a marketplace." href="/vendors/apply" cta="Apply to be a Vendor" />;
  }
  if (access === "no-access") {
    return <Gate title="Marketplace access needed" body="Uploading inventory is a granted feature. Apply for your own NorthEDM Marketplace and we'll set you up." href="/marketplace/apply" cta="Apply for Marketplace" />;
  }

  return (
    <main className="min-h-screen px-6 py-14 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#00D4FF]">Vendor Dashboard</p>
            <h1 className="mt-2 font-bebas text-5xl tracking-wide">Your Inventory</h1>
          </div>
          {vendorId && (
            <Link href={`/marketplace/${vendorId}`} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5">
              View my market →
            </Link>
          )}
        </div>

        {/* Square sync */}
        <div className="mt-8 rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/[0.03] p-5">
          {square?.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-dm-mono text-xs uppercase tracking-widest text-[#00D4FF]">
                  🟦 Square Connected <span className="text-neutral-500">({square.environment})</span>
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {square.last_synced_at
                    ? `Last synced ${new Date(square.last_synced_at).toLocaleString()}`
                    : "Not synced yet"}
                  {square.last_sync_status ? ` · ${square.last_sync_status}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={syncSquare} disabled={sqBusy}
                  className="rounded-xl bg-[#00D4FF] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50">
                  {sqBusy ? "Syncing…" : "↻ Sync now"}
                </button>
                <button onClick={disconnectSquare} disabled={sqBusy}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-400 transition hover:bg-white/5 disabled:opacity-50">
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <>
              <button onClick={() => setShowSquare((s) => !s)}
                className="flex w-full items-center justify-between text-left">
                <span className="font-dm-mono text-xs uppercase tracking-widest text-[#00D4FF]">
                  🟦 Sync inventory from Square
                </span>
                <span className="text-neutral-500">{showSquare ? "−" : "+"}</span>
              </button>
              {showSquare && (
                <form onSubmit={connectSquare} className="mt-4 space-y-3">
                  <p className="text-xs text-neutral-500">
                    Paste a Square access token to mirror your Square catalog + stock into your menu.
                    Synced items are managed in Square (read-only here).
                  </p>
                  <input value={sqToken} onChange={(e) => setSqToken(e.target.value)} placeholder="Square access token"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
                  <div className="flex flex-wrap gap-3">
                    <input value={sqLocation} onChange={(e) => setSqLocation(e.target.value)} placeholder="Location ID (optional if only one)"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
                    <select value={sqEnv} onChange={(e) => setSqEnv(e.target.value as "sandbox" | "production")}
                      className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 focus:outline-none">
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                  <button type="submit" disabled={sqBusy}
                    className="rounded-xl bg-[#00D4FF] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50">
                    {sqBusy ? "Connecting…" : "Connect & sync"}
                  </button>
                </form>
              )}
            </>
          )}
          {sqMsg && <p className="mt-3 text-sm text-neutral-300">{sqMsg}</p>}
        </div>

        {/* Add / edit form */}
        <form onSubmit={save} className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
            {editingId ? "Edit product" : "Add a product"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name *"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
            <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price (e.g. 25.00)" inputMode="decimal"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
            <input value={form.inventoryCount} onChange={(e) => setForm({ ...form, inventoryCount: e.target.value })} placeholder="In stock (qty)" inputMode="numeric"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
          </div>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Description"
            className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5 disabled:opacity-50">
              {uploading ? "Uploading…" : form.imageUrl ? "Change image" : "Upload image"}
            </button>
            {form.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
            )}
            <label className="ml-auto flex items-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
              Publish to my market
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-[#FF5C3A]">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={saving}
              className="rounded-xl bg-[#00D4FF] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving…" : editingId ? "Update product" : "Add product"}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm({ ...EMPTY }); }}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-neutral-400 transition hover:text-white">
                Cancel edit
              </button>
            )}
          </div>
        </form>

        {/* Product list */}
        <h2 className="mt-10 mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Products ({products.length})
        </h2>
        {products.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-500">No products yet — add your first above.</p>
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url || "/northedm-logo.svg"} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">
                    {p.name}
                    {p.source === "square" && (
                      <span className="ml-2 rounded-md bg-[#00D4FF]/15 px-1.5 py-0.5 align-middle font-dm-mono text-[10px] text-[#00D4FF]">🟦 Square</span>
                    )}
                  </p>
                  <p className="font-dm-mono text-xs text-neutral-500">
                    ${Number(p.price).toFixed(2)} · {p.inventory_count} in stock ·{" "}
                    <span className={p.is_public ? "text-[#39FF14]" : "text-neutral-600"}>{p.is_public ? "Published" : "Draft"}</span>
                  </p>
                </div>
                {p.source === "square" ? (
                  <span className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">Managed in Square</span>
                ) : (
                  <>
                    <button onClick={() => edit(p)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/5">Edit</button>
                    <button onClick={() => del(p.id)} className="rounded-lg border border-[#FF5C3A]/30 px-3 py-1.5 text-xs text-[#FF5C3A] transition hover:bg-[#FF5C3A]/10">Delete</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Gate({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-neutral-100">
      <div className="max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <div className="text-4xl">🏪</div>
        <h1 className="mt-3 font-bebas text-3xl tracking-wide">{title}</h1>
        <p className="mt-2 text-sm text-neutral-400">{body}</p>
        <Link href={href} className="mt-6 inline-block rounded-xl bg-[#00D4FF] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90">{cta}</Link>
      </div>
    </main>
  );
}
