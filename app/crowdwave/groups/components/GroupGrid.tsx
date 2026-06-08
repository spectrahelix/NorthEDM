"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Group = {
  id: number;
  emoji: string;
  name: string;
  category: string;
  member_count: number;
};

export function GroupGrid({
  groups: initialGroups,
  joinedGroupIds: initialJoined,
  userId,
}: {
  groups: Group[];
  joinedGroupIds: number[];
  userId: string | null;
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [joined, setJoined] = useState(new Set(initialJoined));
  const [suggestion, setSuggestion] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  async function toggleGroup(groupId: number) {
    if (!userId) {
      router.push("/login");
      return;
    }

    const isJoined = joined.has(groupId);
    const currentCount =
      groups.find((g) => g.id === groupId)?.member_count ?? 0;
    const newCount = currentCount + (isJoined ? -1 : 1);

    // Optimistic update
    setJoined((prev) => {
      const next = new Set(prev);
      isJoined ? next.delete(groupId) : next.add(groupId);
      return next;
    });
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, member_count: Math.max(0, newCount) } : g
      )
    );

    const supabase = createClient();
    if (isJoined) {
      await supabase
        .from("group_members")
        .delete()
        .match({ group_id: groupId, user_id: userId });
    } else {
      await supabase
        .from("group_members")
        .insert({ group_id: groupId, user_id: userId });
    }
    await supabase
      .from("community_groups")
      .update({ member_count: Math.max(0, newCount) })
      .eq("id", groupId);
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groups.map((group) => {
          const isJoined = joined.has(group.id);
          return (
            <div
              key={group.id}
              className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{group.emoji}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-tight">
                    {group.name}
                  </p>
                  <p className="text-xs text-neutral-500">{group.category}</p>
                </div>
              </div>
              <p className="font-dm-mono text-sm text-neutral-400">
                {group.member_count}{" "}
                {group.member_count === 1 ? "member" : "members"}
              </p>
              <button
                onClick={() => toggleGroup(group.id)}
                className={`w-full rounded-xl py-2 text-sm font-semibold transition ${
                  isJoined
                    ? "border border-white/10 text-neutral-400 hover:border-[#FF5C3A]/40 hover:text-[#FF5C3A]"
                    : "bg-[#3AFFD4] text-black hover:opacity-90"
                }`}
              >
                {isJoined ? "Leave" : "Join"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Suggest a Group */}
      <div className="mt-12 max-w-sm">
        <p className="mb-3 font-semibold">Suggest a Group</p>
        {submitted ? (
          <p className="text-sm text-[#3AFFD4]">
            Thanks! We&apos;ll review your suggestion.
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestion.trim()) setSubmitted(true);
              }}
              placeholder="What group is missing?"
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
            />
            <button
              onClick={() => {
                if (suggestion.trim()) setSubmitted(true);
              }}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
            >
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
