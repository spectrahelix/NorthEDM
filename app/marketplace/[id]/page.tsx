import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

type Vendor = {
  id: number;
  name: string | null;
  email: string | null;
  category: string | null;
  description: string | null;
  capacity: string | null;
  contact: string | null;
  vendor_type: string | null;
  is_public: boolean | null;
  is_founder: boolean | null;
  status: string | null;
};

type Product = {
  id: number;
  vendor_id: number | null;
  name: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  inventory_count: number | null;
  image_url: string | null;
  is_public: boolean | null;
  status: string | null;
};

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vendorId = Number(id);

  const { data: vendorData, error: vendorError } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", vendorId)
    .eq("status", "approved")
    .eq("is_public", true)
    .single();

  const vendor = vendorData as Vendor | null;

  if (vendorError || !vendor) {
    notFound();
  }

  const { data: productData } = await supabase
    .from("products")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("status", "published")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const products = (productData ?? []) as Product[];

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href="/marketplace" className="text-sm text-neutral-400 hover:text-white">
          ← Back to Marketplace
        </Link>

        <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-5xl font-semibold">
              {vendor.name || "Unnamed Vendor"}
            </h1>

            {vendor.vendor_type === "featured" ? (
              <span className="rounded-full bg-purple-500/20 px-3 py-1 text-sm text-purple-300">
                Featured
              </span>
            ) : null}

            {vendor.is_founder ? (
              <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm text-green-300">
                Founder Vendor
              </span>
            ) : null}
          </div>

          <p className="mt-4 text-sm uppercase tracking-[0.25em] text-neutral-400">
            {vendor.category || "uncategorized"}
          </p>

          <p className="mt-6 text-lg leading-8 text-neutral-300">
            {vendor.description || "No description available."}
          </p>

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-white/10 px-4 py-2">
              type: {vendor.vendor_type || "listed"}
            </span>
            <span className="rounded-full bg-white/10 px-4 py-2">
              capacity: {vendor.capacity || "unknown"}
            </span>
            {vendor.contact ? (
              <span className="rounded-full bg-white/10 px-4 py-2">
                contact: {vendor.contact}
              </span>
            ) : null}
          </div>

          {vendor.email ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-neutral-400">Contact</p>
              <p className="mt-2 text-lg text-neutral-200">{vendor.email}</p>
            </div>
          ) : null}
        </div>

        <section className="mt-10">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.3em] text-green-300">
              Inventory
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Available Products</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {products.length > 0 ? (
              products.map((product) => (
                <div
                  key={product.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h3 className="text-2xl font-semibold">
                    {product.name || "Unnamed Product"}
                  </h3>

                  <p className="mt-3 text-sm text-neutral-400">
                    {product.category || "uncategorized"}
                  </p>

                  <p className="mt-4 text-neutral-300">
                    {product.description || "No description available."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-white/10 px-3 py-1">
                      ${product.price ?? 0}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1">
                      stock: {product.inventory_count ?? 0}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1">
                      {product.status || "draft"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-neutral-400">
                No public products yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}