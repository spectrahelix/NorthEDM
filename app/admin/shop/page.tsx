"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Product = {
  id: string; name: string; slug: string; description: string;
  price_cents: number; inventory_count: number; image_urls: string[];
  category: string | null; active: boolean; created_at: string;
};

export default function AdminShopPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ id: "", name: "", description: "", priceDollars: "", inventoryCount: "", category: "", imageUrls: [] as string[], active: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/shop/products");
    if (res.status === 401 || res.status === 403) { router.push("/"); return; }
    const j = await res.json();
    setProducts(j.products ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
      if (p?.role !== "archon" && p?.role !== "warden") { router.push("/"); return; }
      load();
    });
  }, [supabase, router, load]);

  function resetForm() {
    setForm({ id: "", name: "", description: "", priceDollars: "", inventoryCount: "", category: "", imageUrls: [], active: true });
    setEditingId(null);
  }
  function edit(p: Product) {
    setEditingId(p.id);
    setForm({
      id: p.id, name: p.name, description: p.description,
      priceDollars: (p.price_cents / 100).toFixed(2),
      inventoryCount: String(p.inventory_count),
      category: p.category ?? "", imageUrls: p.image_urls ?? [], active: p.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadImages(files: FileList) {
    setUploading(true); setError("");
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/admin/shop/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.url) setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, j.url] }));
      else setError(j.error ?? "Upload failed");
    }
    setUploading(false);
  }

  async function save() {
    setError("");
    if (!form.name.trim()) { setError("Name is required."); return; }
    const priceCents = Math.round(parseFloat(form.priceDollars || "0") * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) { setError("Valid price required."); return; }
    setSaving(true);
    const payload = {
      name: form.name, description: form.description, priceCents,
      inventoryCount: parseInt(form.inventoryCount || "0", 10),
      category: form.category, imageUrls: form.imageUrls, active: form.active,
    };
    const res = editingId
      ? await fetch(`/api/admin/shop/products/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/admin/shop/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(j.error ?? "Save failed"); return; }
    resetForm(); load();
  }

  async function del(p: Product) {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    const res = await fetch(`/api/admin/shop/products/${p.id}`, { method: "DELETE" });
    if (res.ok) setProducts((prev) => prev.filter((x) => x.id !== p.id));
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center admin-surface font-dm-mono text-sm text-neutral-500">Loading shop…</main>;

  const inp = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none";

  return (
    <main className="min-h-screen text-neutral-100 admin-surface">
      <div className="border-b border-white/10 bg-neutral-950/90">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="font-dm-mono text-xs text-neutral-600 hover:text-neutral-400">← Admin</Link>
            <span className="text-neutral-800">|</span>
            <p className="font-dm-mono text-xs uppercase tracking-widest text-[#39FF14]">Shop · Inventory</p>
            <span className="text-neutral-800">|</span>
            <Link href="/admin/shop/orders" className="font-dm-mono text-xs text-neutral-400 hover:text-white">Orders →</Link>
          </div>
          <h1 className="mt-2 font-bebas text-4xl tracking-wide">NorthEDM Store</h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {error && <div className="mb-4 rounded-xl border border-[#FF5C3A]/20 bg-[#FF5C3A]/5 px-4 py-3 text-sm text-[#FF5C3A]">{error}</div>}

        {/* Editor */}
        <div className="mb-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
            {editingId ? "Edit product" : "Add product"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Name</label>
              <input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" />
            </div>
            <div>
              <label className="mb-1 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Price (USD)</label>
              <input className={inp} value={form.priceDollars} onChange={(e) => setForm({ ...form, priceDollars: e.target.value })} inputMode="decimal" placeholder="0.00" />
            </div>
            <div>
              <label className="mb-1 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Inventory (stock)</label>
              <input className={inp} value={form.inventoryCount} onChange={(e) => setForm({ ...form, inventoryCount: e.target.value })} inputMode="numeric" placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Category</label>
              <input className={inp} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Apparel" />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-neutral-300">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-[#39FF14]" />
              Active (visible in store)
            </label>
            <div className="sm:col-span-2">
              <label className="mb-1 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Description</label>
              <textarea className={inp} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the product…" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Images</label>
              <div className="flex flex-wrap items-center gap-3">
                {form.imageUrls.map((u) => (
                  <div key={u} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    <button onClick={() => setForm((f) => ({ ...f, imageUrls: f.imageUrls.filter((x) => x !== u) }))}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-neutral-300 ring-1 ring-white/20">✕</button>
                  </div>
                ))}
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/20 text-xs text-neutral-500 hover:bg-white/5">
                  {uploading ? "…" : "+ add"}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && uploadImages(e.target.files)} />
                </label>
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={save} disabled={saving} className="rounded-xl bg-[#39FF14] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving…" : editingId ? "Save changes" : "Add product"}
            </button>
            {editingId && <button onClick={resetForm} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-neutral-400 hover:text-white">Cancel</button>}
          </div>
        </div>

        {/* List */}
        <p className="mb-3 font-dm-mono text-xs text-neutral-600">{products.length} product{products.length !== 1 ? "s" : ""}</p>
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image_urls?.[0] || "/northedm-logo.svg"} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{p.name} {!p.active && <span className="ml-1 font-dm-mono text-[10px] text-neutral-600">(hidden)</span>}</p>
                <p className="font-dm-mono text-xs text-neutral-500">${(p.price_cents / 100).toFixed(2)} · {p.inventory_count} in stock{p.category ? ` · ${p.category}` : ""}</p>
              </div>
              <button onClick={() => edit(p)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5">Edit</button>
              <button onClick={() => del(p)} className="rounded-lg border border-[#FF5C3A]/30 px-3 py-1.5 text-xs text-[#FF5C3A] hover:bg-[#FF5C3A]/10">Delete</button>
            </div>
          ))}
          {products.length === 0 && <p className="text-sm text-neutral-600">No products yet — add your first one above.</p>}
        </div>
      </div>
    </main>
  );
}
