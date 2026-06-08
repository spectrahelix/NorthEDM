"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

type Notification = {
  id: number;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
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

export function NotificationBell({ userId }: { userId: string }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifs = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);
    setNotifs((data ?? []) as Notification[]);
  }, [userId]);

  useEffect(() => {
    fetchNotifs();
    const supabase = createClient();
    const channel = supabase
      .channel(`notifs:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifs((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifs]);

  const unread = notifs.filter((n) => !n.read).length;

  async function markAllRead() {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-base text-neutral-400 transition hover:bg-white/5 hover:text-white"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF5C3A] px-0.5 font-dm-mono text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-400">
                Notifications
              </p>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="font-dm-mono text-xs text-[#3AFFD4] transition hover:text-white"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="mb-1 text-2xl">🔔</p>
                  <p className="text-sm text-neutral-500">All quiet — no notifications yet</p>
                </div>
              ) : (
                notifs.map((n) => (
                  <div
                    key={n.id}
                    className={`border-b border-white/5 transition last:border-b-0 ${
                      !n.read ? "bg-white/[0.04]" : ""
                    }`}
                  >
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 hover:bg-white/[0.03]"
                      >
                        <p className="text-sm text-neutral-200">{n.message}</p>
                        <p className="mt-0.5 font-dm-mono text-[10px] text-neutral-600">
                          {timeAgo(n.created_at)}
                        </p>
                      </Link>
                    ) : (
                      <div className="px-4 py-3">
                        <p className="text-sm text-neutral-200">{n.message}</p>
                        <p className="mt-0.5 font-dm-mono text-[10px] text-neutral-600">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
