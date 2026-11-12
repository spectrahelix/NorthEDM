"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BackBar } from "@/app/components/BackBar";
import { createClient } from "@/utils/supabase/client";
import { ComposeModal, type MessageDraft } from "./ComposeModal";
import { MessageBlockButton } from "@/app/components/MessageBlockButton";

type Member = { id: string; display_name: string };

type Message = {
  id: number;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  item_path: string | null;
  read: boolean;
  created_at: string;
  other_profile?: Member;
};

async function fetchMessages(uid: string, tab: "inbox" | "outbox"): Promise<Message[]> {
  const supabase = createClient();
  const isInbox = tab === "inbox";
  const { data } = await supabase.from("direct_messages")
    .select("id, sender_id, recipient_id, subject, body, item_path, read, created_at")
    .eq(isInbox ? "recipient_id" : "sender_id", uid)
    .order("created_at", { ascending: false });
  const messages = (data ?? []) as Message[];
  if (!messages.length) return messages;

  const counterpart = (message: Message) => isInbox ? message.sender_id : message.recipient_id;
  const ids = [...new Set(messages.map(counterpart))];
  const { data: profiles } = await supabase.from("user_profiles").select("id, display_name").in("id", ids);
  const byId = new Map<string, Member>(profiles?.map(profile => [profile.id, profile]));
  return messages.map(message => ({ ...message, other_profile: byId.get(counterpart(message)) }));
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function MessagesInbox({ userId, initialDraft, initialBlocked, contactNotice }: {
  userId: string;
  initialDraft: MessageDraft | null;
  initialBlocked: Member[];
  contactNotice?: string;
}) {
  const router = useRouter();

  const [tab, setTab] = useState<"inbox" | "outbox">("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [draft, setDraft] = useState<MessageDraft | null>(initialDraft);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const blockedIds = new Set(blocked.map(member => member.id));

  function updateBlock(member: Member, isBlocked: boolean) {
    setBlocked(list => isBlocked
      ? [...list.filter(entry => entry.id !== member.id), member]
      : list.filter(entry => entry.id !== member.id));
  }

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let version = 0;
    function refresh() {
      const requestVersion = ++version;
      void fetchMessages(userId, tab).then(result => {
        if (active && requestVersion === version) {
          setMessages(result);
          setLoading(false);
        }
      });
    }
    refresh();
    const channel = supabase.channel(`messages:${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `recipient_id=eq.${userId}`,
      }, refresh)
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, tab, refreshVersion]);

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

  return (
    <main className="min-h-screen text-neutral-100">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <BackBar fallback="/" />
          <p className="mb-2 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#3AFFD4]">
            NorthEDM
          </p>
          <div className="flex items-end justify-between">
            <h1 className="font-bebas text-6xl tracking-wide">Messages</h1>
            <button
              onClick={() => setDraft({})}
              className="mb-1 rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
            >
              + Compose
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {contactNotice && <p role="status" className="mb-4 rounded-xl border border-white/10 p-3 text-sm text-neutral-300">{contactNotice}</p>}
        <details className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
          <summary className="cursor-pointer text-neutral-300">Blocked accounts{blocked.length ? ` (${blocked.length})` : ""}</summary>
          {blocked.length === 0 ? <p className="mt-3 text-neutral-400">You haven&apos;t blocked any accounts.</p> : (
            <ul className="mt-2 divide-y divide-white/10">
              {blocked.map(member => (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/profile/${member.id}`} className="break-all hover:underline">{member.display_name}</Link>
                  <MessageBlockButton viewerId={userId} memberId={member.id} memberName={member.display_name} blocked onChange={value => updateBlock(member, value)} />
                </li>
              ))}
            </ul>
          )}
        </details>
        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-white/10">
          {(["inbox", "outbox"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setLoading(true);
                setExpanded(null);
                if (t === tab) setRefreshVersion(version => version + 1);
              }}
              className={`px-5 py-2.5 font-dm-mono text-xs uppercase tracking-widest transition ${
                tab === t
                  ? "border-b-2 border-[#39FF14] text-[#39FF14]"
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
              const otherId = tab === "inbox" ? msg.sender_id : msg.recipient_id;
              const otherBlocked = blockedIds.has(otherId);

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
                      {msg.item_path && <Link href={msg.item_path} className="mt-2 inline-block text-sm text-[#3AFFD4] hover:underline">View item</Link>}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {!otherBlocked && (
                          <button
                            onClick={() => setDraft({
                              recipientId: otherId,
                              subject: (/^Re:/i.test(msg.subject) ? msg.subject : `Re: ${msg.subject}`).slice(0, 100),
                              item: msg.item_path ? { path: msg.item_path, name: "Item listing" } : undefined,
                            })}
                            className="min-h-9 rounded-xl bg-white/5 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/10 hover:text-white"
                          >
                            Reply
                          </button>
                        )}
                        {otherId !== userId && <MessageBlockButton viewerId={userId} memberId={otherId} memberName={otherName} blocked={otherBlocked}
                          onChange={value => updateBlock({ id: otherId, display_name: otherName }, value)} />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {draft && (
        <ComposeModal
          userId={userId}
          draft={draft}
          blockedIds={blockedIds}
          onClose={() => {
            setDraft(null);
            router.replace("/messages");
          }}
          onSent={() => {
            setDraft(null);
            router.replace("/messages");
            setLoading(true);
            setExpanded(null);
            if (tab === "outbox") setRefreshVersion(version => version + 1);
            setTab("outbox");
          }}
        />
      )}
    </main>
  );
}
