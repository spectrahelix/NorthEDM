import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ArtisanActions } from "./ArtisanRow";
import type { UserProfile } from "@/utils/supabase/user-profiles";

export const metadata = { title: "Admin · Artisans" };

function Card({ p, verified }: { p: UserProfile; verified: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-bebas text-xl tracking-wide" style={{ color: "#FFC93C" }}>
            {p.stage_name || p.display_name}
          </p>
          <p className="font-dm-mono text-xs text-neutral-500">
            {p.display_name}
            {p.artisan_craft ? ` · ${p.artisan_craft}` : ""}
          </p>
        </div>
        <ArtisanActions userId={p.id} verified={verified} />
      </div>
      {p.artisan_statement && (
        <p className="mt-3 line-clamp-3 text-sm text-neutral-400">{p.artisan_statement}</p>
      )}
    </div>
  );
}

export default async function AdminArtisansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin =
    me?.role === "archon" || me?.role === "warden" || user.email === "cjblue27@gmail.com";
  if (!isAdmin) redirect("/");

  const [{ data: pendingData }, { data: verifiedData }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("*")
      .eq("artisan_status", "pending")
      .eq("is_artisan", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_profiles")
      .select("*")
      .eq("is_artisan", true)
      .order("created_at", { ascending: false }),
  ]);

  const pending = (pendingData ?? []) as UserProfile[];
  const verified = (verifiedData ?? []) as UserProfile[];

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-4xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em]" style={{ color: "#FFC93C" }}>
          Admin · Artisans
        </p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Artisan Verification</h1>

        <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Pending applications ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-500">
            No pending applications.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <Card key={p.id} p={p} verified={false} />
            ))}
          </div>
        )}

        <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Verified artisans ({verified.length})
        </h2>
        {verified.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-500">
            No verified artisans yet.
          </p>
        ) : (
          <div className="space-y-3">
            {verified.map((p) => (
              <Card key={p.id} p={p} verified={true} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
