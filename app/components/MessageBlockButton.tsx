"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function MessageBlockButton({ viewerId, memberId, memberName, blocked, onChange }: {
  viewerId: string;
  memberId: string;
  memberName: string;
  blocked: boolean;
  onChange?: (blocked: boolean) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggleBlock() {
    setBusy(true);
    setError("");
    try {
      const blocks = createClient().from("message_blocks");
      const { error } = blocked
        ? await blocks.delete().eq("blocker_id", viewerId).eq("blocked_id", memberId)
        : await blocks.insert({ blocker_id: viewerId, blocked_id: memberId });
      if (error && (blocked || error.code !== "23505")) throw error;
      if (onChange) onChange(!blocked);
      else router.refresh();
    } catch {
      setError("Couldn't change this block. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggleBlock}
        disabled={busy}
        aria-label={`${blocked ? "Unblock" : "Block"} messages with ${memberName}`}
        className="min-h-9 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-neutral-300 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : blocked ? "Unblock messages" : "Block messages"}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-[#FF6B6B]">{error}</p>}
    </div>
  );
}
