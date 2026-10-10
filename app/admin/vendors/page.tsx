import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import VendorDashboard from "./VendorDashboard";

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
  wants_public: boolean | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string | null;
  user_id: string | null;
  business_email: string | null;
  linked_email: string | null;
  is_founder: boolean | null;
  status: string | null;
};

export default async function AdminVendorsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin =
    profile?.role === "archon" ||
    profile?.role === "warden" ||
    user.email === ADMIN_EMAIL;

  if (!isAdmin) redirect("/");

  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("created_at", { ascending: false });

  // Who each vendor is actually linked to. Account emails live in auth.users,
  // which only the service role can read — and showing "linked" without saying
  // to WHOM is how a vendor ends up run by the wrong person unnoticed.
  const raw = (data ?? []) as Vendor[];
  const linkedIds = [...new Set(raw.map((v) => v.user_id).filter(Boolean))] as string[];
  const emailById = new Map<string, string | null>();
  if (linkedIds.length) {
    const svc = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const found = await Promise.all(
      linkedIds.map(async (id) => {
        const { data: u } = await svc.auth.admin.getUserById(id);
        return [id, u.user?.email ?? null] as const;
      })
    );
    for (const [id, email] of found) emailById.set(id, email);
  }
  const vendors = raw.map((v) => ({
    ...v,
    linked_email: v.user_id ? emailById.get(v.user_id) ?? null : null,
  }));

  if (error) {
    console.error(error);
    return (
      <main className="min-h-screen px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold">Vendor Applications</h1>
          <p className="mt-4 text-red-300">Error loading vendors.</p>
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
        <h1 className="mb-3 mt-3 text-4xl font-semibold">Vendor Applications</h1>
        <p className="mb-8 text-neutral-400">Signed in as: {user.email}</p>

        <VendorDashboard vendors={vendors} />
      </div>
    </main>
  );
}
