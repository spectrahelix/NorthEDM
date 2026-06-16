import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import type { Metadata } from "next";
import { ForumFilters } from "./components/ForumFilters";

export const metadata: Metadata = {
  title: "Forum",
  description:
    "The NorthEDM community forum — festival lineups, carpool rides, vendor talk, foraging reports, and everything in between.",
  openGraph: {
    title: "NorthEDM Forum",
    description:
      "Festival lineups, carpool rides, vendor talk, foraging reports, and community discussion.",
    url: "https://northedm.com/forum",
  },
};
import { ForumComposer } from "./components/ForumComposer";
import { CategoryModal } from "./components/CategoryModal";
import { HeartButton } from "@/app/components/HeartButton";
import { ReportButton } from "@/app/components/ReportModal";
import { UserPopover } from "@/app/components/UserPopover";
import { RankBadge } from "@/app/components/RankBadge";
import { AvatarBorder } from "@/app/components/AvatarBorder";
import { getMyUserProfile, getUserProfileMap } from "@/utils/supabase/user-profiles";
import { getProfile } from "@/utils/supabase/profile";
import { Suspense } from "react";

type Thread = {
  id: number;
  user_id: string;
  category: string;
  title: string;
  body: string;
  reply_count: number;
  heart_count: number;
  created_at: string;
};

