"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ComposeModal } from "./components/ComposeModal";
import type { UserProfile } from "@/utils/supabase/user-profiles";

type Message = {
  id: number;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  read: boolean;
  created_at: string;
  other_profile?: UserProfile;
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

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledTo = searchParams.get("to");

  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<"inbox" | "outbox">("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [compose, setCompose] = useState(!!prefilledTo);

  const fetchMessages = useCallback(async (uid: string, t: "inbox" | "outbox") => {
    const supabase = createClient();
    const isInbox = t === "inbox";
    const field = isInbox ? "recipient_id" : "sender_id";
    const otherId = isInbox ? "sender_id" : "recipient_id";

    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .eq(field, uid)
      .order("created_at", { ascending: false });

    const msgs = (data ?? []) as Message[];

    const otherIds = [...new Set(msgs.map((m) => m[otherId as keyof Message] as string))];
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("*")
        .in("id", otherIds);
      const profileMap: Record<string, UserProfile> = {};
      for (const p of (profiles ?? []) as UserProfile[]) {
        profileMap[p.id] = p;
      }
      for (const m of msgs) {
        m.other_profile = profileMap[m[otherId as keyof Message] as string];
      }
    }

    setMessages(msgs);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      fetchMessages(user.id, tab);

      // Realtime for new messages
      const channel = supabase
        .channel(`messages:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "direct_messages",
            filter: `recipient_id=eq.${user.id}`,
          },
          () => fetchMessages(user.id, tab)
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });
  }, [router, tab, fetchMessages]);

  async function markRead(msg: Message) {
    if (tab !== "inbox" || msg.read) return;
    const supabase = createClient();
    await supabase
      .from("direct_messages")
      .update({ read: true })
      .eq("id", msg.id);
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m))
    );
  }

  async function toggleExpand(msg: Message) {
    if (expanded === msg.id) {
      setExpanded(null);
    } else {
      setExpanded(msg.id);
      await markRead(msg);
    }
  }

  const unread = messages.filter((m) => tab === "inbox" && !m.read).length;

  if (!userId && loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-dm-mono text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-neutral-100">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <p className="mb-2 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#3AFFD4]">
            NorthEDM
          </p>
          <div className="flex items-end justify-between">
            <h1 className="font-bebas text-6xl tracking-wide">Messages</h1>
            <button
              onClick={() => setCompose(true)}
              className="mb-1 rounded-xl bg-[#E8FF47] px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
            >
              + Compose
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-white/10">
          {(["inbox", "outbox"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setLoading(true);
                setExpanded(null);
                if (userId) fetchMessages(userId, t);
              }}
              className={`px-5 py-2.5 font-dm-mono text-xs uppercase tracking-widest transition ${
                tab === t
                  ? "border-b-2 border-[#E8FF47] text-[#E8FF47]"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {t === "inbox" ? (
                <span className="flex items-center gap-2">
                  Inbox
                  {t === tab && unread > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#3AFFD4] px-0.5 text-[9px] font-bold text-black">
                      {unread}
                    </span>
                  )}
                </span>
              ) : (
                "Outbox"
              )}
            </button>
          ))}
        </div>

        {/* Message list */}
        {loading ? (
          <div className="py-16 text-center">
            <p className="font-dm-mono text-sm text-neutral-600">Loading…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center">
            <p className="mb-2 text-3xl">{tab === "inbox" ? "📭" : "📤"}</p>
            <p className="text-sm text-neutral-500">
              {tab === "inbox"
                ? "Your inbox is empty — silence is golden"
                : "You haven't sent any messages yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const otherProfile = msg.other_profile;
              const otherName = otherProfile?.display_name || "Unknown";
              const otherInitials = otherName.slice(0, 2).toUpperCase();
              const isExpanded = expanded === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`rounded-2xl border transition ${
                    tab === "inbox" && !msg.read
                      ? "border-[#3AFFD4]/20 bg-[#3AFFD4]/[0.04]"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <button
                    onClick={() => toggleExpand(msg)}
                    className="flex w-full items-start gap-4 p-5 text-left"
                  >
                    {/* Avatar */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 font-dm-mono text-xs text-neutral-400">
                      {otherInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-neutral-200">
                          {tab === "inbox" ? (
                            <a
                              href={`/profile/${msg.sender_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-white"
                            >
                              {otherName}
                            </a>
                          ) : (
                            <a
                              href={`/profile/${msg.recipient_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-white"
                            >
                              To: {otherName}
                            </a>
                          )}
                        </span>
                        <span className="shrink-0 font-dm-mono text-xs text-neutral-600">
                          {timeAgo(msg.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 font-semibold text-sm text-neutral-100">
                        {msg.subject}
                      </p>
                      {!isExpanded && (
                        <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                          {msg.body}
                        </p>
                      )}
                    </div>
                    {tab === "inbox" && !msg.read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#3AFFD4]" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-white/10 px-5 pb-5 pt-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
                        {msg.body}
                      </p>
                      <div className="mt-4">
                        <button
                          onClick={() =>
                            setCompose(true)
                          }
                          className="rounded-xl bg-white/5 px-4 py-2 text-xs text-neutral-400 transition hover:bg-white/10 hover:text-white"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {compose && userId && (
        <ComposeModal
          userId={userId}
          prefilledTo={prefilledTo ?? undefined}
          onClose={() => {
            setCompose(false);
            router.replace("/messages");
          }}
          onSent={() => {
            setCompose(false);
            router.replace("/messages");
            if (userId) fetchMessages(userId, "outbox");
            setTab("outbox");
          }}
        />
      )}
    </main>
  );
}
