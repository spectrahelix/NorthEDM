import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getUserProfile } from "@/utils/supabase/user-profiles";
import { RankBadge } from "@/app/components/RankBadge";
import { getRoleColor } from "@/app/components/roleColors";
import { AvatarBorder } from "@/app/components/AvatarBorder";
import { ArtisanWorks } from "@/app/components/ArtisanWorks";
import { ProfileCTAs } from "@/app/components/ProfileCTAs";
import { profileTags, currentShow } from "@/utils/supabase/user-profiles";
import type { ArtisanWork, Social, VendorShow } from "@/utils/supabase/user-profiles";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function memberSince(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "replies" ? "replies" : "threads";

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const profile = await getUserProfile(supabase, id);
  if (!profile) notFound();

  const [
    { data: threadsData, count: threadCount },
    { data: repliesData, count: replyCount },
    { data: groupsData, count: groupCount },
    { data: nameHistoryData },
  ] = await Promise.all([
    supabase
      .from("threads")
      .select("id, title, category, reply_count, heart_count, created_at", { count: "exact" })
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("replies")
      .select("id, body, thread_id, created_at", { count: "exact" })
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id),
    supabase
      .from("display_name_history")
      .select("display_name, changed_at")
      .eq("user_id", id)
      .order("changed_at", { ascending: false })
      .limit(5),
  ]);

  const nameHistory = (nameHistoryData ?? []) as { display_name: string; changed_at: string }[];

  const isArtisan = !!profile.is_artisan;
  const socials = (Array.isArray(profile.socials) ? profile.socials : []) as Social[];
  let works: ArtisanWork[] = [];
  if (isArtisan) {
    const { data: worksData } = await supabase
      .from("artisan_works")
      .select("*")
      .eq("user_id", id)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false });
    works = (worksData ?? []) as ArtisanWork[];
  }

  const isOwn = currentUser?.id === id;

  // Upcoming shows (vendors). Hidden from others if the vendor toggled hide.
  let shows: VendorShow[] = [];
  if (profile.is_vendor && (isOwn || !profile.hide_shows)) {
    const { data: showData } = await supabase
      .from("vendor_shows")
      .select("*")
      .eq("user_id", id)
      .order("start_date", { ascending: true });
    shows = (showData ?? []) as VendorShow[];
  }
  const cur = currentShow(shows);

  // Membership CTA statuses (own profile only).
  type CtaStatus = "approved" | "pending" | "none";
  let ctas: { vendor: CtaStatus; festdash: CtaStatus; promoter: CtaStatus } | null = null;
  if (isOwn) {
    const [vendorApp, fdApp, promoApp] = await Promise.all([
      supabase.from("vendors").select("status").eq("user_id", id).eq("status", "pending").limit(1),
      supabase.from("festdash_vendor_applications").select("status").eq("user_id", id).eq("status", "pending").limit(1),
      supabase.from("festdash_promoter_applications").select("status").eq("user_id", id).eq("status", "pending").limit(1),
    ]);
    ctas = {
      vendor: profile.is_vendor ? "approved" : (vendorApp.data?.length ? "pending" : "none"),
      festdash: profile.is_festdash_vendor ? "approved" : (fdApp.data?.length ? "pending" : "none"),
      promoter: profile.is_promoter ? "approved" : (promoApp.data?.length ? "pending" : "none"),
    };
  }

  const roleColor = getRoleColor(profile.role);
  const initials = profile.display_name.slice(0, 2).toUpperCase() || "??";

  const bannerGradient = `linear-gradient(135deg, ${roleColor}22 0%, transparent 60%)`;

  const CATEGORY_COLORS: Record<string, string> = {
    "Lineups & Artists": "text-[#E8FF47] bg-[#E8FF47]/10",
    "Camping & Gear": "text-[#3AFFD4] bg-[#3AFFD4]/10",
    "Carpool & Rides": "text-[#FF5C3A] bg-[#FF5C3A]/10",
    "Weather & Trail Conditions": "text-sky-300 bg-sky-300/10",
    "Vendors & Mushrooms": "text-purple-300 bg-purple-300/10",
    "Foraging Reports": "text-green-400 bg-green-400/10",
    "Trades & Tickets": "text-orange-300 bg-orange-300/10",
    "Wook World": "text-pink-300 bg-pink-300/10",
  };

  return (
    <main className="min-h-screen text-neutral-100">
      {/* Banner */}
      <div
        className="h-28 border-b border-white/5"
        style={{ background: bannerGradient }}
      />

      <div className="mx-auto max-w-3xl px-6">
        {/* Avatar + header */}
        <div className="-mt-14 mb-6 flex items-end justify-between">
          <AvatarBorder border={profile.avatar_border} size={88}>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="h-22 w-22 rounded-full object-cover"
                style={{ width: 88, height: 88 }}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded-full bg-neutral-800 font-bebas text-3xl tracking-wide"
                style={{
                  width: 88,
                  height: 88,
                  color: roleColor,
                  border: `2px solid ${roleColor}30`,
                }}
              >
                {initials}
              </div>
            )}
          </AvatarBorder>

          <div className="flex gap-2 pb-2">
            {isOwn ? (
              <Link
                href="/profile/edit"
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5 hover:text-white"
              >
                Edit Profile
              </Link>
            ) : currentUser ? (
              <Link
                href={`/messages?to=${id}`}
                className="rounded-xl bg-[#3AFFD4]/10 px-4 py-2 text-sm text-[#3AFFD4] transition hover:bg-[#3AFFD4]/20"
              >
                Send Message
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-[#3AFFD4]/10 px-4 py-2 text-sm text-[#3AFFD4] transition hover:bg-[#3AFFD4]/20"
              >
                Send Message
              </Link>
            )}
          </div>
        </div>

        {/* Name + bio */}
        <div className="mb-6">
          <RankBadge role={profile.role} name={profile.display_name} size="lg" tags={profileTags(profile)} />
          {isArtisan && profile.stage_name && (
            <p className="mt-1 font-bebas text-2xl tracking-wide" style={{ color: "#FFC93C" }}>
              {profile.stage_name}
              {profile.artisan_craft && (
                <span className="ml-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  {profile.artisan_craft}
                </span>
              )}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            {profile.home_city && (
              <p className="font-dm-mono text-sm text-neutral-500">📍 {profile.home_city}</p>
            )}
            {profile.pronouns && (
              <p className="font-dm-mono text-sm text-neutral-600">{profile.pronouns}</p>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-dm-mono text-sm text-[#3AFFD4] hover:underline"
              >
                🌐 Website
              </a>
            )}
          </div>
          {socials.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {socials.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-dm-mono text-xs text-neutral-300 transition hover:bg-white/5"
                >
                  {s.label || "Link"}
                </a>
              ))}
            </div>
          )}
          {profile.bio && (
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-300">
              {profile.bio}
            </p>
          )}
          {nameHistory.length > 0 && (
            <div className="mt-3">
              <p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-700">
                Previously known as
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {nameHistory.map((h) => (
                  <span
                    key={h.changed_at}
                    className="rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-0.5 font-dm-mono text-xs text-neutral-600"
                  >
                    {h.display_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Membership CTAs (own profile) */}
        {ctas && <ProfileCTAs vendor={ctas.vendor} festdash={ctas.festdash} promoter={ctas.promoter} />}

        {/* Dashboard links (own profile, once approved) */}
        {isOwn && (profile.is_vendor || profile.is_festdash_vendor || profile.is_promoter) && (
          <div className="mb-8 flex flex-wrap gap-3">
            {profile.is_vendor && (
              <Link href="/vendor/dashboard" className="rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:opacity-90"
                style={{ borderColor: "#00D4FF55", background: "#00D4FF12", color: "#00D4FF" }}>
                ▣ Vendor Dashboard →
              </Link>
            )}
            {profile.is_festdash_vendor && (
              <Link href="/festdash/vendor-dashboard" className="rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:opacity-90"
                style={{ borderColor: "#FB923C55", background: "#FB923C12", color: "#FB923C" }}>
                ◆ FestDash Dashboard →
              </Link>
            )}
            {profile.is_promoter && (
              <Link href="/festdash/promoter-dashboard" className="rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:opacity-90"
                style={{ borderColor: "#E8FF4755", background: "#E8FF4712", color: "#E8FF47" }}>
                ✦ Promoter Dashboard →
              </Link>
            )}
          </div>
        )}

        {/* Upcoming shows (vendors) */}
        {shows.length > 0 && (
          <div className="mb-8 rounded-2xl border p-5" style={{ borderColor: "#00D4FF33", background: "#00D4FF08" }}>
            <div className="flex items-center gap-2">
              <p className="font-dm-mono text-xs uppercase tracking-[0.3em]" style={{ color: "#00D4FF" }}>▣ Upcoming Shows</p>
              {cur?.live && (
                <span className="rounded-full px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest" style={{ color: "#39FF14", background: "#39FF1414" }}>
                  🟢 Live now
                </span>
              )}
            </div>
            {cur && (
              <p className="mt-2 text-sm text-neutral-200">
                {cur.live ? "Currently at" : "Next"}: <span className="font-semibold" style={{ color: "#00D4FF" }}>{cur.show.festival_name}</span>
                {cur.show.location ? <span className="text-neutral-400"> — {cur.show.location}</span> : null}
                {cur.show.start_date ? <span className="ml-2 font-dm-mono text-xs text-neutral-500">{cur.show.start_date}{cur.show.end_date && cur.show.end_date !== cur.show.start_date ? `→${cur.show.end_date}` : ""}</span> : null}
              </p>
            )}
            {shows.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {shows.map((s) => (
                  <span key={s.id} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-dm-mono text-xs text-neutral-400">
                    {s.festival_name}{s.start_date ? ` · ${s.start_date}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Artisan showcase */}
        {isArtisan && (profile.artisan_statement || works.length > 0) && (
          <div className="mb-8 rounded-2xl border p-6" style={{ borderColor: "#FFC93C33", background: "#FFC93C08" }}>
            <p className="font-dm-mono text-xs uppercase tracking-[0.3em]" style={{ color: "#FFC93C" }}>
              ◈ Artisan Showcase
            </p>
            {profile.artisan_statement && (
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
                {profile.artisan_statement}
              </p>
            )}
            {works.length > 0 && (
              <div className="mt-5">
                <ArtisanWorks works={works} />
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="mb-8 grid grid-cols-4 gap-3">
          {[
            { label: "Threads", value: threadCount ?? 0 },
            { label: "Replies", value: replyCount ?? 0 },
            { label: "Groups", value: groupCount ?? 0 },
            { label: "Member since", value: memberSince(profile.created_at) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center"
            >
              <p className="font-bebas text-2xl tracking-wide text-neutral-100">
                {stat.value}
              </p>
              <p className="mt-0.5 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-white/10">
          {(["threads", "replies"] as const).map((t) => (
            <Link
              key={t}
              href={`/profile/${id}?tab=${t}`}
              className={`px-4 py-2.5 font-dm-mono text-xs uppercase tracking-widest transition ${
                activeTab === t
                  ? "border-b-2 text-[#39FF14]"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
              style={activeTab === t ? { borderColor: "#39FF14" } : {}}
            >
              {t === "threads" ? "Threads" : "Replies"}
            </Link>
          ))}
        </div>

        {/* Content */}
        <div className="mb-10 space-y-3">
          {activeTab === "threads" ? (
            (threadsData ?? []).length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-12 text-center">
                <p className="text-2xl mb-2">🌿</p>
                <p className="text-sm text-neutral-500">No threads started yet</p>
              </div>
            ) : (
              (threadsData ?? []).map((thread) => (
                <Link
                  key={thread.id}
                  href={`/forum/${thread.id}`}
                  className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        CATEGORY_COLORS[thread.category] ?? "bg-white/10 text-neutral-400"
                      }`}
                    >
                      {thread.category}
                    </span>
                    <span className="font-dm-mono text-xs text-neutral-600">
                      {timeAgo(thread.created_at)}
                    </span>
                  </div>
                  <h3 className="mt-1.5 font-semibold text-neutral-100">{thread.title}</h3>
                  <div className="mt-2 flex items-center gap-4 font-dm-mono text-xs text-neutral-600">
                    <span>{thread.reply_count} replies</span>
                    <span>♥ {thread.heart_count}</span>
                  </div>
                </Link>
              ))
            )
          ) : (
            (repliesData ?? []).length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-12 text-center">
                <p className="text-2xl mb-2">💬</p>
                <p className="text-sm text-neutral-500">No replies posted yet</p>
              </div>
            ) : (
              (repliesData ?? []).map((reply) => (
                <Link
                  key={reply.id}
                  href={`/forum/${reply.thread_id}`}
                  className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]"
                >
                  <p className="line-clamp-3 text-sm text-neutral-300">{reply.body}</p>
                  <p className="mt-2 font-dm-mono text-xs text-neutral-600">
                    {timeAgo(reply.created_at)} · in thread #{reply.thread_id}
                  </p>
                </Link>
              ))
            )
          )}
        </div>
      </div>
    </main>
  );
}
