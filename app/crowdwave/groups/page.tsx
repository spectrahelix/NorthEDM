import { createClient } from "@/utils/supabase/server";
import { GroupGrid } from "./components/GroupGrid";

type Group = {
  id: number;
  emoji: string;
  name: string;
  category: string;
  member_count: number;
};

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: groupsData }, { data: membershipData }] = await Promise.all([
    supabase
      .from("community_groups")
      .select("*")
      .order("member_count", { ascending: false }),
    user
      ? supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] as { group_id: number }[] }),
  ]);

  const groups = (groupsData ?? []) as Group[];
  const joinedGroupIds = (membershipData ?? []).map(
    (m: { group_id: number }) => m.group_id
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="mb-2 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#3AFFD4]">
            CrowdWave
          </p>
          <h1 className="font-bebas text-6xl tracking-wide">
            Community Groups
          </h1>
          <p className="mt-3 max-w-xl text-neutral-400">
            Find your people. Join crews organized around shared festival vibes,
            travel plans, and camp culture.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <GroupGrid
          groups={groups}
          joinedGroupIds={joinedGroupIds}
          userId={user?.id ?? null}
        />
      </div>
    </main>
  );
}
