import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { currentShow, type VendorShow } from "@/utils/supabase/user-profiles";

export const metadata = {
  title: "FestDash / FestEats — Go-Anywhere Local Delivery Network",
  description:
    "FestDash (also FestEats) is a go-anywhere local delivery network. No street address needed — order food, crafts, or services and a runner brings it to your campsite, your land, or your village, guided by landmark directions and a live GPS ping. Anywhere on Earth.",
};

export default async function FestDashPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if this user is already a FestDash vendor
  let isFestDashVendor = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("vendor_id")
      .eq("id", user.id)
      .single();
    if (profile?.vendor_id) {
      const { data: fd } = await supabase
        .from("festdash_vendors")
        .select("id")
        .eq("vendor_id", profile.vendor_id)
        .single();
      isFestDashVendor = !!fd;
    }
  }

  // Live network stats — service role so counts span all rows (past RLS)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const [vendorsRes, runnersRes, deliveriesRes] = await Promise.all([
    admin.from("festdash_vendors").select("*", { count: "exact", head: true }),
    admin.from("festdash_drivers").select("*", { count: "exact", head: true }).eq("is_active", true),
    admin.from("festdash_orders").select("*", { count: "exact", head: true }).eq("status", "delivered"),
  ]);
  const vendorCount = vendorsRes.count ?? 0;
  const runnerCount = runnersRes.count ?? 0;
  const deliveredCount = deliveriesRes.count ?? 0;

  // Active FestDash vendors + their current/next show (for the "who's on FestDash" list).
  const { data: fdVendors } = await admin
    .from("festdash_vendors")
    .select("vendor_id, user_id")
    .eq("is_active", true);
  const vIds = (fdVendors ?? []).map((v) => v.vendor_id).filter(Boolean);
  const uIds = (fdVendors ?? []).map((v) => v.user_id).filter(Boolean);
  const [vRows, showRows, profRows] = await Promise.all([
    vIds.length ? admin.from("vendors").select("id, name").in("id", vIds) : Promise.resolve({ data: [] as { id: number; name: string | null }[] }),
    uIds.length ? admin.from("vendor_shows").select("*").in("user_id", uIds) : Promise.resolve({ data: [] as VendorShow[] }),
    uIds.length ? admin.from("user_profiles").select("id, hide_shows").in("id", uIds) : Promise.resolve({ data: [] as { id: string; hide_shows: boolean }[] }),
  ]);
  const nameById = new Map((vRows.data ?? []).map((v) => [v.id, v.name]));
  const hideById = new Map((profRows.data ?? []).map((p) => [p.id, p.hide_shows]));
  const showsByUser = new Map<string, VendorShow[]>();
  for (const s of (showRows.data ?? []) as VendorShow[]) {
    if (!showsByUser.has(s.user_id)) showsByUser.set(s.user_id, []);
    showsByUser.get(s.user_id)!.push(s);
  }
  const activeVendors = (fdVendors ?? []).map((v) => {
    const shows = hideById.get(v.user_id) ? [] : (showsByUser.get(v.user_id) ?? []);
    return { vendorId: v.vendor_id as number, name: (nameById.get(v.vendor_id) as string) || "Vendor", cur: currentShow(shows) };
  });

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-orange-950/40 to-neutral-950 px-6 py-24 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-orange-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
            Now Live · Built for Anywhere on Earth
          </div>
          <h1 className="font-bebas text-6xl tracking-wide text-white md:text-8xl">
            Fest<span className="text-orange-400">Dash</span>
          </h1>
          <p className="mt-3 font-dm-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
            also known as <span className="text-orange-400">Fest</span><span className="text-white">Eats</span>
          </p>
          <p className="mt-4 text-xl text-neutral-300">
            Local delivery for anywhere on Earth.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-neutral-500">
            Backwoods campground or a village with no street signs — if someone can
            point to it, FestDash delivers to it. Food, crafts, services… anything,
            anywhere.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 font-dm-mono text-[11px] uppercase tracking-widest">
            {["Food", "Crafts", "Services", "Anywhere on Earth"].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-orange-500/30 bg-orange-500/5 px-3 py-1 text-orange-300"
              >
                {chip}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/festdash/order"
              className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-400"
            >
              Order Now
            </Link>
            {user && (
              <Link
                href="/festdash/orders"
                className="rounded-2xl border border-white/15 px-6 py-3 font-semibold text-neutral-300 transition hover:bg-white/5"
              >
                My Orders
              </Link>
            )}
            {isFestDashVendor ? (
              <Link
                href="/festdash/vendor-dashboard"
                className="rounded-2xl border border-orange-500/40 px-6 py-3 font-semibold text-orange-400 transition hover:bg-orange-500/10"
              >
                Vendor Dashboard
              </Link>
            ) : user ? (
              <Link
                href="/festdash/vendor-signup"
                className="rounded-2xl border border-white/10 px-6 py-3 font-semibold text-neutral-500 transition hover:bg-white/5 text-sm"
              >
                Join as Vendor
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Built for anywhere — the connectivity thesis */}
      <section className="border-b border-white/10 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-orange-400">
              Connectivity is the whole idea
            </p>
            <h2 className="mt-3 font-bebas text-5xl tracking-wide text-white">
              No street address? No problem.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-400">
              Every delivery app on Earth stops where the mailing addresses stop.
              FestDash doesn&apos;t. It finds people by <span className="text-neutral-200">landmark</span>,
              a <span className="text-neutral-200">site photo</span>, and a
              <span className="text-neutral-200"> live GPS ping</span> — then confirms
              handoff with a 4-digit code. That means it works where nothing else
              reaches.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: "🌍",
                title: "Anywhere",
                desc: "A festival campground, a backwoods holler, a village square, a block party. If you can describe it, a runner can reach it — anywhere in the world.",
              },
              {
                icon: "📦",
                title: "Anything",
                desc: "Food, crafts, goods, services. Any vendor, any order, brought straight to the customer. FestEats for the food; FestDash for everything else.",
              },
              {
                icon: "🧭",
                title: "No infrastructure needed",
                desc: "No addresses, no street signs, no problem. Landmark directions, a photo, a live location ping, and a handoff code do all the work.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-orange-500/15 bg-orange-950/10 p-6 text-center"
              >
                <div className="mb-3 text-4xl">{c.icon}</div>
                <h3 className="mb-2 font-bebas text-2xl tracking-wide text-white">{c.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-400">{c.desc}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center font-dm-mono text-sm text-neutral-500">
            From a muddy campground in the Poconos to a mountain village with no
            postal code — <span className="text-orange-300">if it&apos;s local, it&apos;s deliverable.</span>
          </p>
        </div>
      </section>

      {/* How it works — customers */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="mb-2 text-center font-bebas text-4xl tracking-wide text-white">
          How It Works
        </h2>
        <p className="mb-12 text-center text-neutral-500">For customers — at a festival, a campground, or your hometown</p>
        <div className="grid gap-6 md:grid-cols-4">
          {[
            {
              step: "01",
              icon: "🎪",
              title: "Pick your place",
              desc: "A festival, a campground, or your own town — choose where you are from the FestDash network.",
            },
            {
              step: "02",
              icon: "📍",
              title: "Share your spot",
              desc: "Drop a landmark, snap a photo, and share a live location ping — no street address required.",
            },
            {
              step: "03",
              icon: "🛒",
              title: "Place your order",
              desc: "Browse vendor menus, add items, set a delivery window, and prepay securely.",
            },
            {
              step: "04",
              icon: "🏕️",
              title: "Receive delivery",
              desc: "A runner brings it straight to you during your window — confirmed with your 4-digit code.",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="rounded-2xl border border-white/8 bg-white/3 p-6 text-center"
            >
              <div className="mb-3 text-3xl">{s.icon}</div>
              <div className="mb-1 font-dm-mono text-xs text-orange-400">{s.step}</div>
              <h3 className="mb-2 font-semibold text-white">{s.title}</h3>
              <p className="text-sm text-neutral-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Active FestDash vendors */}
      {activeVendors.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center font-bebas text-4xl tracking-wide">On FestDash Now</h2>
          <p className="mt-2 text-center text-neutral-400">Vendors delivering through FestDash — and where to find them.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeVendors.map((v) => (
              <Link key={v.vendorId} href={`/marketplace/${v.vendorId}`}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#FB923C]/40 hover:bg-white/[0.05]">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-bebas text-2xl tracking-wide group-hover:text-[#FB923C]">{v.name}</h3>
                  {v.cur?.live && (
                    <span className="shrink-0 rounded-full px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest" style={{ color: "#39FF14", background: "#39FF1414" }}>🟢 Live</span>
                  )}
                </div>
                {v.cur ? (
                  <p className="mt-1.5 text-sm text-neutral-400">
                    {v.cur.live ? "At" : "Next"}: <span className="text-neutral-200">{v.cur.show.festival_name}</span>
                    {v.cur.show.location ? ` — ${v.cur.show.location}` : ""}
                  </p>
                ) : (
                  <p className="mt-1.5 font-dm-mono text-xs text-neutral-600">Delivering on FestDash</p>
                )}
                <p className="mt-3 font-dm-mono text-[11px] uppercase tracking-widest text-[#FB923C]">View market →</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Vendor CTA */}
      <section className="border-y border-white/10 bg-orange-950/20 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center gap-10 md:flex-row md:items-start">
            <div className="flex-1">
              <div className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-orange-400">
                For Vendors
              </div>
              <h2 className="mb-4 font-bebas text-4xl tracking-wide text-white">
                Sell anything, deliver anywhere
              </h2>
              <p className="mb-4 text-neutral-400">
                Food, crafts, goods, services — whatever you sell, FestDash adds
                delivery on top of your existing setup. When an order comes in, it
                pops up right on your tablet — accept or decline in one tap. Your
                assigned runner handles the rest, from a festival field to your own
                main street.
              </p>
              <ul className="space-y-2 text-sm text-neutral-400">
                {[
                  "Works alongside any existing POS — no new hardware",
                  "Orders appear live on your tablet as they come in",
                  "One-tap accept / decline per order",
                  "Your runner is pre-assigned — you don't manage logistics",
                  "Take FestDash to every event you attend",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-orange-400">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Link
                  href="/festdash/vendor-signup"
                  className="inline-flex rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-400"
                >
                  Join the FestDash Network
                </Link>
                <Link
                  href="/festdash/promoter-signup"
                  className="inline-flex rounded-2xl border border-orange-500/40 px-6 py-3 font-semibold text-orange-300 transition hover:bg-orange-500/10"
                >
                  Become a Promoter →
                </Link>
                <Link
                  href="/festdash/promoter-dashboard"
                  className="inline-flex items-center font-dm-mono text-xs text-neutral-500 transition hover:text-neutral-300"
                >
                  Promoter dashboard →
                </Link>
              </div>
            </div>
            {/* Tablet mockup */}
            <div className="w-full max-w-xs shrink-0">
              <div className="rounded-3xl border-4 border-neutral-700 bg-neutral-900 p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-dm-mono text-xs text-neutral-500">
                    FestDash Orders
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 font-dm-mono text-[10px] text-green-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                    Live
                  </span>
                </div>
                <div className="space-y-3">
                  {[
                    { name: "Alex M.", zone: "Camp B · Site 14", items: "2× Everything Balm", time: "4:00–4:30 PM", status: "new" },
                    { name: "Jordan K.", zone: "Camp A · Site 7", items: "1× Mushroom Tea", time: "5:00–5:30 PM", status: "accepted" },
                  ].map((order) => (
                    <div
                      key={order.name}
                      className="rounded-xl border border-white/8 bg-white/5 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">{order.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] ${
                            order.status === "new"
                              ? "bg-orange-500/20 text-orange-400"
                              : "bg-green-500/20 text-green-400"
                          }`}
                        >
                          {order.status === "new" ? "New Order" : "Accepted"}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">{order.zone}</p>
                      <p className="text-xs text-neutral-300">{order.items}</p>
                      <p className="text-xs text-neutral-500">Window: {order.time}</p>
                      {order.status === "new" && (
                        <div className="mt-2 flex gap-2">
                          <div className="flex-1 rounded-lg bg-orange-500 py-1.5 text-xs font-semibold text-white text-center opacity-50 cursor-not-allowed">
                            Accept
                          </div>
                          <div className="flex-1 rounded-lg border border-white/10 py-1.5 text-xs text-neutral-400 text-center opacity-50 cursor-not-allowed">
                            Decline
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live network stats */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="mb-10 font-bebas text-4xl tracking-wide text-white">
          The FestDash Network
        </h2>
        <div className="grid grid-cols-3 gap-4 sm:gap-6">
          {[
            { stat: vendorCount, label: "Vendors Enlisted" },
            { stat: runnerCount, label: "Runners Enlisted" },
            { stat: deliveredCount, label: "Deliveries Made" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/8 bg-white/3 p-6">
              <div className="font-bebas text-4xl text-orange-400 sm:text-5xl">{s.stat}</div>
              <div className="mt-1 text-xs text-neutral-500 sm:text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
