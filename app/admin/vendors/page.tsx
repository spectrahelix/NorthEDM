import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import VendorActionButtons from "../../components/VendorActionButtons";

const ADMIN_EMAIL = "cjblue27@gmail.com";

type Vendor = {
  id: number;
  name: string | null;
  email: string | null;
  category: string | null;
  description: string | null;
  capacity: string | null;
  vendor_type: string | null;
  is_public: boolean | null;
  is_founder: boolean | null;
  status: string | null;
};

export default async function AdminVendorsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || user.email !== ADMIN_EMAIL) {
    redirect("/");
  }

  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("created_at", { ascending: false });

  const vendors = (data ?? []) as Vendor[];

  if (error) {
    console.error(error);
    return (
      <main className="min-h-screen bg-neutral-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold">Vendor Applications</h1>
          <p className="mt-4 text-red-300">Error loading vendors.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-[0.3em] text-green-300">
          Admin
        </p>
        <h1 className="mb-3 mt-3 text-4xl font-semibold">Vendor Applications</h1>
        <p className="mb-8 text-neutral-400">Signed in as: {user.email}</p>

        <div className="space-y-4">
          {vendors.length > 0 ? (
            vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    {vendor.name || "Unnamed Vendor"}
                  </h2>

                  <span
                    className={`rounded-full px-3 py-1 text-sm ${
                      vendor.status === "approved"
                        ? "bg-green-500/20 text-green-300"
                        : vendor.status === "rejected"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-yellow-500/20 text-yellow-300"
                    }`}
                  >
                    {vendor.status || "pending"}
                  </span>
                </div>

                <p className="text-sm text-neutral-400">
                  {vendor.email || "No email"}
                </p>

                <p className="mt-2 text-neutral-300">
                  {vendor.description || "No description"}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    {vendor.category || "uncategorized"}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    {vendor.vendor_type || "unknown"}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    capacity: {vendor.capacity || "unknown"}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    public: {vendor.is_public ? "yes" : "no"}
                  </span>
                  {vendor.is_founder ? (
                    <span className="rounded-full bg-purple-500/20 px-3 py-1 text-purple-300">
                      founder
                    </span>
                  ) : null}
                </div>

                <VendorActionButtons
                  id={vendor.id}
                  currentType={vendor.vendor_type || "listed"}
                  currentPublic={vendor.is_public ?? false}
                />
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-neutral-400">
              No vendors yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
