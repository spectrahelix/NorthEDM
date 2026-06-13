import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ReplyComposer } from "./components/ReplyComposer";

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

type Reply = {
  id: number;
  thread_id: number;
  user_id: string;
  body: string;
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

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: threadData, error: threadError },
    { data: repliesData },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase.from("threads").select("*").eq("id", id).single(),
    supabase
      .from("replies")
      .select("*")
      .eq("thread_id", id)
      .order("created_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  if (threadError || !threadData) notFound();

  const thread = threadData as Thread;
  const replies = (repliesData ?? []) as Reply[];

  return (
    <main className="min-h-screen text-neutral-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/crowdwave/forum"
          className="mb-8 inline-flex items-center gap-1.5 font-dm-mono text-xs uppercase tracking-widest text-neutral-500 transition hover:text-neutral-300"
        >
          ← Back to Forum
        </Link>

        {/* Original post */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-7 mb-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3AFFD4]/10 font-dm-mono text-sm text-[#3AFFD4]">
              {initials(thread.user_id)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
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
              <h1 className="font-bebas text-4xl tracking-wide leading-tight">
                {thread.title}
              </h1>
              <p className="mt-4 text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {thread.body}
              </p>
              <div className="mt-5 flex items-center gap-5 font-dm-mono text-xs text-neutral-600 border-t border-white/10 pt-4">
                <span>{replies.length} replies</span>
                <span>♥ {thread.heart_count}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Replies */}
        {replies.length > 0 && (
          <div className="mb-4 space-y-3">
            <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600 px-1">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </p>
            {replies.map((reply) => (
              <div
                key={reply.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 font-dm-mono text-xs text-neutral-400">
                    {initials(reply.user_id)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-dm-mono text-xs text-neutral-600">
                      {timeAgo(reply.created_at)}
                    </span>
                    <p className="mt-1.5 text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                      {reply.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply composer */}
        <ReplyComposer threadId={thread.id} user={user} />
      </div>
    </main>
  );
}
