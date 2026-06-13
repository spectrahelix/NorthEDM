"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

type Product = {
  id: number;
  vendor_id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  inventory_count: number;
  image_url: string | null;
  is_public: boolean;
  status: string;
};

type FormState = {
  name: string;
  category: string;
  description: string;
  price: string;
  inventoryCount: string;
  imageUrl: string;
  isPublic: boolean;
  status: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  category: "Holistic Goods",
  description: "",
  price: "",
  inventoryCount: "",
  imageUrl: "",
  isPublic: true,
  status: "draft",
};

const CATEGORIES = [
  "Holistic Goods",
  "Essential Oils",
  "Healing Balms",
  "Skincare",
  "Bath & Body",
  "Pet Products",
  "Mushrooms",
  "Art & Crafts",
  "Other",
];

export default function VendorDashboard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      // Check vendor linkage
      const { data: profile } = await supabase
        .from("profiles")
        .select("vendor_id")
        .eq("id", user.id)
        .single();

      if (!profile?.vendor_id) {
        router.push("/");
        return;
      }

      // Get vendor name
      const { data: vendor } = await supabase
        .from("vendors")
        .select("name")
        .eq("id", profile.vendor_id)
        .single();
      setVendorName(vendor?.name ?? null);

      loadProducts();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadProducts() {
    const res = await fetch("/api/vendor/products");
    if (res.status === 401 || res.status === 403) { router.push("/"); return; }
    const json = await res.json();
    setProducts(json.products ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditId(p.id);
    setForm({
      name: p.name,
      category: p.category,
      description: p.description,
      price: String(p.price),
      inventoryCount: String(p.inventory_count),
      imageUrl: p.image_url ?? "",
      isPublic: p.is_public,
      status: p.status,
    });
    setFormError("");
    setShowForm(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!userId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Image must be under 5MB.");
      return;
    }
    setUploading(true);
    setFormError("");
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setFormError(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    setForm((f) => ({ ...f, imageUrl: `${data.publicUrl}?t=${Date.now()}` }));
    setUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Product name is required."); return; }
    if (!form.price || isNaN(Number(form.price))) { setFormError("A valid price is required."); return; }
    setSaving(true);
    setFormError("");

    const method = editId ? "PATCH" : "POST";
    const url = editId ? `/api/vendor/products/${editId}` : "/api/vendor/products";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFormError(json.error ?? "Save failed.");
      return;
    }

    if (editId) {
      setProducts((prev) =>
        prev.map((p) => (p.id === editId ? json.product : p))
      );
    } else {
      setProducts((prev) => [json.product, ...prev]);
    }
    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    await fetch(`/api/vendor/products/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
  }

  async function togglePublic(p: Product) {
    const res = await fetch(`/api/vendor/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: p.name,
        category: p.category,
        description: p.description,
        price: String(p.price),
        inventoryCount: String(p.inventory_count),
        imageUrl: p.image_url ?? "",
        isPublic: !p.is_public,
        status: p.status,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? json.product : x)));
    }
  }

  const published = products.filter((p) => p.status === "published" && p.is_public).length;
  const drafts = products.filter((p) => p.status === "draft").length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-dm-mono text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-neutral-100">
      {/* Header */}
      <div className="border-b border-white/10 bg-neutral-950/90">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#3AFFD4]">
                Vendor Dashboard
              </p>
              <h1 className="mt-1 font-bebas text-4xl tracking-wide">
                {vendorName ?? "My Vendor"}
              </h1>
            </div>
            <button
              onClick={openAdd}
              className="rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
            >
              + Add Product
            </button>
          </div>

          {/* Stats */}
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="font-dm-mono font-semibold text-[#E8FF47]">{products.length}</span>
              <span className="ml-2 text-neutral-400">total products</span>
            </div>
            <div>
              <span className="font-dm-mono font-semibold text-[#3AFFD4]">{published}</span>
              <span className="ml-2 text-neutral-400">live</span>
            </div>
            <div>
              <span className="font-dm-mono font-semibold text-neutral-500">{drafts}</span>
              <span className="ml-2 text-neutral-400">drafts</span>
            </div>
            <Link
              href={`/marketplace`}
              className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600 hover:text-neutral-300 transition"
            >
              View public listing →
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Add / Edit form */}
        {showForm && (
          <div className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-bebas text-2xl tracking-wide">
                {editId ? "Edit Product" : "New Product"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-neutral-500 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Everything Balm 4oz"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="14.99"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                    Stock / Inventory
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.inventoryCount}
                    onChange={(e) => setForm((f) => ({ ...f, inventoryCount: e.target.value }))}
                    placeholder="50"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe your product…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
                />
              </div>

              {/* Image upload */}
              <div>
                <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Product Image
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : "Upload Image"}
                  </button>
                  {form.imageUrl && (
                    <span className="font-dm-mono text-xs text-[#3AFFD4] truncate max-w-xs">
                      ✓ Image set
                    </span>
                  )}
                </div>
                <p className="mt-1 font-dm-mono text-xs text-neutral-600">
                  JPG, PNG, WEBP · max 5MB
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>

              {/* Status + Visibility */}
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 focus:outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>

                <label className="flex cursor-pointer items-center gap-3 pt-5">
                  <div
                    onClick={() => setForm((f) => ({ ...f, isPublic: !f.isPublic }))}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      form.isPublic ? "bg-[#3AFFD4]" : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                        form.isPublic ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </div>
                  <span className="text-sm text-neutral-300">
                    {form.isPublic ? "Publicly visible" : "Hidden from marketplace"}
                  </span>
                </label>
              </div>

              {formError && (
                <p className="rounded-xl border border-[#FF5C3A]/20 bg-[#FF5C3A]/5 px-4 py-2.5 text-sm text-[#FF5C3A]">
                  {formError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-neutral-400 transition hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="rounded-xl bg-[#39FF14] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : editId ? "Save Changes" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Product list */}
        {products.length === 0 && !showForm ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center">
            <p className="text-3xl mb-3">🌿</p>
            <p className="text-neutral-400">No products yet.</p>
            <button
              onClick={openAdd}
              className="mt-5 rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Add your first product
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-wrap items-start gap-4">
                  {/* Image */}
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{p.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest ${
                          p.status === "published"
                            ? "bg-[#3AFFD4]/10 text-[#3AFFD4]"
                            : "bg-white/5 text-neutral-500"
                        }`}
                      >
                        {p.status}
                      </span>
                      {!p.is_public && (
                        <span className="rounded-full bg-[#FF5C3A]/10 px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest text-[#FF5C3A]">
                          hidden
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">{p.category}</p>
                    {p.description && (
                      <p className="mt-2 text-sm text-neutral-400 line-clamp-2">{p.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 font-dm-mono text-xs text-neutral-500">
                      <span>${p.price}</span>
                      <span>stock: {p.inventory_count}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={() => togglePublic(p)}
                      className={`rounded-lg border px-3 py-1.5 font-dm-mono text-xs transition ${
                        p.is_public
                          ? "border-[#3AFFD4]/20 text-[#3AFFD4] hover:bg-[#3AFFD4]/10"
                          : "border-white/10 text-neutral-500 hover:text-white"
                      }`}
                    >
                      {p.is_public ? "Public" : "Hidden"}
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-lg border border-white/10 px-3 py-1.5 font-dm-mono text-xs text-neutral-400 transition hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="rounded-lg border border-[#FF5C3A]/20 px-3 py-1.5 font-dm-mono text-xs text-[#FF5C3A] transition hover:bg-[#FF5C3A]/10 disabled:opacity-50"
                    >
                      {deletingId === p.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
