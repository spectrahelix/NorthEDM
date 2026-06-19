import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const forumAdmin = profile?.role === "archon" || profile?.role === "warden";

  const ADMIN_EMAIL = "cjblue27@gmail.com";
  const isLegacyAdmin = user.email === ADMIN_EMAIL;

  if (!forumAdmin && !isLegacyAdmin) redirect("/");

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-5xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em] text-[#FF5C3A]">
          Admin
        </p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Control Room</h1>
        <p className="mt-2 text-neutral-400">
          Role:{" "}
          <span className="font-dm-mono text-sm text-neutral-300">
            {profile?.role ?? "legacy admin"}
          </span>
        </p>

        <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Insights
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/admin/analytics"
            className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-[#00D4FF]/30 hover:bg-white/[0.04]"
          >
            <div className="mb-3 text-2xl">📈</div>
            <h2 className="font-bebas text-2xl tracking-wide group-hover:text-[#00D4FF]">
              Site Traffic
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Pageviews, unique visitors, daily trend, top pages &amp; referrers
            </p>
          </Link>
        </div>

        {forumAdmin && (
          <>
            <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Community
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/admin/users"
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-[#FF5C3A]/30 hover:bg-white/[0.04]"
              >
                <div className="mb-3 text-2xl">👥</div>
                <h2 className="font-bebas text-2xl tracking-wide group-hover:text-[#E8FF47]">
                  User Management
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  View all users, manage roles and permissions
                </p>
              </Link>

              <Link
                href="/admin/reports"
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-[#FF5C3A]/30 hover:bg-white/[0.04]"
              >
                <div className="mb-3 text-2xl">⚑</div>
                <h2 className="font-bebas text-2xl tracking-wide group-hover:text-[#E8FF47]">
                  Content Reports
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Review flagged content and take moderation action
                </p>
              </Link>
            </div>
          </>
        )}

        {(forumAdmin || isLegacyAdmin) && (
          <>
            <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-orange-500/70">
              FestDash
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/admin/festdash"
                className="group rounded-2xl border border-orange-500/20 bg-orange-950/10 p-6 transition hover:border-orange-500/40 hover:bg-orange-950/20"
              >
                <div className="mb-3 text-2xl">🎪</div>
                <h2 className="font-bebas text-2xl tracking-wide text-white group-hover:text-orange-400">
                  FestDash Control
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Approve vendors, manage orders, view the network
                </p>
              </Link>
            </div>
          </>
        )}

        {isLegacyAdmin && (
          <>
            <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Platform
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Link
                href="/admin/create-user"
                className="rounded-2xl border border-white/10 p-6 transition hover:bg-white/5"
              >
                <h2 className="font-bebas text-xl tracking-wide">Create User</h2>
                <p className="mt-1 text-sm text-neutral-400">Create vendor or admin accounts</p>
              </Link>
              <Link
                href="/admin/bookings"
                className="rounded-2xl border border-white/10 p-6 transition hover:bg-white/5"
              >
                <h2 className="font-bebas text-xl tracking-wide">Bookings</h2>
                <p className="mt-1 text-sm text-neutral-400">View foraging bookings</p>
              </Link>
              <Link
                href="/admin/requests"
                className="rounded-2xl border border-white/10 p-6 transition hover:bg-white/5"
              >
                <h2 className="font-bebas text-xl tracking-wide">Requests</h2>
                <p className="mt-1 text-sm text-neutral-400">Review service requests</p>
              </Link>
              <Link
                href="/admin/vendors"
                className="rounded-2xl border border-white/10 p-6 transition hover:bg-white/5"
              >
                <h2 className="font-bebas text-xl tracking-wide">Vendors</h2>
                <p className="mt-1 text-sm text-neutral-400">Manage vendors</p>
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
