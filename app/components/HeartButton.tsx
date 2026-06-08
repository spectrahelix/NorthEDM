"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function HeartButton({
  threadId,
  initialCount,
  initialHearted,
  userId,
}: {
  threadId: number;
  initialCount: number;
  initialHearted: boolean;
  userId: string | null;
}) {
  const [hearted, setHearted] = useState(initialHearted);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) {
      router.push("/login");
      return;
    }
    if (pending) return;
    setPending(true);
    const supabase = createClient();
    const next = !hearted;
    setHearted(next);
    setCount((c) => (next ? c + 1 : c - 1));

    if (next) {
      await supabase
        .from("thread_hearts")
        .insert({ thread_id: threadId, user_id: userId });
      await supabase
        .from("threads")
        .update({ heart_count: count + 1 })
        .eq("id", threadId);
    } else {
      await supabase
        .from("thread_hearts")
        .delete()
        .eq("thread_id", threadId)
        .eq("user_id", userId);
      await supabase
        .from("threads")
        .update({ heart_count: Math.max(0, count - 1) })
        .eq("id", threadId);
    }
    setPending(false);
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`flex items-center gap-1 font-dm-mono text-xs transition-colors ${
        hearted
          ? "text-[#FF5C3A]"
          : "text-neutral-600 hover:text-[#FF5C3A]"
      }`}
    >
      <span className="text-sm">{hearted ? "♥" : "♡"}</span>
      <span>{count}</span>
    </button>
  );
}
