import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { BackBar } from "@/app/components/BackBar";

export const dynamic = "force-dynamic";

type Store = { id: string; slug: string; name: string; tagline: string | null; accent_color: string };
type Vendor = { id: number; name: string | null; category: string | null; description: string | null };
type Product = { id: number; vendor_id: number; name: string | null; category: string | null; price: number | null; image_url: string | null };

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }): Promise<Metadata> {
  const { store } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("stores").select("name, tagline").eq("slug", store).eq("active", true).maybeSingle();
  if (!data) return { title: "Store" };
  return { title: data.name, description: data.tagline || `${data.name} on NorthEDM` };
}

export default async function StorefrontPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const supabase = await createClient();

  const { data: storeData } = await supabase
    .from("stores").select("id, slug, name, tagline, accent_color").eq("slug", slug).eq("active", true).maybeSingle();
  if (!storeData) notFound();
  const store = storeData as Store;

  const { data: members } = await supabase
    .from("store_vendors").select("vendor_id").eq("store_id", store.id).eq("status", "approved");
  const vendorIds = (members ?? []).map((m) => m.vendor_id as number);

  const [{ data: vendorsData }, { data: productsData }] = await Promise.all([
    vendorIds.length
      ? supabase.from("vendors").select("id, name, category, description").in("id", vendorIds).eq("status", "approved").eq("is_public", true)
      : Promise.resolve({ data: [] as Vendor[] }),
    vendorIds.length
      ? supabase.from("products").select("id, vendor_id, name, category, price, image_url").in("vendor_id", vendorIds).eq("is_public", true).eq("status", "published").gt("inventory_count", 0).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Product[] }),
  ]);
  const vendors = (vendorsData ?? []) as Vendor[];
  const products = (productsData ?? []) as Product[];
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  const accent = store.accent_color || "#39FF14";

  return (
    <main className="min-h-screen text-neutral-100">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: `radial-gradient(ellipse at top, ${accent}55, transparent 60%)` }} />
        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <BackBar crumbs={[{ label: "Marketplace", href: "/marketplace" }]} fallback="/marketplace" />
          <p className="font-dm-mono text-xs uppercase tracking-[0.3em]" style={{ color: accent }}>on NorthEDM</p>
          <h1 className="mt-3 font-bebas text-7xl leading-none tracking-wide md:text-8xl">{store.name}</h1>
          {store.tagline && <p className="mt-4 max-w-xl text-neutral-300">{store.tagline}</p>}
          <p className="mt-4 font-dm-mono text-xs text-neutral-500">
            {vendors.length} vendor{vendors.length === 1 ? "" : "s"} · {products.length} product{products.length === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {vendors.length > 0 && (
          <>
            <h2 className="mb-4 font-bebas text-3xl tracking-wide">Vendors</h2>
            <div className="mb-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vendors.map((v) => (
                <Link key={v.id} href={`/marketplace/${v.id}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.06]"
                  style={{ borderColor: `${accent}22` }}>
                  <p className="font-bebas text-2xl tracking-wide">{v.name}</p>
                  <p className="mt-1 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">{v.category || "vendor"}</p>
                  {v.description && <p className="mt-2 line-clamp-2 text-sm text-neutral-400">{v.description}</p>}
                </Link>
              ))}
            </div>
          </>
        )}

        <h2 className="mb-4 font-bebas text-3xl tracking-wide">Products</h2>
        {products.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-neutral-500">
            No products in this store yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link key={p.id} href={`/marketplace/${p.vendor_id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url || "/northedm-logo.svg"} alt="" className="h-40 w-full object-cover" />
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-semibold text-white">{p.name}</p>
                  <p className="font-dm-mono text-xs text-neutral-500">{vendorName.get(p.vendor_id) || ""}</p>
                  <p className="mt-2 font-bebas text-2xl" style={{ color: accent }}>${Number(p.price ?? 0).toFixed(2)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
