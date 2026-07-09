import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ApplyActions } from "./ApplyRow";

export const metadata = { title: "Admin · Marketplace" };

type App = {
  id: string;
  user_id: string;
  business_name: string;
  category: string | null;
  description: string | null;
  contact: string | null;
  website: string | null;
  status: string;
  created_at: string;
};

export default async function AdminMarketplacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
  const isAdmin = me?.role === "archon" || me?.role === "warden" || user.email === "cjblue27@gmail.com";
  if (!isAdmin) redirect("/");

  const { data } = await supabase
    .from("marketplace_applications")
    .select("*")
    .order("created_at", { ascending: false });
  const apps = (data ?? []) as App[];
  const pending = apps.filter((a) => a.status === "pending");
  const decided = apps.filter((a) => a.status !== "pending");

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-4xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em]" style={{ color: "#00D4FF" }}>Admin · Marketplace</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Marketplace Applications</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Grant access to reserve a paid NorthEDM Marketplace. Granting sets the Marketplace tag and
          unlocks inventory upload.
        </p>

        <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-500">No pending applications.</p>
        ) : (
          <div className="space-y-3">{pending.map((a) => <Card key={a.id} a={a} />)}</div>
        )}

        {decided.length > 0 && (
          <>
            <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Decided ({decided.length})</h2>
            <div className="space-y-3">{decided.map((a) => <Card key={a.id} a={a} decided />)}</div>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ a, decided }: { a: App; decided?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-bebas text-xl tracking-wide" style={{ color: "#00D4FF" }}>{a.business_name}</p>
          <p className="font-dm-mono text-xs text-neutral-500">
            {a.category || "—"}{a.contact ? ` · ${a.contact}` : ""}{a.website ? ` · ${a.website}` : ""}
          </p>
        </div>
        {decided ? (
          <span className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">{a.status}</span>
        ) : (
          <ApplyActions appId={a.id} userId={a.user_id} />
        )}
      </div>
      {a.description && <p className="mt-3 line-clamp-3 text-sm text-neutral-400">{a.description}</p>}
    </div>
  );
}
