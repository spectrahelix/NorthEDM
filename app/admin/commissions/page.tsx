import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "cjblue27@gmail.com";

type Row = {
  id: string;
  commission_cents: number;
  discount_cents: number;
  created_at: string;
  festdash_promo_codes: { code: string; vendors: { name: string } | null } | null;
};

export default async function CommissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const isAdmin =
    profile?.role === "archon" || profile?.role === "warden" || user.email === ADMIN_EMAIL;
  if (!isAdmin) redirect("/");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const [{ data: allRows }, { data: recent }] = await Promise.all([
    admin.from("festdash_promo_redemptions").select("commission_cents"),
    admin
      .from("festdash_promo_redemptions")
      .select("id, commission_cents, discount_cents, created_at, festdash_promo_codes(code, vendors(name))")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const totalCents = (allRows ?? []).reduce((s, r) => s + (r.commission_cents ?? 0), 0);
  const count = allRows?.length ?? 0;
  const rows = (recent ?? []) as unknown as Row[];

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-4xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em] text-[#FF5C3A]">Admin</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Commissions</h1>
        <Link href="/admin" className="font-dm-mono text-xs text-neutral-500 hover:text-neutral-300">← Control Room</Link>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Total commission earned</p>
            <p className="mt-1 font-bebas text-5xl tracking-wide text-[#39FF14]">${(totalCents / 100).toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Code redemptions</p>
            <p className="mt-1 font-bebas text-5xl tracking-wide">{count.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Recent redemptions</p>
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-600">No commission codes have been redeemed yet.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <span className="font-dm-mono text-neutral-200">{r.festdash_promo_codes?.code ?? "—"}</span>
                    <span className="ml-3 text-neutral-400">{r.festdash_promo_codes?.vendors?.name ?? "Unknown vendor"}</span>
                    <span className="ml-3 font-dm-mono text-[11px] text-neutral-600">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="font-dm-mono text-[#39FF14]">+${(r.commission_cents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-6 font-dm-mono text-[11px] text-neutral-600">
          Commission is collected when a customer redeems a vendor&apos;s code at FestDash checkout —
          the customer&apos;s discount equals NorthEDM&apos;s commission, both absorbed by the vendor.
        </p>
      </div>
    </main>
  );
}
