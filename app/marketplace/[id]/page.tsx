import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { getProfile, isAdminRole } from "@/utils/supabase/profile";
import { VendorEditForm } from "./components/VendorEditForm";
import { BackBar } from "@/app/components/BackBar";
import { accentOr } from "@/utils/accent";
import { ProductThumb } from "@/app/components/ProductThumb";

function normalizeUrl(url: string) {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

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
  user_id: string | null;
  website: string | null;
  phone: string | null;
  show_phone: boolean | null;
  accent_color: string | null;
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = await getProfile(supabase);

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

  const canEdit =
    isAdminRole(profile?.role) ||
    (user && vendor.user_id === user.id);

  const { data: productData } = await supabase
    .from("products")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("status", "published")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const products = (productData ?? []) as Product[];
  const accent = accentOr(vendor.accent_color);

  return (
    <main className="min-h-screen px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <BackBar crumbs={[{ label: "Marketplace", href: "/marketplace" }]} fallback="/marketplace" />

        <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-5xl font-semibold">
              {vendor.name || "Unnamed Vendor"}
            </h1>
            {vendor.website && (
              <a
                href={normalizeUrl(vendor.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#3AFFD4] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Visit Site →
              </a>
            )}
            {canEdit && (
              <VendorEditForm
                vendorId={vendor.id}
                initial={{
                  name: vendor.name ?? "",
                  description: vendor.description ?? "",
                  category: vendor.category ?? "",
                  contact: vendor.contact ?? "",
                  email: vendor.email ?? "",
                  website: vendor.website ?? "",
                  phone: vendor.phone ?? "",
                  showPhone: vendor.show_phone ?? false,
                }}
              />
            )}

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

          <p className="mt-4 text-sm uppercase tracking-[0.25em]" style={{ color: accent }}>
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

          {(vendor.email || vendor.website || (vendor.show_phone && vendor.phone)) ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-neutral-400">Contact</p>
              {vendor.email ? (
                <p className="mt-2 text-lg text-neutral-200">{vendor.email}</p>
              ) : null}
              {vendor.show_phone && vendor.phone ? (
                <p className="mt-1 text-lg text-neutral-200">
                  <a href={`tel:${vendor.phone}`} className="hover:text-white">{vendor.phone}</a>
                </p>
              ) : null}
              {vendor.website ? (
                <p className="mt-1 text-lg">
                  <a
                    href={normalizeUrl(vendor.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3AFFD4] hover:underline"
                  >
                    {vendor.website.replace(/^https?:\/\//, "")}
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <section className="mt-10">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.3em]" style={{ color: accent }}>
              Inventory
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Available Products</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.length > 0 ? (
              products.map((product) => (
                <Link
                  key={product.id}
                  href={`/marketplace/${vendor.id}/item/${product.id}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]"
                >
                  <ProductThumb src={product.image_url} alt={product.name || ""} />
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-white">{product.name || "Unnamed Product"}</h3>
                    {product.category && <p className="mt-0.5 truncate font-dm-mono text-[10px] text-neutral-500">{product.category}</p>}
                    <p className="mt-auto pt-2 font-bebas text-xl" style={{ color: accent }}>${Number(product.price ?? 0).toFixed(2)}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-neutral-400">
                No public products yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}