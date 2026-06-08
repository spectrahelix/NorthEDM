"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

export function MessagesNavLink({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0);

  const fetchCount = useCallback(async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from("direct_messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("read", false);
    setUnread(count ?? 0);
  }, [userId]);

  useEffect(() => {
    fetchCount();
    const supabase = createClient();
    const channel = supabase
      .channel(`dms:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${userId}`,
        },
        () => setUnread((c) => c + 1)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCount]);

  return (
    <Link
      href="/messages"
      className="relative flex items-center gap-1.5 transition hover:text-white"
    >
      Messages
      {unread > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#3AFFD4] px-0.5 font-dm-mono text-[9px] font-bold text-black">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
