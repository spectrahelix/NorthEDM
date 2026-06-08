import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { ForumFilters } from "./components/ForumFilters";
import { ForumComposer } from "./components/ForumComposer";
import { Suspense } from "react";

const CATEGORIES = [
  "All Posts",
  "Lineups",
  "Camping",
  "Carpool",
  "Weather/Environment",
  "Vendors",
  "Trades & Tickets",
];

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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function initials(userId: string) {
  return userId.slice(0, 2).toUpperCase();
}

const CATEGORY_COLORS: Record<string, string> = {
  Lineups: "text-[#E8FF47] bg-[#E8FF47]/10",
  Camping: "text-[#3AFFD4] bg-[#3AFFD4]/10",
  Carpool: "text-[#FF5C3A] bg-[#FF5C3A]/10",
  "Weather/Environment": "text-sky-300 bg-sky-300/10",
  Vendors: "text-purple-300 bg-purple-300/10",
  "Trades & Tickets": "text-orange-300 bg-orange-300/10",
};

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { data } = await query;
  const threads = (data ?? []) as Thread[];

  const postCategories = CATEGORIES.filter((c) => c !== "All Posts");

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="mb-2 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#3AFFD4]">
            CrowdWave
          </p>
          <h1 className="font-bebas text-6xl tracking-wide">
            Community Forum
          </h1>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-10 lg:flex lg:gap-8">
        {/* Sidebar */}
        <aside className="mb-8 lg:mb-0 lg:w-44 lg:shrink-0">
          <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
            Categories
          </p>
          <nav className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {CATEGORIES.map((cat) => {
              const isActive =
                (cat === "All Posts" && !category) || category === cat;
              return (
                <Link
                  key={cat}
                  href={
                    cat === "All Posts"
                      ? "/crowdwave/forum"
                      : `/crowdwave/forum?category=${encodeURIComponent(cat)}`
                  }
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-[#E8FF47]/10 text-[#E8FF47]"
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {cat}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Thread list */}
        <div className="flex-1 min-w-0">
          <div className="mb-6 flex items-center gap-3">
            <Suspense fallback={
              <input
                placeholder="Search threads…"
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
              />
            }>
              <ForumFilters initialQ={q ?? ""} />
            </Suspense>
            <ForumComposer user={user} categories={postCategories} />
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
                  {category}
                </span>
              </span>
              <Link
                href="/crowdwave/forum"
                className="text-xs text-neutral-600 hover:text-neutral-400"
              >
                clear
              </Link>
            </div>
          )}

          <div className="space-y-3">
            {threads.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center">
                <p className="text-neutral-500">
                  {q
                    ? `No threads matching "${q}"`
                    : "No threads yet — start the conversation."}
                </p>
              </div>
            ) : (
              threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/crowdwave/forum/${thread.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.05]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3AFFD4]/10 font-dm-mono text-xs text-[#3AFFD4]">
                      {initials(thread.user_id)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            CATEGORY_COLORS[thread.category] ??
                            "bg-white/10 text-neutral-400"
                          }`}
                        >
                          {thread.category}
                        </span>
                        <span className="font-dm-mono text-xs text-neutral-600">
                          {timeAgo(thread.created_at)}
                        </span>
                      </div>
                      <h3 className="mt-1.5 font-semibold leading-snug text-neutral-100">
                        {thread.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-400">
                        {thread.body}
                      </p>
                      <div className="mt-3 flex items-center gap-4 font-dm-mono text-xs text-neutral-600">
                        <span>{thread.reply_count} replies</span>
                        <span>♥ {thread.heart_count}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
