import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ReplyComposer } from "./components/ReplyComposer";
import { HeartButton } from "@/app/components/HeartButton";
import { ReportButton } from "@/app/components/ReportModal";
import { UserPopover } from "@/app/components/UserPopover";
import { RankBadge } from "@/app/components/RankBadge";
import { AvatarBorder } from "@/app/components/AvatarBorder";
import { getUserProfileMap } from "@/utils/supabase/user-profiles";
import { getProfile } from "@/utils/supabase/profile";

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
    legacyProfile,
  ] = await Promise.all([
    supabase.from("threads").select("*").eq("id", id).single(),
    supabase
      .from("replies")
      .select("*")
      .eq("thread_id", id)
      .order("created_at", { ascending: true }),
    supabase.auth.getUser(),
    getProfile(supabase),
  ]);

  if (threadError || !threadData) notFound();

  const thread = threadData as Thread;
  const replies = (repliesData ?? []) as Reply[];

  const allUserIds = [
    ...new Set([thread.user_id, ...replies.map((r) => r.user_id)]),
  ];
  const profileMap = await getUserProfileMap(supabase, allUserIds);

  // Check if user has hearted this thread
  let hasHearted = false;
  if (user) {
    const { data: heart } = await supabase
      .from("thread_hearts")
      .select("id")
      .eq("thread_id", thread.id)
      .eq("user_id", user.id)
      .maybeSingle();
    hasHearted = !!heart;
  }

  const threadAuthor = profileMap[thread.user_id];
  const threadAuthorName = threadAuthor?.display_name || "Unknown";
  const threadAuthorInitials = threadAuthorName.slice(0, 2).toUpperCase();

  return (
    <main className="relative min-h-screen bg-neutral-950 text-neutral-100 spore-bg">
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/forum"
          className="mb-8 inline-flex items-center gap-1.5 font-dm-mono text-xs uppercase tracking-widest text-neutral-500 transition hover:text-neutral-300"
        >
          ← Back to Forum
        </Link>

        {/* Original post */}
        <div className="mt-6 mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-7">
          <div className="flex items-start gap-4">
            {/* Author avatar */}
            {threadAuthor ? (
              <UserPopover profile={threadAuthor}>
                <AvatarBorder border={threadAuthor.avatar_border} size={44}>
                  {threadAuthor.avatar_url ? (
                    <img
                      src={threadAuthor.avatar_url}
                      alt={threadAuthorName}
                      className="rounded-full object-cover"
                      style={{ width: 44, height: 44 }}
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3AFFD4]/10 font-dm-mono text-sm text-[#3AFFD4]">
                      {threadAuthorInitials}
                    </div>
                  )}
                </AvatarBorder>
              </UserPopover>
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3AFFD4]/10 font-dm-mono text-sm text-[#3AFFD4]">
                {threadAuthorInitials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    CATEGORY_COLORS[thread.category] ??
                    "bg-white/10 text-neutral-400"
                  }`}
                >
                  {thread.category}
                </span>
                {threadAuthor && (
                  <RankBadge
                    role={threadAuthor.role}
                    name={threadAuthorName}
                  />
                )}
                <span className="font-dm-mono text-xs text-neutral-600">
                  {timeAgo(thread.created_at)}
                </span>
              </div>
              <h1 className="font-bebas text-4xl leading-tight tracking-wide">
                {thread.title}
              </h1>
              <p className="mt-4 leading-relaxed text-neutral-300 whitespace-pre-wrap">
                {thread.body}
              </p>
              <div className="mt-5 flex items-center gap-5 border-t border-white/10 pt-4 font-dm-mono text-xs text-neutral-600">
                <span>{replies.length} replies</span>
                <HeartButton
                  threadId={thread.id}
                  initialCount={thread.heart_count}
                  initialHearted={hasHearted}
                  userId={user?.id ?? null}
                />
                <ReportButton
                  reporterId={user?.id ?? null}
                  reportedUserId={thread.user_id}
                  threadId={thread.id}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Replies */}
        {replies.length > 0 && (
          <div className="mb-4 space-y-3">
            <p className="px-1 font-dm-mono text-xs uppercase tracking-widest text-neutral-600">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </p>
            {replies.map((reply) => {
              const replyAuthor = profileMap[reply.user_id];
              const replyName = replyAuthor?.display_name || "Unknown";
              const replyInitials = replyName.slice(0, 2).toUpperCase();

              return (
                <div
                  key={reply.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                >
                  <div className="flex items-start gap-3">
                    {replyAuthor ? (
                      <UserPopover profile={replyAuthor}>
                        <AvatarBorder border={replyAuthor.avatar_border} size={32}>
                          {replyAuthor.avatar_url ? (
                            <img
                              src={replyAuthor.avatar_url}
                              alt={replyName}
                              className="rounded-full object-cover"
                              style={{ width: 32, height: 32 }}
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 font-dm-mono text-xs text-neutral-400">
                              {replyInitials}
                            </div>
                          )}
                        </AvatarBorder>
                      </UserPopover>
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 font-dm-mono text-xs text-neutral-400">
                        {replyInitials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {replyAuthor && (
                          <RankBadge role={replyAuthor.role} name={replyName} />
                        )}
                        <span className="font-dm-mono text-xs text-neutral-600">
                          {timeAgo(reply.created_at)}
                        </span>
                        <ReportButton
                          reporterId={user?.id ?? null}
                          reportedUserId={reply.user_id}
                          threadId={thread.id}
                          replyId={reply.id}
                        />
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap">
                        {reply.body}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {replies.length === 0 && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.02] py-10 text-center">
            <p className="text-2xl mb-2">💬</p>
            <p className="text-sm text-neutral-500">
              No replies yet — be the first to respond
            </p>
          </div>
        )}

        {/* Reply composer */}
        <ReplyComposer
          threadId={thread.id}
          user={user}
          profileUsername={legacyProfile?.username ?? null}
        />
      </div>
    </main>
  );
}