type Category = {
  id: number;
  name: string;
  icon: string;
  description: string;
  is_default: boolean;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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

const CATEGORY_BORDER: Record<string, string> = {
  "Lineups & Artists": "border-l-[#E8FF47]/40",
  "Camping & Gear": "border-l-[#3AFFD4]/40",
  "Carpool & Rides": "border-l-[#FF5C3A]/40",
  "Weather & Trail Conditions": "border-l-sky-300/40",
  "Vendors & Mushrooms": "border-l-purple-300/40",
  "Foraging Reports": "border-l-green-400/40",
  "Trades & Tickets": "border-l-orange-300/40",
  "Wook World": "border-l-pink-300/40",
};

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: categoriesData },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("forum_categories")
      .select("id, name, icon, description, is_default")
      .order("is_default", { ascending: false })
      .order("name"),
  ]);

  const categories = (categoriesData ?? []) as Category[];
  const categoryNames = categories.map((c) => c.name);

  // Get current user profile for auth checks
  const [myUserProfile, legacyProfile] = await Promise.all([
    getMyUserProfile(supabase),
    getProfile(supabase),
  ]);
  const isAdmin =
    myUserProfile?.role === "archon" ||
    myUserProfile?.role === "warden" ||
    legacyProfile?.role === "admin";

  // Fetch thread counts per category
  const { data: allThreads } = await supabase
    .from("threads")
    .select("category");
  const countMap: Record<string, number> = {};
  for (const t of allThreads ?? []) {
    countMap[t.category] = (countMap[t.category] ?? 0) + 1;
  }

  let query = supabase
    .from("threads")
    .select("*")
    .order("created_at", { ascending: false });

  if (category && category !== "All Posts") {
    query = query.eq("category", category);
  }
  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data } = await query.limit(50);
  const threads = (data ?? []) as Thread[];

  const userIds = [...new Set(threads.map((t) => t.user_id))];
  const profileMap = await getUserProfileMap(supabase, userIds);

  // Which threads has the current user hearted?
  let heartedSet = new Set<number>();
  if (user) {
    const { data: hearted } = await supabase
      .from("thread_hearts")
      .select("thread_id")
      .eq("user_id", user.id)
      .in(
        "thread_id",
        threads.map((t) => t.id)
      );
    heartedSet = new Set((hearted ?? []).map((h: { thread_id: number }) => h.thread_id));
  }

  const defaultCategories = categories.filter((c) => c.is_default);
  const communityCategories = categories.filter((c) => !c.is_default);

  return (
    <main className="relative min-h-screen text-neutral-100 spore-bg">
      <div className="relative z-10">
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <p className="mb-2 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#3AFFD4]">
              NorthEDM Community
            </p>
            <h1 className="font-bebas text-6xl tracking-wide">Community Forum</h1>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 py-8 lg:flex lg:gap-8">
          {/* Sidebar */}
          <aside className="mb-8 shrink-0 lg:mb-0 lg:w-56">
            <p className="mb-3 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
              Categories
            </p>

            {/* Mobile: horizontal scroll */}
            <nav className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
              <Link
                href="/forum"
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  !category
                    ? "bg-[#39FF14]/10 text-[#39FF14]"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                All Posts
                <span className="ml-2 font-dm-mono text-[10px] text-neutral-700">
                  {Object.values(countMap).reduce((a, b) => a + b, 0)}
                </span>
              </Link>

              {defaultCategories.map((cat) => {
                const isActive = category === cat.name;
                return (
                  <Link
                    key={cat.id}
                    href={`/forum?category=${encodeURIComponent(cat.name)}`}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                      isActive
                        ? "bg-[#39FF14]/10 text-[#39FF14]"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span>
                      <span className="mr-1.5">{cat.icon}</span>
                      {cat.name}
                    </span>
                    {countMap[cat.name] !== undefined && (
                      <span className="ml-2 font-dm-mono text-[10px] text-neutral-700">
                        {countMap[cat.name]}
                      </span>
                    )}
                  </Link>
                );
              })}

              {communityCategories.length > 0 && (
                <>
                  <p className="mt-3 mb-1 px-3 font-dm-mono text-[9px] uppercase tracking-widest text-neutral-700">
                    Community
                  </p>
                  {communityCategories.map((cat) => {
                    const isActive = category === cat.name;
                    return (
                      <Link
                        key={cat.id}
                        href={`/forum?category=${encodeURIComponent(cat.name)}`}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                          isActive
                            ? "bg-[#39FF14]/10 text-[#39FF14]"
                            : "text-neutral-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span>
                          <span className="mr-1.5">{cat.icon}</span>
                          {cat.name}
                        </span>
                      </Link>
                    );
                  })}
                </>
              )}

              {user && (
                <div className="mt-3">
                  <CategoryModal userId={user.id} />
                </div>
              )}
            </nav>
          </aside>

          {/* Thread list */}
          <div className="min-w-0 flex-1">
            <div className="mb-6 flex items-center gap-3">
              <Suspense
                fallback={
                  <input
                    placeholder="Search threads…"
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
                  />
                }
              >
                <ForumFilters initialQ={q ?? ""} />
              </Suspense>
              <ForumComposer
                user={user}
                categories={categoryNames}
                profileUsername={legacyProfile?.username ?? null}
              />
            </div>

            {category && category !== "All Posts" && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-neutral-400">
                  Showing:{" "}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      CATEGORY_COLORS[category] ?? "bg-white/10 text-neutral-300"
                    }`}
                  >
                    {categories.find((c) => c.name === category)?.icon}{" "}
                    {category}
                  </span>
                </span>
                <Link
                  href="/forum"
                  className="text-xs text-neutral-600 hover:text-neutral-400"
                >
                  clear
                </Link>
              </div>
            )}

            <div className="space-y-3">
              {threads.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center">
                  <p className="mb-2 text-3xl">🌿</p>
                  <p className="text-neutral-500">
                    {q
                      ? `No threads matching "${q}"`
                      : category
                      ? `No threads in ${category} yet — be the first!`
                      : "No threads yet — start the conversation."}
                  </p>
                </div>
              ) : (
                threads.map((thread) => {
                  const authorProfile = profileMap[thread.user_id];
                  const authorName = authorProfile?.display_name || "Unknown";
                  const authorInitials = authorName.slice(0, 2).toUpperCase();
                  const bordered = CATEGORY_BORDER[thread.category];

                  return (
                    <div
                      key={thread.id}
                      className={`group relative rounded-2xl border border-white/10 border-l-4 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.06] ${bordered ?? "border-l-white/10"}`}
                    >
                      {/* Full-card link sits at z-[1], above static content but below interactive elements */}
                      <Link
                        href={`/forum/${thread.id}`}
                        className="absolute inset-0 z-[1] rounded-2xl"
                        aria-label={thread.title}
                      />
                      <div className="flex items-start gap-4">
                        {/* Avatar — z-[2] so it stays above the card link */}
                        <div className="relative z-[2]">
                          {authorProfile ? (
                            <UserPopover profile={authorProfile}>
                              <AvatarBorder border={authorProfile.avatar_border} size={36}>
                                {authorProfile.avatar_url ? (
                                  <img
                                    src={authorProfile.avatar_url}
                                    alt={authorName}
                                    className="rounded-full object-cover"
                                    style={{ width: 36, height: 36 }}
                                  />
                                ) : (
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3AFFD4]/10 font-dm-mono text-xs text-[#3AFFD4]">
                                    {authorInitials}
                                  </div>
                                )}
                              </AvatarBorder>
                            </UserPopover>
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 font-dm-mono text-xs text-neutral-500">
                              {authorInitials}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[thread.category] ?? "bg-white/10 text-neutral-400"}`}>
                              {thread.category}
                            </span>
                            <span className="font-dm-mono text-xs text-neutral-600">
                              {timeAgo(thread.created_at)}
                            </span>
                            {authorProfile && (
                              <RankBadge role={authorProfile.role} name={authorName} />
                            )}
                          </div>
                          <h3 className="mt-1.5 font-semibold leading-snug text-neutral-100 group-hover:text-white">
                            {thread.title}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                            {thread.body}
                          </p>
                          {/* Action row — z-[2] so heart/report buttons are above the card link */}
                          <div className="relative z-[2] mt-3 flex items-center gap-4 font-dm-mono text-xs text-neutral-600">
                            <span className="flex items-center gap-1">
                              <span>💬</span>
                              {thread.reply_count} {thread.reply_count === 1 ? "reply" : "replies"}
                            </span>
                            <HeartButton
                              threadId={thread.id}
                              initialCount={thread.heart_count}
                              initialHearted={heartedSet.has(thread.id)}
                              userId={user?.id ?? null}
                            />
                            <ReportButton
                              reporterId={user?.id ?? null}
                              reportedUserId={thread.user_id}
                              threadId={thread.id}
                            />
                            <span className="ml-auto text-neutral-700 transition group-hover:text-neutral-400">
                              Read →
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
