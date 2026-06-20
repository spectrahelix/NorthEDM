import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "cjblue27@gmail.com";
const CHART_DAYS = 14;

type Totals = {
  all_views: number; all_visitors: number;
  today_views: number; today_visitors: number;
  d7_views: number; d7_visitors: number;
  d30_views: number; d30_visitors: number;
};
type DailyRow = { day: string; views: number; visitors: number };
type PageRow = { path: string; views: number };
type RefRow = { referrer: string; views: number };
type Audience = { member_views: number; guest_views: number; members: number };
type MemberRow = { name: string; views: number };

function StatCard({ label, views, visitors, accent }: {
  label: string; views: number; visitors: number; accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">{label}</p>
      <p className="mt-1 font-bebas text-4xl tracking-wide" style={{ color: accent }}>
        {views.toLocaleString()}
      </p>
      <p className="mt-0.5 text-xs text-neutral-500">
        {visitors.toLocaleString()} unique visitor{visitors === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export default async function AnalyticsPage() {
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await admin.rpc("analytics_overview", { p_days: CHART_DAYS });
  const totals: Totals = data?.totals ?? {
    all_views: 0, all_visitors: 0, today_views: 0, today_visitors: 0,
    d7_views: 0, d7_visitors: 0, d30_views: 0, d30_visitors: 0,
  };
  const daily: DailyRow[] = data?.daily ?? [];
  const topPages: PageRow[] = data?.top_pages ?? [];
  const topReferrers: RefRow[] = data?.top_referrers ?? [];
  const audience: Audience = data?.audience ?? { member_views: 0, guest_views: 0, members: 0 };
  const topMembers: MemberRow[] = data?.top_members ?? [];

  // Fill the chart window so empty days still show.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const series: DailyRow[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() - i);
    const key = dt.toISOString().slice(0, 10);
    series.push(byDay.get(key) ?? { day: key, views: 0, visitors: 0 });
  }
  const maxViews = Math.max(1, ...series.map((d) => d.views));

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-5xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em] text-[#FF5C3A]">Admin</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Site Traffic</h1>
        <Link href="/admin" className="font-dm-mono text-xs text-neutral-500 hover:text-neutral-300">
          ← Control Room
        </Link>

        {/* Stat cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Today" views={totals.today_views} visitors={totals.today_visitors} accent="#39FF14" />
          <StatCard label="Last 7 days" views={totals.d7_views} visitors={totals.d7_visitors} accent="#00D4FF" />
          <StatCard label="Last 30 days" views={totals.d30_views} visitors={totals.d30_visitors} accent="#CC00FF" />
          <StatCard label="All time" views={totals.all_views} visitors={totals.all_visitors} accent="#E8FF47" />
        </div>

        {/* Daily trend */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <p className="mb-5 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
            Pageviews — last {CHART_DAYS} days
          </p>
          <div className="flex h-44 items-end gap-1.5">
            {series.map((d) => (
              <div key={d.day} className="group flex flex-1 flex-col items-center justify-end">
                <div
                  className="w-full rounded-t bg-[#00D4FF]/70 transition group-hover:bg-[#00D4FF]"
                  style={{ height: `${Math.round((d.views / maxViews) * 100)}%`, minHeight: d.views > 0 ? 2 : 0 }}
                  title={`${d.day}: ${d.views} views, ${d.visitors} visitors`}
                />
                <span className="mt-2 font-dm-mono text-[9px] text-neutral-600">
                  {d.day.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top pages + referrers */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Top pages (30d)
            </p>
            {topPages.length === 0 ? (
              <p className="text-sm text-neutral-600">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {topPages.map((p) => (
                  <div key={p.path} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-neutral-300">{p.path}</span>
                    <span className="shrink-0 font-dm-mono text-neutral-500">{p.views.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Top referrers (30d)
            </p>
            {topReferrers.length === 0 ? (
              <p className="text-sm text-neutral-600">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {topReferrers.map((r) => (
                  <div key={r.referrer} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-neutral-300">{r.referrer}</span>
                    <span className="shrink-0 font-dm-mono text-neutral-500">{r.views.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Audience: members vs guests + most active members */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Audience (30d)
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Signed-in members</span>
                <span className="font-dm-mono text-neutral-400">
                  {audience.member_views.toLocaleString()} views · {audience.members.toLocaleString()} {audience.members === 1 ? "person" : "people"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Guests (not signed in)</span>
                <span className="font-dm-mono text-neutral-400">{audience.guest_views.toLocaleString()} views</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Most active members (30d)
            </p>
            {topMembers.length === 0 ? (
              <p className="text-sm text-neutral-600">No signed-in member activity yet.</p>
            ) : (
              <div className="space-y-2">
                {topMembers.map((m, i) => (
                  <div key={`${m.name}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-neutral-300">{m.name}</span>
                    <span className="shrink-0 font-dm-mono text-neutral-500">{m.views.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="mt-8 font-dm-mono text-[11px] text-neutral-600">
          First-party counts — <span className="text-neutral-400">your own admin visits are excluded</span>,
          common bots filtered. Vercel Web Analytics also runs alongside for cross-checking in the Vercel dashboard.
        </p>
      </div>
    </main>
  );
}
