import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

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

export default async function AdminProductsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  const products = (data ?? []) as Product[];

  if (error) {
    return (
      <main className="min-h-screen px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold">Products</h1>
          <p className="mt-4 text-red-300">Error loading products.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-[0.3em] text-green-300">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Products</h1>
        <p className="mt-4 text-neutral-400">Signed in as: {user.email}</p>

        <div className="mt-8 space-y-4">
          {products.length > 0 ? (
            products.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">
                    {product.name || "Unnamed Product"}
                  </h2>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm">
                    {product.status || "draft"}
                  </span>
                </div>

                <p className="mt-2 text-neutral-300">
                  {product.description || "No description"}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    vendor_id: {product.vendor_id ?? "none"}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    {product.category || "uncategorized"}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    price: {product.price ?? 0}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    stock: {product.inventory_count ?? 0}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    public: {product.is_public ? "yes" : "no"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-neutral-400">
              No products yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}