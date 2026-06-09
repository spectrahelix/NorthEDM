"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function DeleteButton({
  table,
  id,
  redirectTo,
  label = "Delete",
}: {
  table: "threads" | "replies";
  id: number;
  redirectTo?: string;
  label?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleDelete() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Ownership is enforced by filtering on user_id — only the owner's row is deleted
    await supabase.from(table).delete().eq("id", id).eq("user_id", user.id);
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      startTransition(() => router.refresh());
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="font-dm-mono text-xs text-neutral-400">Sure?</span>
        <button
          onClick={handleDelete}
          className="font-dm-mono text-xs text-[#FF5C3A] hover:underline"
        >
          Yes, delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="font-dm-mono text-xs text-neutral-600 hover:text-neutral-400"
        >
          cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="font-dm-mono text-xs text-neutral-600 hover:text-[#FF5C3A] transition"
    >
      {label}
    </button>
  );
}
